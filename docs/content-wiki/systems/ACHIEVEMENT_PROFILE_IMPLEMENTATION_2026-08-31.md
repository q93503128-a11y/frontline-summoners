# Achievement / Profile Runtime Implementation — 2026-08-31

상태: `IMPLEMENTED_GUEST_AND_ACCOUNT_PROFILE_AUTHORITY`

이 문서는 `ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`의 초기 업적/프로필 설계를 현재 실행 코드에 내린 범위와 남은 권위 경계를 기록한다. 기획 정본을 대체하지 않는다.

## 1. 실행 카탈로그

공용 `@frontline/sim/achievement-profile`에 초기 업적 **50개**와 프로필 장식 카탈로그를 등록했다.

업적 분류:

- MAIN 8.
- SPECIAL 8.
- GROWTH 10.
- CODEX 4.
- COOP 4.
- PVP 6.
- RECORD 6.
- QUIRK 4.

모든 업적은 `repeatable: false`이며 고유 achievement id를 사용한다. 장식 보상 id는 achievement id와 분리한다.

프로필 장식 종류:

- TITLE.
- FRAME.
- BANNER.
- EMBLEM.
- BADGE.

기본 프로필은 `frame_default_wood`, `banner_default_frontline`, `emblem_default`를 가진다.

## 2. 공용 evaluator

업적 화면에 거대한 조건 if 사슬을 박지 않고 typed requirement + 공용 evaluator를 사용한다.

현재 requirement:

- MAIN stage clear / clear count.
- SPECIAL stage clear / unique clear count / collection final clear set.
- character max Base Lv / +Lv.
- F2/F3 unlock count.
- owned character count.
- discovered enemy count.
- unique co-op clear count.
- endless best minute.
- boss-rush defeated high-water.
- PvP tier reached.
- future authoritative boolean fact.

친구/PvP/기묘 조건의 실제 event source가 추가되어도 업적 UI 조건 분기를 다시 설계할 필요가 없다.

## 3. 게스트 진행 연결

`apps/client/src/achievement-profile.ts`는 guest progress에서 직접 다음 축을 읽는다.

- MAIN NORMAL_CLEAR.
- SPECIAL clear history.
- 캐릭터 ownership.
- Base Lv / +Lv.
- F2/F3 unlocked form.
- enemy discovery.
- `COOP_BATTLE` NORMAL_CLEAR provenance.
- 끝없는 전선 best minute.
- 보스 러시 best defeated.

완료 업적은 별도 수령 버튼 없이 즉시 claimed set에 들어간다. claimed id와 장식 ownership은 set 기반으로 정규화해 같은 완료를 다시 읽어도 중복 지급하지 않는다.

## 4. 게스트 프로필 저장

전투/경제 guest save v15를 확장하지 않고 장식 선택 상태를 별도 local meta store로 분리했다.

key:

- `frontline-summoners:achievement-profile:v1`

저장:

- claimed achievement ids.
- owned cosmetic ids.
- profile loadout.
- future fact ids.
- optional best PvP tier.

profile loadout:

- representative character 0..1.
- title 0..1.
- frame 1.
- banner 1.
- emblem 1.
- badge 0..3.

알 수 없는/stale cosmetic id는 버리고, 미보유 장식을 장착할 수 없으며 badge는 최대 3개로 정규화한다. 이 store는 resource ledger를 변경하지 않는다.

## 5. 계정 authoritative profile 저장

account save v2의 전투/경제 revision과 프로필 꾸미기 revision을 분리했다.

D1 migration:

- `apps/server/migrations/0009_account_profile_authority.sql`

테이블:

- `account_profiles`
  - account당 1 row.
  - profile schema v1.
  - 독립 monotonic revision.
  - canonical profile snapshot.
- `account_profile_mutation_receipts`
  - `(user_id, request_id)` unique.
  - input fingerprint.
  - resulting revision.
  - exact mutation result.

