# 소탕 / 주기 보상 충전 Save v14 이행 기록

기준: 2026-08-30

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/STAGE_SPEC_SCHEMA.md`
- `docs/content-wiki/systems/REWARD_ECONOMY_AND_SKIP.md`

## 구현 목적

기존에는 NORMAL_CLEAR 이후 `sweepEligibility`가 UI/정책으로만 존재했고 실제 소탕권 소비 transaction이 없었다. 또한 주기 재화 SPECIAL의 보상 충전은 `localStorage`에 별도 저장되어 resource ledger와 하나의 durable transaction을 이루지 못했다.

이번 이행은 다음을 실행 상태로 만든다.

1. prior NORMAL_CLEAR가 있는 전장만 소탕 가능.
2. 소탕 1회당 `sweep_ticket` 정확히 1장 소비.
3. 소탕은 first clear, permanent reward, 신규 캐릭터 해금, 기록 갱신을 만들지 않음.
4. MAIN은 repeat reward만 지급.
5. 일반 SPECIAL/이벤트는 repeat reward만 지급.
6. 주기 재화 SPECIAL은 repeat charged/depleted 규칙을 그대로 사용.
7. 주기전 소탕은 충전이 있으면 1칸 소비하고, 0칸이면 depleted reward를 지급.
8. 기간 외 이벤트/주기전은 save authority에서도 소탕 거부.

## Save v14

`GuestProgress.periodicRewardChargeByCollection`을 추가해 periodic charge를 resource ledger와 같은 IndexedDB guest save에 저장한다.

- schema: v13 → v14
- max charge 4 / 12시간 회복 규칙은 기존 sim 정본 유지.
- stale save merge는 더 적게 남은 charge 상태를 우선해 소비한 충전이 부활하지 않게 한다.
- v13 이하에서 사용하던 `frontline-summoners:periodic-reward-charge:v1` localStorage 값이 있으면 최초 load 때 v14 progress에 보수적으로 merge한다.
- v14 durable persist 성공 후 legacy localStorage key를 제거한다.

기존 v2~v13의 MAIN/캐릭터/모집/record migration 의미는 변경하지 않는다.

## 보상 계산 구조

`special-rewards.ts`는 더 이상 보상 조회 순간 localStorage를 직접 변경하지 않는다.

`resolveSpecialResourceReward(...)`는 다음을 순수 계산 결과로 반환한다.

- `resourceReward`
- `periodicChargeMap`
- `chargeConsumed`
- periodic인 경우 `periodicCollectionId`

실제 save writer가 ticket ledger spend → repeat reward resolve → reward ledger grant → periodic charge map을 하나의 GuestProgress로 구성한 뒤 한 번 persist한다.

## UI

스테이지 선택 카드에서 prior clear + `AFTER_NORMAL_CLEAR`인 경우 소탕 버튼을 제공한다.

- 현재 소탕권 표시.
- 주기 SPECIAL은 현재 보상 충전도 표시.
- 티켓 0이면 비활성.
- 전장 기간/해금이 닫히면 비활성.
- 처리 중 연속 입력 방지.
- 성공 시 받은 재화와 남은 소탕권 즉시 표시.
- IndexedDB persist 실패 시 현재 탭 반영과 영구 저장 실패를 구분해 표시.

## 명시적 비범위

- RECORD SPECIAL은 일반 stage sweep path를 사용하지 않는다.
- PvP는 sweep 대상이 아니다.
- authenticated server wallet/periodic charge sync는 아직 후속이다.
- sweep ticket 대량 사용/횟수 선택 UI는 1차 범위가 아니다. 현재 1회 클릭 = 1회 소탕이다.
