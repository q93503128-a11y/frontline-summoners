# 계정 Mutation / Idempotency 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_SERVER_MUTATION_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`

이 문서는 authenticated account에 사용할 **서버 내부 mutation authority**와 재전송 중복 방지 foundation을 기록한다.
아직 인증/session이 없으므로 raw `accountId`를 받는 공개 mutation API를 열지 않았다. 현재 코드를 인터넷에 노출된 계정 API 완료로 해석하면 안 된다.

## 1. client/server 경제 수치 정본 공유

다음 경제 테이블을 `@frontline/sim` 공용 정본으로 사용한다.

- `main-stage-rewards`: MAIN80 first/repeat reward.
- `record-rewards`: 끝없는 전선 / 보스 러시 milestone.
- `meta-economy`: 모집 비용, Base Lv Gold 곡선, 중복 분해, 공용 +Lv 비용.
- `special-rewards`: 일반/상시/제한/이벤트 SPECIAL 및 주기 SPECIAL first/charged/depleted reward와 charge resolver.

client와 server가 동일한 숫자 정본을 읽으므로 로그인 서버 지급과 게스트 지급이 별도 숫자 복사본 때문에 갈라지는 경로를 줄였다.
record/SPECIAL의 정확한 경제 수량은 전체 사람 플레이테스트 전 `DESIGN_TARGET`이다.

## 2. account authority content / stage catalog

현재 authority catalog:

- MAIN 80.
- 일반 SPECIAL 61.
- 표준 stage policy 141.
- 실행 enemy discovery 전체 catalog.
- 전체 v2 permanent reward/evolution catalog.

SPECIAL 권위 판정은 서버가 `stage-collections`, `special-unlocks`, stage policy, event/periodic availability를 직접 읽는다.
저장된 과거 SPECIAL clear history는 authored unlock 구조만 검증하고 현재 availability를 다시 요구하지 않는다. 새 battle/sweep mutation은 서버 현재 시각 availability를 별도로 재검증한다.

과거의 `SPECIAL clear가 하나라도 있으면 main_01_020 필요` blanket gate는 제거했다. 현재 정본상 주기 SPECIAL 첫 단계가 `main_01_003`부터 열릴 수 있기 때문이다.

## 3. MAIN battle result

`applyAccountMainBattleResult`

- trusted `battleId`.
- contiguous next-stage first clear 검증.
- NORMAL_CLEAR provenance.
- permanent reward 최초 획득.
- `mainRewardedStageIds` first-clear wallet receipt.
- 공용 MAIN first/repeat reward.
- progression + wallet을 한 account revision에 확정.

## 4. 일반 / 주기 / 이벤트 SPECIAL result

`applyAccountSpecialBattleResult`

서버가 다음을 직접 검증한다.

- SPECIAL stage 존재.
- collection/main progression gate.
- `requiredProgressionStageId`.
- `previousSpecialStageId`.
- event/periodic availability by server time.
- first/repeat clear 상태.
- periodic collection charge.

주기 first clear는 charge 미소모, charged repeat는 1칸 소비, charge 0 repeat는 depleted reward다.
SPECIAL clear + wallet + charge를 같은 revision에 확정한다.

## 5. 기록 SPECIAL result

`applyAccountRecordResult`

끝없는 전선:
- `main_03_020` 필요.
- trusted `survivalFrames`에서 서버가 시간/분 계산.
- 신규 정수 분 high-water만 지급.

보스 러시:
- `main_04_020` 필요.
- runtime 9보스 cap.
- 신규 defeated-boss high-water만 지급.

공개 API에서 client 자기신고 기록을 영구 확정하는 경로는 아직 없다.

## 6. 모집

`applyAccountRecruitment`

- canonical 3 banner를 서버가 직접 읽음.
- 1회/10회만 허용.
- server wallet crystal 차감.
- Worker crypto RNG.
- 신규 소유/초기 progress.
- duplicate `APPLY_PLUS` 또는 `DISMANTLE`.
- +50 cap 초과분 분해.
- 소비/소유/+Lv/분해 재화를 한 revision에 확정.

클라이언트는 pull 결과나 rarity를 제출하지 않는다.

## 7. 소탕

`applyAccountSweep`

- known MAIN/SPECIAL stage.
- server stage policy `AFTER_NORMAL_CLEAR`.
- prior NORMAL_CLEAR.
- SPECIAL이면 authored gate/current availability 재검증.
- `sweep_ticket` 정확히 1장 차감.
- repeat reward만 지급.
- periodic repeat이면 필요 시 charge 1칸 소비.

소탕은 first clear, permanent reward, character unlock, progression, record를 새로 만들지 않는다.

## 8. Base Lv / +Lv / 진화 / 덱 / 거점 병기

`apps/server/src/account-meta-mutation-authority.ts`
`applyAccountMetaProgression`

mutation kind:
- `META_PROGRESSION`

지원 action:
- `CHARACTER_LEVEL`
- `CHARACTER_PLUS_LEVEL`
- `EVOLUTION_UNLOCK`
- `EVOLUTION_SELECT`
- `DECK_SET`
- `BASE_WEAPON_SELECT`

### Base Lv