따라서 프레임/배너를 바꾸는 동작이 전투 결과나 경제 mutation의 account save v2 revision과 불필요하게 충돌하지 않는다.

계정 profile snapshot:

- claimed achievement ids.
- owned cosmetic ids.
- profile loadout.
- server-only fact ids.
- optional server-only PvP best tier.

## 6. 계정 업적 권위

`apps/server/src/account-profile-authority.ts`가 account save v2를 입력으로 업적을 서버에서 다시 계산한다.

서버가 직접 읽는 축:

- MAIN/SPECIAL progression.
- Base Lv / +Lv.
- F2/F3 unlock.
- owned characters.
- enemy discovery.
- `COOP_BATTLE` clear provenance.
- record high-water.

완료된 업적은 account profile을 읽거나 갱신할 때 자동 claim된다.

장식 ownership은 **저장된 arbitrary cosmetic list를 신뢰하지 않고** 다음에서 재구성한다.

- 기본 장식.
- 서버가 인정한 claimed achievement의 cosmetic reward.

따라서 client가 `frame_pvp_master`, `badge_boss_8` 같은 알려진 cosmetic id를 임의로 보내거나 저장값을 위조해도 해당 업적 claim이 없으면 소유권이 생기지 않는다.

## 7. 공개 profile API 경계

Bearer-authenticated route:

- `GET /api/account/profile`
- `POST /api/account/profile`

GET 응답:

- profile-local revision.
- schemaVersion.
- canonical profile snapshot.
- achievement evaluations.
- completed count.

POST가 받는 business input은:

- requestId.
- expected profile revision.
- profileLoadout.

공개 client가 다음을 자기신고하는 route는 없다.

- claimedAchievementIds.
- ownedCosmeticIds.
- factIds.
- pvpBestTier.

`factIds`와 PvP tier를 기록하는 함수는 server-internal hook으로만 존재하며 실제 친구/PvP/QUIRK authority가 연결될 때 호출한다.

## 8. profile mutation / idempotency

프로필 장착 변경은 profile-local revision CAS + receipt insert를 D1 batch에 함께 넣는다.

- 같은 requestId + 같은 input 재전송: exact replay.
- 같은 requestId를 다른 input에 재사용: idempotency conflict.
- stale profile revision: revision conflict.
- CAS 실패 시 CHECK rollback으로 profile/receipt 반쪽 commit 방지.
- account save v2 revision은 변경하지 않는다.

## 9. 계정 client profile state

`apps/client/src/account-profile-network.ts`:

- 같은 authenticated Bearer session을 사용.
- 별도 profile read cache 사용.
- cache는 session-token SHA-256 fingerprint에 묶임.
- live memory의 current profile도 session fingerprint에 묶여 계정 전환 뒤 이전 계정 revision을 재사용하지 않는다.
- ONLINE: server GET/POST 가능.
- OFFLINE_CACHE: fingerprint가 맞는 cached profile만 읽기.
- GUEST_LOCAL: account profile 없음.
- offline profile mutation queue는 만들지 않았다.

`ProfileScene`:

- guest: local editable.
- authenticated online: server-authoritative editable.
- authenticated offline cache: read-only.
- profile mutation pending 동안 연속 장착 입력 차단.
- revision conflict/네트워크 실패 시 임의 자동 재실행하지 않음.

## 10. 명시적 guest profile preference import

계정 화면에 `게스트 프로필 가져오기`를 추가했다.

이 기능은 **전체 guest save migration이 아니다**.

온라인 로그인 계정에서 명시적으로 눌렀을 때 오직 guest의 현재 `profileLoadout` 선호만 서버 profile mutation으로 보낸다.

전송하지 않는 것:

- guest claimed achievement ids.
- guest owned cosmetic ids.
- guest fact ids.
- guest PvP tier.
- guest progression/economy snapshot.

서버는 가져온 loadout을 현재 account가 실제 소유한 캐릭터/장식에 대해 다시 normalize한다. 따라서 게스트에서 장착하던 장식이 account에서 미해금이면 적용되지 않는다.

