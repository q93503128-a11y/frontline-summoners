# PvP 최초 티어 도달 보상 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_SERVER_GRANTED_FIRST_REACH_REWARDS`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/PVP_RANKING_MMR_REWARDS.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

## 1. 구현 목적

PvP 랭킹 설계에서 재화 수치만 실제 지급되고 장식 보상은 `cosmeticDesignNote`로만 남아 있던 부분을 실제 계정 보상으로 닫는다.

랭킹전 정산 뒤 서버의 authoritative `bestMmr`를 기준으로 아직 받지 않은 모든 최초 도달 보상을 누적 지급한다. 클라이언트가 티어 또는 장식 소유권을 자기신고하지 않는다.

## 2. 최초 도달 보상 매핑

| 티어 | 재화 | 실제 프로필 장식 |
| --- | --- | --- |
| Silver | Gold 5,000 / 모집재화 100 / soul essence 40 | 없음 |
| Gold | Gold 10,000 / 모집재화 200 / soul essence 80 / evo fragment 8 | `title_pvp_gold` |
| Platinum | Gold 18,000 / 모집재화 300 / soul essence 140 / evo fragment 15 | `frame_pvp_platinum` |
| Diamond | Gold 30,000 / 모집재화 500 / soul essence 240 / evo core 2 | `title_pvp_diamond`, `frame_pvp_diamond` |
| Master | Gold 45,000 / 모집재화 700 / soul essence 360 / evo core 3 | `banner_pvp_master` |
| Grandmaster | Gold 60,000 / 모집재화 900 / soul essence 500 / evo crown 1 | `emblem_pvp_grandmaster` |
| Frontline Apex | Gold 80,000 / 모집재화 1,200 / soul essence 700 / evo crown 1 | `frame_pvp_apex` |

Diamond의 테두리는 이미 업적 catalog에 존재하는 `frame_pvp_diamond`를 공용한다. 업적 수령과 최초 도달 보상이 같은 소유권을 가리켜도 profile grant는 idempotent하므로 중복 소유권이 생기지 않는다.

## 3. authoritative 지급 경로

- `packages/sim/src/pvp-content.ts`
  - 최초 도달 reward definition에 `cosmeticRewardIds`를 canonical data로 저장한다.
- `packages/sim/src/achievement-profile.ts`
  - Gold/Platinum/Diamond/Master/Grandmaster/Frontline Apex용 실제 프로필 장식을 catalog에 등록한다.
- `apps/server/src/pvp-reward-authority.ts`
  - 기존 D1 first-reach receipt와 account-save 재화 지급을 유지한다.
  - 재화 지급 후 `grantAccountProfileCosmetics`로 profile ownership을 영구 지급한다.
- `apps/server/src/pvp-result-authority.ts`
  - 랭킹 정산 응답에 tier별 `cosmeticRewardIds`와 실제 새로 지급된 `newlyGrantedCosmeticIds`를 포함한다.
- `apps/client/src/pvp-network.ts`
  - WELCOME의 authoritative account id와 정산 reward payload를 정식 타입으로 보존한다.

## 4. 부분 성공 복구

account save와 account profile은 서로 다른 revisioned snapshot이다.

따라서 재화 receipt가 이미 존재해도 현재 `bestMmr`가 의미하는 모든 장식 소유권을 정산 재시도 때 다시 확인한다.

예:
1. Gold 최초 도달 재화 + receipt 저장 성공.
2. 순간적인 profile write 실패.
3. 정산 재시도.
4. Gold 재화는 receipt 때문에 중복 지급되지 않음.
5. `title_pvp_gold`만 profile grant로 복구.

## 5. 현재 경계

- 보상 수치 자체는 정본의 `DESIGN_TARGET`을 그대로 구현했으며 사람 경제 QA 전까지 `TESTED/LOCKED`로 승격하지 않는다.
- 시즌 종료 명예 장식은 별도 `PVP_SEASON_HONOR_PROFILE_IMPLEMENTATION_2026-08-31.md` 경로를 유지한다.
- 2v2 ranked는 1차 완성 범위 밖이므로 이 보상표에 추가하지 않는다.
- 실제 장식 미술 asset 제작은 production art 단계의 별도 작업이다. 현재 단계는 소유권/지급/장착 가능한 content identity를 닫는 구현이다.
