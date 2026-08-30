# 계정 Mutation / Idempotency 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_SERVER_MUTATION_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`

이 문서는 authenticated account에 사용할 **서버 내부 mutation authority**와 재전송 중복 방지 foundation을 기록한다.
아직 인증/session이 없으므로 raw `accountId`를 받는 공개 mutation API를 열지 않았다. 현재 코드를 인터넷에 노출된 계정 API 완료로 해석하면 안 된다.

## 1. client/server 경제 수치 정본 공유

기존에 client에만 있던 다음 수치 테이블을 `@frontline/sim`으로 옮겼다.

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

client는 같은 모듈을 re-export해서 사용한다.
따라서 로그인 계정용 서버 지급값과 게스트 로컬 지급값이 별도 숫자 복사본 때문에 조용히 달라지는 경로를 제거했다.

정확한 record milestone 수량은 여전히 전체 경제 사람 플레이테스트 전 `DESIGN_TARGET`이다.

## 2. account authority content catalog 정합

`apps/server/src/account-content.ts`

계정 진행 검증이 일부 초기 파일만 보는 문제를 수정했다.

현재 account authority catalog:

- MAIN: 4장 × 20 = **80**
- 일반 SPECIAL stage: **61**
- 실행 account discovery 대상 적: 현재 server runtime이 읽는 전체 MAIN/SPECIAL/event enemy catalog

`progression-authority.ts`도 이 catalog와 `meta-content-v2`의 전체 permanent reward/evolution catalog를 사용한다.

이 변경으로 다음 잠복 오류를 막는다.

- 1장 완료 뒤 `main_02_001`을 unknown MAIN으로 거부
- 2~4장 permanent reward를 unknown reward로 거부
- 초기 SPECIAL 파일 밖의 SPECIAL clear를 unknown으로 거부
- 후반 MAIN/SPECIAL enemy discovery를 unknown으로 거부

장 경계 `main_01_020 → main_02_001`, 제3장/제4장 기록전 unlock까지 자동검증한다.

## 3. MAIN battle result mutation

`applyAccountMainBattleResult`

입력 foundation:

- trusted `battleId`
- `expectedRevision`
- `stageId`
- `SOLO_BATTLE | COOP_BATTLE`

서버가 직접 처리:

1. MAIN stage 존재 확인.
2. first clear이면 현재 contiguous prefix의 바로 다음 stage인지 확인.
3. NORMAL_CLEAR provenance 저장.
4. permanent reward 최초 획득 판정.
5. `mainRewardedStageIds`로 first-clear 일반 재화 중복 여부 판정.
6. shared canonical reward table로 first/repeat reward 계산.
7. resource ledger grant.
8. progression + reward + wallet을 하나의 다음 account snapshot으로 확정.

같은 stage를 다른 새 battleId로 정상 재클리어하면 first-clear가 아니라 repeat Gold만 지급한다.

## 4. 기록 SPECIAL result mutation

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

record result의 숫자를 일반 공개 API에서 클라이언트 자기신고로 영구 확정하는 경로는 아직 만들지 않았다. 향후 trusted battle completion source와 연결해야 한다.

## 5. 서버 권위 모집 mutation

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
3. 같은 10회 안에서 먼저 나온 신규 캐릭터가 뒤 pull에서 다시 나오면 duplicate로 처리.
4. 신규 소유/초기 character progress 생성.
5. duplicate policy 처리:
   - `APPLY_PLUS`: +50까지 직접 +1.
   - +50 초과 또는 `DISMANTLE`: canonical soul essence 분해량 지급.
6. 소비/소유/+Lv/분해 재화를 하나의 account snapshot으로 확정.

클라이언트가 pull 결과나 rarity를 mutation payload로 제출하지 않는다.

## 6. battleId / requestId idempotency receipt

migration:
- `apps/server/migrations/0004_account_mutation_receipts.sql`

table:
- `account_mutation_receipts`

키:

```text
(user_id, mutation_kind, mutation_id)
```

현재 kind:

- `MAIN_BATTLE_RESULT`
- `RECORD_RESULT`
- `RECRUITMENT`

저장:

- input fingerprint
- resulting account revision
- exact result JSON

동작:

- 같은 battleId/requestId + 같은 business input 재전송:
  - 저장된 exact result를 반환.
  - revision을 다시 증가시키지 않음.
  - 재화를 다시 지급/차감하지 않음.
  - 모집 RNG를 다시 실행하지 않음.
- 같은 key를 다른 stage/result/banner/count/policy에 재사용:
  - 오류 처리.
  - 첫 요청 결과를 다른 요청으로 위장해 replay하지 않음.

`expectedRevision`은 fingerprint에 넣지 않는다.
성공 뒤 revision이 증가한 상태에서 원래 요청을 재전송해도 같은 idempotency key로 replay되어야 하기 때문이다.

## 7. revision CAS + receipt 원자성

account snapshot 변경과 receipt 기록은 D1 `batch` 안에서 함께 실행한다.

단순히 CAS `UPDATE ... WHERE revision = expected`가 0 row가 되는 방식만 사용하면, batch가 SQL 오류 없이 진행되어 receipt와 save가 어긋날 수 있다.

현재 구현은 revision mismatch일 때 `account_saves.revision >= 0` CHECK를 의도적으로 위반하는 `-1`을 만들도록 CAS statement를 구성한다.

```text
revision = CASE
  WHEN revision = expectedRevision THEN revision + 1
  ELSE -1
END
```

따라서 경쟁 write가 먼저 revision을 바꾼 경우 statement가 SQL 실패하고 D1 batch 전체가 rollback된다.

- 같은 idempotency key race라면 rollback 뒤 receipt를 다시 읽어 replay.
- 다른 mutation race라면 최신 revision을 읽고 `revision_conflict` 반환.

receipt unique conflict도 같은 batch를 rollback시키고 기존 receipt replay로 회수한다.

이 경계는 `재화는 바뀌었는데 receipt가 없음` 또는 `receipt는 있는데 save가 안 바뀜` 상태를 막기 위한 foundation이다.

## 8. 자동검증

현재 검증:

- shared MAIN80 reward table sim tests.
- account MAIN80 / SPECIAL61 catalog 크기 및 장 경계.
- MAIN first-clear vs repeat reward.
- locked MAIN skip 거부.
- 제1장→제2장 account clear 연결.
- 끝없는 전선 high-water / 낮은 기록 무보상.
- 보스 러시 unlock / 9보스 cap / milestone reward.
- 모집 crystal 소비.
- 신규 소유.
- duplicate +1.
- duplicate dismantle.
- 지원하지 않는 pull count 거부.
- receipt table primary key/input fingerprint/result JSON schema.
- rollback-safe CAS source guard.
- 전체 typecheck/schema/sim/server/client/build CI.

## 9. 아직 남은 계정 mutation 작업

이번 단계에서 완료라고 세지 않는 것:

- 실제 authentication/session과 accountId binding.
- 공개 account mutation HTTP API.
- trusted solo/record battle completion을 mutation service에 연결하는 battle registry.
- 일반/주기/이벤트 SPECIAL result + sweep의 server-authoritative wallet/charge mutation.
- Base Lv/+Lv/진화/덱/거점 병기 선택의 authenticated mutation.
- guest→account 이전 및 서버 진행 충돌 UX.
- 모집 result를 실제 로그인 client flow에 연결.
- 협동 result를 account reward mutation과 연결.
- progression reset/account delete.
- friend/block/PvP account data.

따라서 현재 상태는 **서버 정본 save 위에 MAIN/record/recruitment mutation 및 idempotency transaction foundation을 구현한 단계**다.