이는 `guest → populated account`를 자동 병합하지 않는 account save 원칙과 맞는다.

아직 남은 별도 기능:

- guest 전투 진행/재화/캐릭터 ownership 전체를 빈 account로 이전하는 transaction.
- guest와 이미 진행된 server account가 동시에 있을 때 선택/충돌 UX.

## 11. 플레이어 UI

`ProfileScene`은 메인 메뉴 `프로필·업적`에서 진입한다.

왼쪽 profile card:

- guest/account online/account offline 권위 표시.
- 대표 캐릭터.
- 칭호.
- 프레임.
- 배너.
- 문장.
- 대표 배지 0..3.
- MAIN/SPECIAL/업적 진행 요약.

오른쪽 achievement list:

- 전체 + 8 category filter.
- pagination.
- 현재/목표 progress.
- 완료 표시.
- 확정 cosmetic reward 이름.
- 미완료 QUIRK는 `??? / 조건 비공개`.

manual reward mailbox/claim button은 만들지 않았다.

## 12. 경제 보상 경계

상세 위키에는 일부 업적에 Gold/모집재화/소탕권 보상 후보가 있으나 정확한 수량은 현재 LOCKED가 아니다.

따라서 현재 구현은:

- 확정 가능한 cosmetic reward만 실제 ownership에 지급.
- 미확정 resource reward는 `designRewardNote`로만 기록.
- 임의 Gold/Crystal/Ticket 수량을 생성하지 않음.
- achievement completion이 resource ledger를 변경하지 않음.

경제 사람 QA 뒤 정확한 수량이 확정되면 server-authoritative reward mutation으로 추가해야 한다.

## 13. 아직 미구현인 업적 event source

카탈로그/evaluator/profile authority가 있다는 것과 아래 실제 이벤트 권위가 있다는 것은 다르다.

남은 것:

- 친구와 첫 협동.
- 재접속 후 승리.
- PvP 첫 랭킹/친선 및 tier authority.
- QUIRK 4종 battle fact source.
- `codex_main_core_complete`의 최종 authoritative fact source가 필요하다면 해당 도감 정의와 함께 연결.

현재 이 조건들은 false/default 상태를 유지하며 client 자기신고로 열 수 없다.

## 14. production 잔여

- exact resource reward 경제 검증.
- 친구/협동/PvP/QUIRK trigger source 연결.
- 완료 toast/card 연출.
- cosmetic production art.
- 프로필 공유/친구/랭킹 화면 연계.
- 모바일/PC viewport 및 실제 터치 QA.
- 전체 guest progression → account migration/conflict UX.

## 15. 자동 검증 기준

자동 회귀가 검사하는 것:

- 정확히 50개 initial achievement.
- unique achievement/cosmetic ids.
- 공용 typed evaluator.
- MAIN/SPECIAL/GROWTH/CODEX/COOP/RECORD progress 계산.
- future fact/PvP tier gate.
- hidden QUIRK visibility.
- guest claimed cosmetic idempotency.
- server progression 기반 account auto-claim.
- forged cosmetic ownership 거부.
- profile loadout owned-only normalization + badge 3 cap.
- account profile independent revision.
- profile D1 receipt/idempotency structure.
- public API가 loadout 외 claim/fact/tier를 받지 않음.
- account profile cache/live memory의 session fingerprint binding.
- online edit / offline read-only UI wiring.
- explicit guest import가 loadout만 전송함.
- account profile mutation이 account save v2 revision을 변경하지 않음.
- unresolved economy reward 미발행.

최종 코드 기준:

- `b6a3c7a640269cc59fe83e9e60dbca332ac78bff`
- **CI #813 전체 green: typecheck / content schema / simulation / server / client / build**.

자동 테스트 green만으로 UX와 경제를 `TESTED/LOCKED`로 승격하지 않는다.
