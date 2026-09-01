# 협동 숨김 업적 좌석 귀속 구현 — 2026-09-01

상태: **IMPLEMENTED / automated coverage authored / human multiplayer QA pending**

## 목적

협동전은 두 플레이어가 하나의 PLAYER 팀 BattleState를 공유한다. 기존 전투 숨김 업적 판정기를 팀 전체에 적용하면 서로 다른 플레이어의 유닛이 합쳐져 한 계정의 업적으로 잘못 귀속될 수 있다. 이 구현은 전투 판정 자체를 바꾸지 않고 이미 존재하는 `ownerBySimulationId`를 이용해 판정 source를 좌석 A/B로 분리한다.

## 구현

- `captureCombatQuirkFrame` / `resolveCombatQuirkFacts`에 선택적 PLAYER-unit predicate를 추가했다. 기본값은 전체 PLAYER 유닛이므로 SOLO 동작은 유지된다.
- `applyCoopPlayableFrame`은 같은 authoritative frame에서 A/B 각각 capture → 공용 30Hz step → A/B resolve를 수행한다.
- 대상 적과 적 기지는 공용 전장 그대로 사용한다. 종껍질 게와 태엽오리기사 판정은 실제 공유 적을 보되 공격 source만 소유 좌석으로 제한된다.
- `quirk_turnip_five`는 각 좌석 소유 순무기수만 센다. A 3기 + B 2기는 누구에게도 5기 업적으로 처리되지 않는다.
- Durable Object는 프레임에서 발생한 fact를 `combatQuirkFactIdsBySeat`에 좌석별 union으로 누적한다. 필드는 optional이라 기존 `coop-room-v5` 저장값도 읽을 수 있다.
- 인증 계정 settlement 시 승리/패배와 무관하게 해당 좌석에 누적된 canonical combat quirk fact만 `recordAccountAchievementFact`로 기록한다. 이 세 숨김 업적 정의가 승리를 요구하지 않기 때문이다.
- 클라이언트 제출값으로 업적 fact를 만들지 않는다. 판정과 귀속은 simulation + Durable Object + account authority만 사용한다.

## 자동 회귀 범위

- 협동 A 3기 + B 2기 순무기수가 섞여도 어느 좌석도 `quirk_turnip_five`를 얻지 않는 테스트를 추가했다.
- 같은 전투에서 A가 자체 5기를 채우면 A만 fact를 받는 테스트를 추가했다.
- 서버 wiring 테스트는 per-seat 누적과 승패 공통 account settlement 경로를 고정한다.

## 남은 검증

실제 두 계정/두 브라우저 협동에서 세 숨김 업적 각각을 달성해 프로필 업적/장식 해금까지 확인하기 전에는 TESTED 또는 LOCKED로 승격하지 않는다.
