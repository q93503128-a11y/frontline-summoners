# 계정 Mutation / Idempotency 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_SERVER_MUTATION_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`

이 문서는 authenticated account에 사용할 **서버 내부 mutation authority**와 재전송 중복 방지 foundation을 기록한다.
아직 인증/session이 없으므로 raw `accountId`를 받는 공개 mutation API를 열지 않았다. 현재 코드를 인터넷에 노출된 계정 API 완료로 해석하면 안 된다.

## 1. client/server 경제 수치 정본 공유

기존 client-only 숫자 복사본을 줄이고 다음 경제 테이블을 `@frontline/sim` 공용 정본으로 사용한다.

- `main-stage-rewards`
  - MAIN80 first-clear / repeat reward
- `record-rewards`
  - 끝없는 전선 minute milestone
  - 보스 러시 defeated-boss milestone
- `meta-economy`
  - 모집 비용
  - Base Lv Gold 비용 곡선
  - 중복 분해 soul essence
  - 공용 +Lv 비용
- `special-rewards`
  - 일반/상시/제한/이벤트 SPECIAL first-clear + repeat reward
  - 주기 재화 SPECIAL 18전장의 first/charged/depleted reward
  - collection charge 소비 resolver

client `special-rewards.ts`는 공용 resolver를 re-export하고, 과거 v13 이하 localStorage charge migration helper만 client에 남긴다.
따라서 로그인 서버 지급과 게스트 지급이 별도 숫자 테이블 때문에 조용히 갈라지는 경로를 제거했다.

record milestone 및 SPECIAL/주기 SPECIAL의 정확한 경제 수량은 전체 경제 사람 플레이테스트 전 `DESIGN_TARGET`이다.

## 2. account authority content / stage catalog 정합

`apps/server/src/account-content.ts`
`apps/server/src/account-stage-authority.ts`

현재 account authority catalog:

- MAIN: 4장 × 20 = **80**
- 일반 SPECIAL stage: **61**
- 표준 stage policy: **141 stage** 전체
- 실행 account discovery 대상 적: 현재 server runtime이 읽는 전체 MAIN/SPECIAL/event enemy catalog
- 전체 v2 permanent reward / evolution catalog

SPECIAL 권위 판정은 서버가 직접 다음 데이터를 읽는다.

- `stage-collections.json`
- `special-unlocks.json`
- stage policy 7개 묶음
- event availability windows
- periodic availability schedule

따라서 client가 `열림`, `이전 단계 클리어`, `charge 있음`, `소탕 가능`을 자기신고해도 정본이 되지 않는다.

### SPECIAL clear history 교정

과거 account progression validator에는 `SPECIAL clear가 하나라도 있으면 main_01_020 필요`라는 구형 blanket gate가 남아 있었다.
현재 정본에서는 주기 재화 SPECIAL 첫 단계가 `main_01_003`부터 열릴 수 있으므로 실제 stage collection 규칙과 충돌했다.

현재는 저장된 SPECIAL clear history를 다음으로 검증한다.

- collection의 `unlockAfterStageId`
- stage별 `requiredProgressionStageId`
- stage별 `previousSpecialStageId`
- known SPECIAL id

이력 검증에서는 **현재 시각의 event/periodic availability를 다시 요구하지 않는다**. 예전에 정상적으로 깬 기간 이벤트가 기간 종료 뒤 save load에서 불법 이력으로 바뀌면 안 되기 때문이다.
실제 새 battle/sweep mutation 시점에는 별도로 서버 현재 시각 availability를 재검증한다.

## 3. MAIN battle result mutation

`applyAccountMainBattleResult`

입력 foundation:

- trusted `battleId`
- `expectedRevision`
- `stageId`
- `SOLO_BATTLE | COOP_BATTLE`

서버 처리:

1. MAIN stage 존재 확인.
2. first clear이면 contiguous prefix의 바로 다음 stage인지 확인.
3. NORMAL_CLEAR provenance 저장.
4. permanent reward 최초 획득 판정.
5. `mainRewardedStageIds`로 first-clear 일반 재화 중복 여부 판정.
6. shared canonical reward table로 first/repeat reward 계산.
7. resource ledger grant.
8. progression + reward + wallet을 하나의 다음 account snapshot으로 확정.

같은 stage를 다른 새 battleId로 정상 재클리어하면 repeat Gold만 지급한다.

## 4. 일반 / 주기 / 이벤트 SPECIAL result mutation

