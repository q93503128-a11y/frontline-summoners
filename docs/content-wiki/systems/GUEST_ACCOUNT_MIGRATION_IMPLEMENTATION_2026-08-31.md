# Guest → Account Migration Implementation — 2026-08-31

상태: `IMPLEMENTED_REVERSIBLE_ACCOUNT_MIGRATION`

이 문서는 `ACCOUNT_SAVE_SYNC_SPEC.md`의 게스트 → 계정 이전 규칙을 현재 실행 코드에 내린 범위와 남은 제품화 경계를 기록한다. 기획 정본을 대체하지 않는다.

## 1. 목표와 금지선

이번 구현의 목적은 guest save v15의 실제 플레이 진행을 authenticated account save v2로 안전하게 이전하는 것이다.

반드시 지킨 규칙:

- 로그인만으로 게스트 저장을 서버에 자동 덮어쓰지 않는다.
- 이미 서버 진행이 있는 계정과 게스트 진행을 자동 병합하지 않는다.
- 빈 서버 계정과 populated 서버 계정을 구분한다.
- populated 계정 교체는 명시적 사용자 선택을 요구한다.
- revision/idempotency 없이 snapshot을 덮어쓰지 않는다.
- 이전 직전 서버 save/profile snapshot을 archive한다.
- account save와 account profile이 반쪽만 바뀌는 migration을 허용하지 않는다.
- 클라이언트가 accountId를 지정하지 않으며 Bearer session principal만 대상 계정을 결정한다.

## 2. 이전 대상

guest save v15에서 account save v2로 다음 축을 옮긴다.

- MAIN NORMAL_CLEAR progression.
- NORMAL_CLEAR provenance.
- MAIN first-clear receipt high-water.
- SPECIAL clear history.
- permanent reward ids.
- enemy discovery.
- recruitment character ownership.
- Base Lv / +Lv / unlocked form / selected form.
- deck order.
- selected base weapon.
- resource earned/spent ledger.
- periodic SPECIAL charge state.
- Record SPECIAL best/reward high-water.

게스트 profile meta가 있으면 대표 캐릭터/칭호/프레임/배너/문장/배지의 **장착 취향**도 account profile normalization 입력으로 사용한다.

중요:

- 로컬 claimed achievement id를 신뢰해서 서버 장식을 발행하지 않는다.
- 로컬 owned cosmetic id를 신뢰하지 않는다.
- account profile은 imported account save를 기준으로 server achievement evaluator가 다시 계산한다.
- 서버에 이미 존재하는 authoritative PvP/fact/profile history는 client 자기신고로 덮어쓰지 않는다.

## 3. strict guest → account 변환

서버 `mapGuestProgressToAccountSave`는 guest 객체를 그대로 DB에 넣지 않는다.

guest v15 필드를 account save v2 shape로 매핑한 뒤 기존 `normalizeAccountSaveSnapshot`을 통과시킨다.

따라서 다음 위조/불가능 상태는 migration에서도 그대로 거부된다.

- unknown resource id.
- spent > earned.
- 잘못된 periodic charge map/cap.
- 불가능한 Record high-water.
- 9보스 초과 Boss Rush 기록.
- MAIN 진행으로 아직 해금되지 않은 base weapon 선택.
- 기존 account progression authority가 거부하는 ownership/form/deck 상태.

migration은 guest local save가 있다는 이유로 server validation을 약화하지 않는다.

## 4. Preview

endpoint:

- `POST /api/account/migration/preview`

서버가 반환하는 비교 정보:

- source hash.
- guest capture time.
- server account가 pristine인지.
- account revision.
- profile revision.
- guest/server MAIN clear 수와 최고 MAIN.
- guest/server SPECIAL clear 수.
- 보유 캐릭터 수.
- 적 discovery 수.
- resource balance 요약.
- Endless/Boss Rush high-water.
- 권장 mode.

`sourceHash`는 preview한 guest envelope와 commit input이 같은지를 검증한다. 현재 hash에는 capture timestamp도 포함되므로 순수 content-address만을 의미하지는 않는다.

## 5. 빈 계정

빈 계정 판정은 단순 `revision === 0`이 아니다.

다음 두 조건을 모두 만족해야 한다.

1. revision 0.
2. snapshot이 canonical initial account save와 정확히 동일.

빈 계정에서는 UI가 `IMPORT_IF_EMPTY`를 기본 경로로 제시하고 한 번의 적용 동작으로 이전한다.

commit 시점에 다른 장치/요청이 먼저 서버 진행을 만들었으면 `server_progress_conflict` 또는 revision conflict로 실패한다. preview가 오래됐다고 자동 재적용하지 않는다.

## 6. 기존 서버 진행이 있는 계정

서버 진행이 이미 있으면 자동 merge하지 않는다.

UI는 guest와 server 요약을 함께 보여주고 다음 선택을 제공한다.

- `취소 · 서버 유지`.
- `게스트 진행 적용`.

교체는 2단 확인이다.

첫 클릭:

