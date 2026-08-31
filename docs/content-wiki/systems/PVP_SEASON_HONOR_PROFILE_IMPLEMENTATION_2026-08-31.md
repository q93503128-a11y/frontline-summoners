# PvP 시즌 명예 → 프로필 장식 구현 메모 — 2026-08-31

상태: `IMPLEMENTED_SERVER_GRANTED_EQUIPABLE_SEASON_HONORS`

상위 정본:
- `docs/content-wiki/systems/PVP_RANKING_MMR_REWARDS.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`
- `docs/content-wiki/systems/MULTIPLAYER_SOCIAL_PVP.md`

## 1. 구현 목적

시즌 정산 화면에서 표시만 되던 PvP 시즌 명예를 실제 계정 프로필 장식 소유권으로 연결한다.

`POST /api/pvp/season/claim-honors` 성공 후 지급된 장식은 기존 프로필 화면에서 다른 영구 장식과 동일하게 장착할 수 있다.

## 2. 시즌 명예와 프로필 장식 매핑

| 시즌 명예 | 조건 | 실제 프로필 장식 |
| --- | --- | --- |
| `SEASON_GOLD_EMBLEM` | Gold 이상 | `emblem_pvp_season_gold` |
| `SEASON_PLATINUM_FRAME` | Platinum 이상 | `frame_pvp_season_platinum` |
| `SEASON_MASTER_TITLE` | Master 이상 | `title_pvp_season_master` |
| `SEASON_TOP_1000_BANNER` | 최종 Top 1000 | `banner_pvp_season_top1000` |
| `SEASON_TOP_100_EMBLEM` | 최종 Top 100 | `emblem_pvp_season_top100` |
| `SEASON_TOP_10_HONOR` | 최종 Top 10 | `badge_pvp_season_top10` |

보상은 누적 조건이다. 예를 들어 Master + Top 10이면 위 조건을 만족하는 장식을 모두 받는다.
배치 5경기를 완료하지 않은 시즌 결과는 시즌 명예 장식을 지급하지 않는다.

## 3. 서버 권위 소유권

`apps/server/src/account-profile-authority.ts`에 `grantAccountProfileCosmetics`를 추가했다.

규칙:
- 서버 catalog에 실제 존재하는 cosmetic id만 허용.
- 계정 프로필 snapshot의 `ownedCosmeticIds`에 영구 저장.
- profile revision CAS 사용.
- 동일 장식 재지급은 no-op.
- public profile mutation은 여전히 `profileLoadout`만 제출할 수 있다.
- 클라이언트는 `ownedCosmeticIds`, achievement claim, PvP tier 등을 자기신고할 수 없다.
- 알 수 없는 cosmetic id는 canonical normalization에서 제거한다.

따라서 시즌 장식 소유권은 서버 내부 grant 경로에서만 추가된다.

## 4. 시즌 수령의 복구 가능 idempotency

시즌 결과의 `honor_claimed_at` 기록과 프로필 장식 grant는 서로 다른 영속 객체다.

그래서 claim HTTP 경로는 최초 요청뿐 아니라 replay 요청에서도 항상 profile grant를 다시 확인한다.

예:
1. 시즌 결과 claim row 저장 성공.
2. 순간적인 D1 오류로 profile grant 실패.
3. 클라이언트가 다시 claim.
4. 시즌 claim은 `replayed = true`.
5. profile grant는 아직 없는 장식만 찾아 복구 지급.

중복 지급 없이 부분 성공을 복구할 수 있다.

## 5. 클라이언트 응답

시즌 명예 claim 응답에 추가:
- `cosmeticIds`: 해당 시즌 명예가 대응하는 전체 프로필 장식 id.
- `newlyGrantedCosmeticIds`: 이번 요청에서 실제 새로 추가된 장식 id.
- `profileRevision`: grant 후 계정 프로필 revision.

시즌 화면은 새 장식이 있으면 실제 지급 개수를 표시한다.
프로필 화면은 온라인 진입 시 authoritative account profile을 다시 읽으므로 별도의 클라이언트 소유권 복제 저장소를 만들지 않는다.

## 6. 현재 장식 범위

현재 구현은 시즌마다 새로운 asset id를 생성하는 방식이 아니라 **시즌 명예 계층별 공용 장식**을 사용한다.

향후 실제 시즌별 미술 리소스가 제작되면 예를 들어 `season_s01`, `season_s02` 단위의 catalog variant로 확장할 수 있다. 그 전까지는 동일 명예 장식을 여러 시즌에서 다시 얻어도 profile ownership은 1회만 유지된다.

## 7. 관련 코드

- `packages/sim/src/achievement-profile.ts`
- `apps/server/src/account-profile-authority.ts`
- `apps/server/src/pvp-season-profile-reward.ts`
- `apps/server/src/pvp-season-http.ts`
- `apps/client/src/pvp-season-network.ts`
- `apps/client/src/pvp-season-scene.ts`
- `apps/client/src/profile-scene.ts`
- `apps/server/test/pvp-season-profile-reward.test.ts`
