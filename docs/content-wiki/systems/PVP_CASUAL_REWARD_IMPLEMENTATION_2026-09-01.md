# PvP 일반전 일일 Gold 보상 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_SERVER_GRANTED_BOUNDED_CASUAL_GOLD`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/PVP_RANKING_MMR_REWARDS.md`
- `docs/content-wiki/systems/MULTIPLAYER_SOCIAL_PVP.md`

## 1. 구현 목적

일반전이 완전 무보상이라 플레이 이유가 사라지는 문제를 막되, PvP가 반복 파밍 최적해나 일일 숙제가 되지 않도록 보상을 강하게 제한한다.

상위 위키의 `첫 3경기 승패 무관 소량 Gold + 승리 추가 소량 Gold + 희귀 재료 반복 지급 금지` 방향을 실제 계정 보상으로 연결했다.

## 2. 현재 v1 DESIGN_TARGET 수치

1v1 일반전과 2v2 일반전은 **같은 일일 3경기 한도**를 공유한다.

- UTC 기준 하루 첫 3회의 완료된 일반전: 참가 Gold `300`
- 해당 보상 대상 경기에서 승리: 추가 Gold `150`
- 패배/무승부: 참가 Gold만 지급
- 4번째 이후 일반전: Gold `0`
- 모집 재화: `0`
- soul/evolution 희귀 재료: `0`
- 친선전: 보상 없음
- 랭킹전: 이 일일 일반전 한도를 소비하지 않음

따라서 하루 최대치는 3승 기준 `1,350 Gold`다.

이 수치는 사람 경제 QA 전까지 `DESIGN_TARGET`이며 `TESTED/LOCKED`가 아니다.

## 3. 1v1/2v2 공용 한도

별도의 1v1 3회 + 2v2 3회로 쪼개면 플레이어가 보상을 위해 원치 않는 모드까지 의무적으로 돌게 된다.

그래서 다음을 하나로 계산한다.

- `pvp_casual_1v1`
- `pvp_casual_2v2`

두 모드에서 먼저 완료한 3경기만 그날 보상을 받는다.

## 4. 서버 권위 지급

공용 수치는 `packages/sim/src/pvp-casual-rewards.ts`에 둔다.

실제 지급은 `apps/server/src/pvp-casual-reward-authority.ts`가 담당한다.

- 클라이언트가 승패/Gold/일일 횟수를 자기신고하지 않는다.
- 서버에서 확정된 PvP match result만 사용한다.
- 완료 시각을 기준으로 UTC reward day를 고정한다.
- account save의 `resourceLedgerById.gold`에 earned Gold를 추가한다.
- 1v1/2v2 모두 같은 authority를 사용한다.

## 5. 중복 지급 방지와 부분 실패 복구

DB migration `0021_pvp_casual_daily_rewards.sql`에서 match별 receipt를 저장한다.

핵심 키:
- `(user_id, match_id)`는 동일 경기 재지급을 막는다.
- `(user_id, reward_day, reward_slot)`은 하루 1~3번 슬롯만 허용한다.
- 일일 한도 소진 후의 경기 역시 `reward_slot = NULL`, Gold 0 receipt를 남긴다.

Gold가 있는 지급은 account-save revision CAS와 receipt insert를 같은 D1 batch에 넣는다.

또한 PvP result authority는 이미 `COMPLETED` 상태인 match에서도 reward authority를 다시 호출한다. 따라서:

1. 전투 결과/승패 기록 저장 성공
2. 순간 오류로 Gold 지급 실패
3. Durable Object 정산 재시도
4. 기존 match 결과는 다시 올리지 않음
5. 빠진 Gold receipt만 복구

구조가 가능하다.

재시도가 UTC 자정을 넘어가더라도 기존 `pvp_matches.completed_at`을 reward day 기준으로 사용하므로 다음 날 한도를 잘못 소비하지 않는다.

## 6. 현재 적용 범위

- 1v1 일반전: 실제 Gold 지급 연결 완료
- 2v2 일반전: 4명 각각 실제 Gold 지급 연결 완료
- 1v1/2v2 공용 일일 3회 cap 완료
- 랭킹/친선과 보상 경로 분리 완료

현재 result payload에도 reward 정보가 포함되므로 이후 결과 화면에서 `+300`, `+450`, `오늘 3/3 완료` 같은 표시를 직접 붙일 수 있다.

프로덕션 UI 표현과 경제 수치 사람 QA는 별도 후속 단계다.