`apps/server/src/account-special-mutation-authority.ts`
`applyAccountSpecialBattleResult`

입력 foundation:

- trusted `battleId`
- `expectedRevision`
- `stageId`

서버가 result 확정 전에 직접 재검증한다.

1. SPECIAL61 안의 실제 stage인지 확인.
2. collection main progression gate 확인.
3. authored `requiredProgressionStageId` 확인.
4. authored `previousSpecialStageId` 확인.
5. event window를 **서버 시각**으로 확인.
6. periodic collection open/closed를 **서버 시각**으로 확인.
7. 서버 snapshot에서 first clear 여부 확인.
8. 공용 SPECIAL reward resolver 실행.
9. 일반/이벤트 first/repeat reward 또는 주기 first/charged/depleted reward 계산.
10. 주기 repeat이면 collection charge를 최대 1칸 소비.
11. SPECIAL clear + wallet + charge를 같은 account revision에 확정.

주기 SPECIAL first clear는 charge를 소비하지 않는다.
charge 0 repeat는 depleted reward를 사용한다.
기간 밖 event/periodic stage는 새 result mutation을 거부한다.

`special-01..05`처럼 현재 일반 재화표가 없는 challenge stage도 정상 clear history는 저장하되 resource reward는 `{}`다.

## 5. 기록 SPECIAL result mutation

`applyAccountRecordResult`

### 끝없는 전선

- `main_03_020` clear 필요.
- trusted server result의 `survivalFrames`에서 서버가 ms/minute를 계산.
- best와 claimed minute high-water를 비교.
- 새로 넘은 minute만 milestone reward 지급.
- 낮은 기록 재도전은 보상 0.

### 보스 러시

- `main_04_020` clear 필요.
- 현재 runtime 9보스 초과 결과 거부.
- best defeated/high-water 비교.
- 새로 넘은 defeated-boss boundary만 지급.

record 숫자를 공개 API에서 client 자기신고로 영구 확정하는 경로는 아직 만들지 않았다. 향후 trusted battle completion source와 연결해야 한다.

## 6. 서버 권위 모집 mutation

`apps/server/src/recruitment-authority.ts`
`applyAccountRecruitment`

서버가 canonical 3개 banner를 직접 읽는다.

검증:

- rates 합계 1000.
- C/B/A/S/SS pool shape 5/5/5/5/1.
- unit rarity와 pool rarity 일치.
- S/SS series 일치.
- 모집은 1회 또는 10회만 허용.

실행:

1. server wallet에서 `summon_crystal` 충분 여부 확인/차감.
2. Worker crypto 기반 RNG로 rarity/character 확정.
3. 같은 10회 안에서 먼저 나온 신규 캐릭터가 뒤 pull에서 다시 나오면 duplicate 처리.
4. 신규 소유/초기 character progress 생성.
5. duplicate policy 처리:
   - `APPLY_PLUS`: +50까지 직접 +1.
   - +50 초과 또는 `DISMANTLE`: canonical soul essence 분해량 지급.
6. 소비/소유/+Lv/분해 재화를 하나의 account snapshot으로 확정.

클라이언트가 pull 결과나 rarity를 mutation payload로 제출하지 않는다.

## 7. 서버 권위 소탕 mutation

`applyAccountSweep`

입력 foundation:

- `requestId`
- `expectedRevision`
- `stageId`

서버 처리:

1. known MAIN/SPECIAL stage인지 확인.
2. stage policy가 `sweepEligibility = AFTER_NORMAL_CLEAR`인지 확인.
3. server snapshot의 prior NORMAL_CLEAR 확인.
4. SPECIAL이면 collection/sequential/current availability도 다시 확인.
5. `sweep_ticket` 정확히 1장 차감.
6. MAIN은 repeat reward만 계산.
7. 일반/이벤트 SPECIAL은 repeat reward만 계산.
8. 주기 SPECIAL은 charged/depleted resolver를 사용하고 charged면 charge 1칸 소비.
9. ticket spend + reward grant + periodic charge를 같은 account revision에 확정.

소탕은 first clear, permanent reward, character unlock, MAIN/SPECIAL progression, record를 새로 만들지 않는다.

## 8. battleId / requestId idempotency receipt

migrations:
- `apps/server/migrations/0004_account_mutation_receipts.sql`
- `apps/server/migrations/0005_account_special_sweep_mutations.sql`

table:
- `account_mutation_receipts`

현재 mutation kind:

