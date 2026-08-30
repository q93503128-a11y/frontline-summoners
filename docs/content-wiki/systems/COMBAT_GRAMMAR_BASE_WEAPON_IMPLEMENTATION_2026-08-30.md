# 전투 Grammar / 거점 병기 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_RUNTIME_AND_COOP_FLOW`

이 문서는 실행 사실 기록이다. 설계 권위는 `docs/CANONICAL.md`와 `docs/content-wiki/systems/BASE_WEAPON_SYSTEM_V1.md`에 있다.

## 전투 grammar 구현

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
- `main_01_009`의 `killSupplyMultiplier:1.05`가 실제 kill supply +5%로 작동.
- 위 규칙은 client solo와 server authoritative co-op 양쪽에서 같은 데이터/grammar를 사용한다.

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

## 해금 / 저장 / 솔로 장착

- 전선포격기: 기본.
- 결계발진기: `main_02_010` NORMAL_CLEAR 후.
- 보급낙하기: `main_03_010` NORMAL_CLEAR 후.
- Save v15 `selectedBaseWeaponId`에 게스트 선택 병기를 durable 저장한다.
- v14 이하 세이브는 v15 migration에서 전선포격기를 기본 선택으로 보정한다.
- 출정 허브의 `병기` 화면에서 해금 상태와 현재 장착 병기를 확인하고 교체한다.
- locked/unknown 선택은 전선포격기로 normalize한다.
- 선택 병기는 일반 솔로 battle factory와 기록 SPECIAL battle factory에 실제 simulation definition으로 전달된다.

## authoritative co-op closure

`BASE_WEAPON_SYSTEM_V1.md`의 팀 공유 1슬롯 규칙을 현재 co-op protocol에 연결했다.

준비방:

- 각 seat는 ready 전에 `SELECT_BASE_WEAPON`으로 병기를 선택한다.
- 각 플레이어는 자신이 해금한 병기만 선택할 수 있다.
- 두 seat가 같은 병기를 선택해야 최종 ready가 성립한다.
- ready 상태에서는 병기 선택을 임의 변경하지 못한다.
- 서버는 전투 생성 전에 양쪽 loadout의 MAIN clear 진행으로 해당 병기 해금을 다시 검증한다.
- 실제 authoritative battle에는 합의된 병기 definition 하나만 주입된다.

전투 중:

- 병기 charge/cooldown은 팀 공유 1개다.
- 두 플레이어 모두 사용 command를 보낼 수 있다.
- 동일 simulation frame에 양쪽 사용 command가 들어오면 lockstep의 결정론적 command 순서에서 먼저 승인된 1회만 적용된다.
- 승인된 사용 seat를 activator로 기록한다.
- client HUD는 로컬 추정 병기명이 아니라 authoritative snapshot의 실제 shared 병기와 사용 상태를 표시한다.

### 보급낙하기 seat ownership

협동의 보급/보급소/생산 cooldown은 플레이어별 독립 경제이므로 보급낙하기가 shared wallet을 만들지 않는다.

- 슬롯과 cooldown은 팀 공유.
- 효과 owner는 실제 사용이 승인된 activator seat다.
- 30F hit frame에서 activator의 그 시점 `maxSupply`로 지급량을 계산한다.
- `clamp(round(maxSupply * 0.18), 120, 900)`을 activator 개인 경제에 적용한다.
- 지급은 activator의 `currentSupply`에만 들어간다.
- 상대 seat의 보급은 증가하지 않는다.
- 공용/shared dummy supply에는 지급하지 않는다.
- 같은 frame에 양쪽이 눌러도 승인된 한 seat만 owner가 된다.
- client HUD에서도 보급낙하기가 사용자의 개인 보급으로 들어감을 숨기지 않는다.

## 자동검증

- base weapon 단독 runtime: 전선포/결계/보급낙하기 hit frame, cooldown, push/damage-reduction/supply 계산 회귀.
- 협동 shared cooldown authority와 activating seat 기록 회귀.
- 보급낙하기가 activator 개인 경제에만 들어가고 상대/shared wallet에는 들어가지 않는 회귀.
- co-op 준비방 병기 합의/ready 불일치 거부 회귀.
- 양쪽 MAIN clear를 이용한 서버 병기 해금 검증 회귀.
- client READY payload와 authoritative battle HUD shared weapon wiring 회귀.
- 2026-08-30 CI #705에서 typecheck / content schema / simulation / server / client / build 전체 green.

## 아직 별도 작업인 것

- 일반 솔로/협동 HUD와 병기별 VFX/SFX의 production presentation 전수 QA.
- 실제 사람 플레이로 3종 사용률, 오사용 빈도, cooldown/효과량 밸런스 조정.
- authenticated account progression/wallet과 협동 결과 지급의 server-authoritative persistence.
- 거점 병기 강화 단계. v1 정본상 필수는 아님.