서버가 계정의 MAIN NORMAL_CLEAR를 기준으로 cap을 계산한다.

- 시작 Lv10.
- `main_01_020` → Lv20.
- `main_02_020` → Lv30.
- `main_03_020` → Lv40.
- `main_04_020` → Lv50.

보유 캐릭터만 성장 가능하고 level 감소는 거부한다.
Gold 비용은 공용 `getLevelUpgradeGoldCost`로 서버가 계산해 account wallet에서 차감한다.

### +Lv

- 보유 캐릭터만 가능.
- +0..+50.
- 감소 거부.
- 캐릭터의 authored acquisition class/rarity를 서버 content에서 읽음.
- STORY 80 / C16 / B32 / A80 / S280 / SS880 soul essence를 공용 economy 정본으로 계산.
- client가 rarity나 비용을 제출하지 않는다.

### 진화 unlock / form 선택

unlock:
- form이 해당 character 소유인지 확인.
- F1은 자동 unlock이므로 paid unlock 대상 아님.
- 이전 form unlock 필요.
- recipe 존재 필요.
- required Base Lv 필요.
- exact recipe resource를 server wallet에서 차감.

select:
- 해당 character의 실제 unlocked form만 선택 가능.
- unlock과 선택은 별도 action이며 진화 unlock이 자동 form 선택을 강제하지 않는다.

### 덱

- 1..10 슬롯.
- exact order 저장.
- 중복 캐릭터 금지.
- account 소유 캐릭터만 허용.

### 거점 병기

- canonical 3종만 허용.
- account MAIN 진행으로 서버가 실제 해금을 다시 검사.
- 잠긴 병기 선택 거부.

위 여섯 action 모두 server snapshot을 직접 변경하고 client-side affordability/ownership/unlock 판정을 정본으로 신뢰하지 않는다.

## 9. battleId / requestId receipt

migrations:
- `0004_account_mutation_receipts.sql`
- `0005_account_special_sweep_mutations.sql`
- `0006_account_meta_progression_mutations.sql`

현재 mutation kind:

- `MAIN_BATTLE_RESULT`
- `SPECIAL_BATTLE_RESULT`
- `RECORD_RESULT`
- `RECRUITMENT`
- `SWEEP`
- `META_PROGRESSION`

기본 key:

```text
(user_id, mutation_kind, mutation_id)
```

MAIN/SPECIAL/record battle result는 partial unique index로 같은 account에서 `battleId` 자체가 서로 겹치지 못한다.

receipt 저장:
- input fingerprint.
- resulting account revision.
- exact result JSON.

같은 key + 같은 business input 재전송은 exact replay다. revision/재화/charge/RNG를 다시 변경하지 않는다.
같은 key를 다른 business input에 재사용하면 거부한다.
`expectedRevision`은 fingerprint에 넣지 않아 성공 뒤 원래 요청 재전송도 replay 가능하게 한다.

## 10. revision CAS + receipt 원자성

save 변경과 receipt insert는 D1 `batch`에서 함께 실행한다.

```text
revision = CASE
  WHEN revision = expectedRevision THEN revision + 1
  ELSE -1
END
```

revision race면 account save의 `revision >= 0` CHECK를 의도적으로 실패시켜 batch 전체 rollback을 강제한다.

- 같은 idempotency key race: rollback 뒤 receipt replay.
- 다른 write race: 최신 revision 기반 `revision_conflict`.
- receipt unique conflict: 반쪽 commit 없이 rollback.

## 11. 자동검증

현재 자동검증에는 다음이 포함된다.

- MAIN/SPECIAL/record shared reward 정합.
- MAIN80 / SPECIAL61 / policy141 catalog.
- SPECIAL authored gate/history/server-time availability.
- periodic first/repeat charge semantics.
- sweep ticket/repeat-only/progression 불변.
- record high-water.
- recruitment 신규/duplicate +Lv/분해.
- Base Lv canonical Gold와 장별 Lv10/20/30/40/50 cap.
- STORY/recruitment rarity별 +Lv soul 비용.
- insufficient wallet 거부.
- evolution previous form / Base Lv / recipe cost / locked form selection.
- deck exact order / unique / owned-only.
- base weapon server unlock authority.
- `META_PROGRESSION` receipt migration.
- battleId cross-result uniqueness 유지.
- rollback-safe revision CAS source guard.

## 12. 아직 남은 계정 작업

이번 단계에서 완료라고 세지 않는 것:

- 실제 authentication/session과 accountId binding.
- 공개 authenticated account mutation HTTP API.
- trusted solo/SPECIAL/record battle completion registry/result proof.
- guest→account 이전 및 서버 진행 충돌 UX.
- 모집/성장/진화/덱/병기 mutation을 실제 authenticated client flow에 연결.
- 협동 result를 canonical account progression/wallet/periodic charge에 실제 지급.
- progression reset/account delete.
- friend/block/PvP account data.
- production 경제 사람 플레이테스트 및 수치 LOCKED 승격.

따라서 현재 상태는 **서버 정본 save 위에 MAIN/SPECIAL/record/recruitment/sweep/meta-progression mutation 및 idempotency transaction foundation을 구현한 단계**다.