- `MAIN_BATTLE_RESULT`
- `SPECIAL_BATTLE_RESULT`
- `RECORD_RESULT`
- `RECRUITMENT`
- `SWEEP`

기본 receipt key:

```text
(user_id, mutation_kind, mutation_id)
```

battle result 세 종류는 추가 partial unique index로 같은 account에서 `battleId` 자체가 서로 겹치지 못한다.

- MAIN_BATTLE_RESULT
- SPECIAL_BATTLE_RESULT
- RECORD_RESULT

저장:

- input fingerprint
- resulting account revision
- exact result JSON

동작:

- 같은 battleId/requestId + 같은 business input 재전송:
  - 저장된 exact result 반환.
  - revision 재증가 없음.
  - 재지급/재차감 없음.
  - 모집 RNG 재실행 없음.
  - periodic charge 재소비 없음.
- 같은 key를 다른 stage/result/banner/count/policy에 재사용:
  - 오류 처리.

`expectedRevision`은 fingerprint에 넣지 않는다. 성공 뒤 revision이 증가한 상태의 원래 요청 재전송도 같은 idempotency receipt로 replay되어야 하기 때문이다.

## 9. revision CAS + receipt 원자성

account snapshot 변경과 receipt 기록은 D1 `batch` 안에서 함께 실행한다.

revision mismatch일 때 `account_saves.revision >= 0` CHECK를 의도적으로 위반하는 `-1`을 만들도록 CAS statement를 구성한다.

```text
revision = CASE
  WHEN revision = expectedRevision THEN revision + 1
  ELSE -1
END
```

따라서 경쟁 write가 먼저 revision을 바꾼 경우 statement가 SQL 실패하고 D1 batch 전체가 rollback된다.

- 같은 idempotency key race: rollback 뒤 receipt를 다시 읽어 replay.
- 다른 mutation race: 최신 revision을 읽고 `revision_conflict` 반환.
- receipt unique conflict: batch rollback 후 기존 receipt replay 또는 conflict 처리.

이 경계는 `재화는 바뀌었는데 receipt가 없음` / `receipt는 있는데 save가 안 바뀜` 상태를 막기 위한 foundation이다.

## 10. 자동검증

현재 검증:

- shared MAIN80 / record / SPECIAL reward table sim tests.
- SPECIAL reward 18 periodic + 38 ordinary/event stage id uniqueness.
- account MAIN80 / SPECIAL61 / stage policy 141 catalog.
- MAIN first-clear vs repeat / locked skip / 장 경계.
- SPECIAL collection progression / authored tier / previous clear gate.
- early `main_01_003` periodic SPECIAL clear history 저장 가능.
- historical event clear는 기간 종료 뒤에도 snapshot validation 가능.
- 새 event/periodic mutation은 서버 현재 시각 availability 검증.
- periodic first clear charge 미소모.
- periodic repeat charge 1칸 소비.
- sweep prior clear / ticket 1장 / repeat-only / progression 불변.
- sweep periodic charge 소비 / insufficient ticket 거부.
- 끝없는 전선 / 보스 러시 high-water.
- 모집 crystal 소비 / 신규 / duplicate +1 / dismantle.
- mutation receipt migration + battleId cross-result uniqueness.
- rollback-safe CAS source guard.
- **CI #738 전체 green: typecheck / content schema / sim / server / client / build.**

기준 구현 커밋:
- `160cbbc86f5e9557d0b0f906056c56358e9ab085` — SPECIAL/sweep authority foundation.
- `456bc39e9d4b4bda687f583923277f396d622970` — authored SPECIAL history gate 교정 및 통합 green.

## 11. 아직 남은 계정 mutation 작업

이번 단계에서 완료라고 세지 않는 것:

- 실제 authentication/session과 accountId binding.
- 공개 account mutation HTTP API.
- trusted solo/SPECIAL/record battle completion을 mutation service에 연결하는 battle registry/result proof.
- Base Lv/+Lv/진화/덱/거점 병기 선택의 authenticated mutation.
- guest→account 이전 및 서버 진행 충돌 UX.
- 모집 result를 실제 로그인 client flow에 연결.
- 협동 result를 account reward mutation과 연결.
- progression reset/account delete.
- friend/block/PvP account data.
- production 경제 사람 플레이테스트 및 수치 LOCKED 승격.

따라서 현재 상태는 **서버 정본 save 위에 MAIN/SPECIAL/record/recruitment/sweep mutation 및 idempotency transaction foundation을 구현한 단계**다.