- destructive replace 경고만 표시.
- 서버 write 없음.

두 번째 클릭:

- `REPLACE_EXISTING` mode.
- 고정 confirmation `REPLACE_SERVER_PROGRESS`.
- preview source hash.
- current expected revision.

을 함께 보내야 한다.

서버 confirmation이 없으면 populated 계정을 교체하지 않는다.

## 7. Atomic archive + commit

migration commit은 D1 batch에서 함께 처리한다.

1. `account_saves` CAS update.
2. `account_profiles` CAS update.
3. `account_guest_migrations` archive insert.

archive에는 다음이 저장된다.

- previous account revision/snapshot.
- previous profile revision/snapshot.
- imported account/profile revision.
- source hash.
- mode.
- result metadata.

세 write 중 하나라도 실패하면 transaction 전체가 성공한 migration으로 취급되지 않는다.

같은 migration id + 같은 input replay는 idempotent result로 해석한다. 같은 key를 다른 source/mode에 재사용하면 거부한다.

## 8. Rollback

endpoint:

- `POST /api/account/migration/rollback`

UI에서는 이 화면에서 방금 성공한 migration id를 기억하고 `직전 이전 되돌리기`를 제공한다.

rollback 가능 조건:

- migration archive가 존재.
- 아직 rollback되지 않음.
- current account revision이 imported revision과 정확히 동일.
- current profile revision이 imported profile revision과 정확히 동일.

즉 migration 이후 재화 사용, 전투 결과, 성장, 프로필 변경 등 다른 서버 mutation이 있었다면 이전 snapshot을 덮어써 버리지 않고 rollback을 거부한다.

rollback 역시 D1 batch에서:

1. previous account snapshot 복구.
2. previous profile snapshot 복구.
3. migration row restored metadata 갱신.

을 함께 실행한다.

revision은 과거 숫자로 되돌리지 않고 새 revision으로 증가시켜 monotonicity를 유지한다.

## 9. Local migrated marker

성공한 client migration은 localStorage에 best-effort marker를 남긴다.

key:

- `frontline.guest.migratedToAccount.v1`

내용:

- migrationId.
- sourceHash.
- migratedAtMs.

rollback 성공 시 동일 migration marker를 제거한다.

이 marker는 server authority가 아니며 migration 성공 여부의 정본으로 사용하지 않는다. 서버 archive/현재 revision이 정본이다.

## 10. 프로필 취향만 가져오기와의 분리

전체 guest progression migration과 기존 `장식 취향만 가져오기`는 별도 기능이다.

장식 취향 import:

- `profileLoadout`만 보낸다.
- server progression/wallet을 바꾸지 않는다.
- claimedAchievementIds / ownedCosmeticIds / factIds / pvpBestTier를 보내지 않는다.

전체 progression migration:

- account save v2의 gameplay 축을 교체한다.
- account profile도 같은 transaction에서 imported save 기준으로 normalize한다.

두 기능을 하나의 자동 merge로 합치지 않는다.

## 11. 현재 제외 범위

### `totalPulls`

guest save v15에는 `totalPulls`가 있으나 current account save v2에는 대응 필드가 없다.

현재 모집 시스템은 pity/천장에 `totalPulls`를 사용하지 않으므로 gameplay entitlement 손실은 없지만, 이 통계는 이번 migration에서 보존되지 않는다.

향후 account recruitment history/stat surface가 생기면 별도 authoritative migration 대상이 필요하다.

### 소셜/PvP 계정 데이터

친구/차단/PvP rating/season history는 현재 account save v2 migration snapshot 대상이 아니다. guest local save가 authoritative source도 아니다.

따라서 guest progression 교체가 향후/별도 server social identity data를 client 자기신고로 덮어쓰는 경로가 되지 않는다.

## 12. 아직 남은 account 제품화

- email magic link/인증코드.
- session renewal/rotation/revoke-all-devices 최종 정책.
- account delete/reset/recovery UI.
- 장기간 migration archive retention/cleanup 정책.
- 여러 기기에서 migration prompt/marker UX 사람 QA.
- migration 이후 guest local save를 삭제/보관하는 최종 UX 정책.
- Record SPECIAL authenticated trusted battle proof.
- 친구/협동 authenticated seat/result binding.
- PvP/social account authority.

## 13. 검증 경계

자동 회귀가 검사하는 것:

- guest v15 → strict account save v2 매핑.
- 성장/재화/기록 핵심 필드 보존.
- impossible resource ledger 거부.
- pristine account 판정.
- preview summary.
- explicit replacement confirmation.
- account+profile+archive batch 구조.
- rollback archive 필드.
- authenticated migration worker routing.
- client preview/commit/rollback transport.
- 자동 merge endpoint 부재.
- populated server 2단 교체 확인.
- 서버 유지/cancel 동작.
- profile preference import와 full progression migration 분리.

자동검증 green만으로 여러 기기 UX와 장기 archive 운영 정책을 `TESTED/LOCKED`로 올리지는 않는다.
