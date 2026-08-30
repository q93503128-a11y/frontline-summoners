# 전투 Grammar / 거점 병기 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_RUNTIME_FOUNDATION`

## 이번 구현 범위

- 공용 sim에 HP 구간별 공격 루프 `attackPhases` 추가.
- 공격별 `hitDamages` / `hitEffects`를 추가해 다단히트의 타격별 피해와 상태효과를 정확히 표현.
- 대마도장:
  - HP 100~51% A 반복.
  - HP 50% 이하 A-A-B 반복.
  - A 2hit 피해를 35%/65%로 분리.
- 계약대공 벨자르:
  - 3hit 피해 25%/25%/50%.
  - 마지막 hit만 Push 35%.
  - HP 40% 이하 cycle 약 92F → 82F.
- 공허엔진 제로:
  - 100~61% A-A-B-A-C.
  - 60~31% A-B-C-A-B, B 최대사거리 650.
  - 30% 이하 C-A-B-C, cycle 0.9배.
  - C 3hit 20%/25%/55% 분리.
- `main_01_009`의 `killSupplyMultiplier:1.05`가 더 이상 문자열 설명만이 아니라 실제 kill supply +5%로 작동.
- 위 규칙은 client solo와 server authoritative co-op 양쪽에서 같은 데이터/grammar를 사용.

## 거점 병기 v1 runtime

1. 전선포격기
   - 전투 시작부터 사용 가능.
   - 24F 후 적 유닛 90 피해.
   - 일반 적 60 강제이동, BOSS 20, STRUCTURE 이동 면역.
   - 적 기지 피해 없음.
   - cooldown 900F.

2. 결계발진기
   - 첫 사용 600F 후.
   - 사용 순간 살아 있는 아군 유닛 snapshot만 150F 동안 받는 피해 75%.
   - 사용 후 새로 소환한 유닛은 보호하지 않음.
   - cooldown 1050F.

3. 보급낙하기
   - 첫 사용 750F 후.
   - 사용 30F 후 보급 획득.
   - `clamp(round(maxSupply * 0.18), 120, 900)`.
   - 현재 maxSupply를 넘지 않음.
   - cooldown 1200F.

## 해금 milestone foundation

- 전선포격기: 기본.
- 결계발진기: `main_02_010` 클리어 후.
- 보급낙하기: `main_03_010` 클리어 후.

현재는 runtime catalog와 해금 계산 foundation까지다. 계정 save의 선택 병기 필드와 실제 병기 교체 UI는 후속 연결 대상이다.

## 아직 별도 작업인 것

- 소탕 ticket 실제 소비/즉시 보상 transaction 및 stage-select 버튼.
- 계정에 선택 거점 병기 저장.
- 협동에서 보급낙하기를 누른 플레이어의 개인 보급에 적용하는 seat ownership UX/command 확장.
- 거점 병기 강화 단계. v1 정본상 필수는 아님.
