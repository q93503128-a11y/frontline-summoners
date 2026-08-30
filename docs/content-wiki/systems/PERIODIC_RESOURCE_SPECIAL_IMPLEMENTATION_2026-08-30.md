# 주기 재화 SPECIAL 정식화 구현 기록 — 2026-08-30

상위 정본:
- `docs/content-wiki/stages/special/PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `docs/content-wiki/enemies/SPECIAL_ENEMIES_AND_BOSSES_V1_COMBAT_SPECS.md`

## 구현 범위

- 18개 기존 prototype stage를 canonical ID/수치/웨이브로 교체.
  - `special_gold_convoy_01~05`
  - `special_soul_forge_01~04`
  - `special_evolution_gate_01~05`
  - `special_starlight_rift_01~04`
- dedicated periodic enemy/boss 24종을 실제 client/server enemy registry에 연결.
- 모든 18전장을 `COLLECTION_CHARGE`, `SOLO_OR_COOP`, NORMAL_CLEAR 후 2×/sweep 가능 정책으로 연결.
- 단계 해금:
  - I: `main_01_003`
  - II: `main_01_010` + 이전 단계 NORMAL_CLEAR
  - III: `main_02_020` + 이전 단계 NORMAL_CLEAR
  - IV: `main_03_020` + 이전 단계 NORMAL_CLEAR
  - V: `main_04_010` + 이전 단계 NORMAL_CLEAR
- 72시간 개방 recurring schedule을 client와 authoritative server에서 동일 계산기로 판정.
- 보상 충전:
  - collection별 최대 4회
  - 12시간마다 +1
  - 닫혀 있는 동안도 회복
  - first clear는 충전 미소모
  - repeat는 charged 1회 소비
  - 0회에서도 출격/보상 가능, depleted 보상 지급
- 브라우저 guest charge state는 `frontline-summoners:periodic-reward-charge:v1` local persistence + session fallback으로 유지.

## 일정 정합 교정

초기 구현 후보였던 `120h cycle + 24h stagger`는 4묶음 × 72h 개방 시 평균 동시 개방 수가 2.4가 되어 정본의 `항상 1~2개` 목표를 만족할 수 없다.

따라서 실행값은:

- cycle: 168h (7일)
- open: 72h
- collection offset: 0 / 42 / 84 / 126h

으로 교정했다.

이 구조는:

- 각 collection closed duration = 96h = 4일, 즉 다음 등장 최대 5일 이내
- 한 주기 전체에서 항상 1~2개 collection open
- 서버/클라이언트 동일 deterministic 판정

을 동시에 만족한다.

## 전투 사양 이행

- 황금왕의 운송괴수: A-A-B deterministic loop.
- 천혼의 대제련로: A-B-A-A-B deterministic loop.
- 심층문 수호자: A-A-C-B, C는 80거리 guaranteed Push.
- 붕괴하는 밤: A-C-A-B deterministic loop.
- 최종/중간 전장에서 `BOSS_HP_BELOW` 증원 사용.
- 상세 위키에서 엔진이 직접 표현하지 못했던 일부 보스 HP 연동/연출 후보는 generic trigger가 가능한 범위에서만 구현했고, 새 boss-ID 하드코딩은 추가하지 않았다.

## 경제 사양 이행

- 황금 수송대 first/charged/depleted: 위키 상세 수치 사용.
- 혼의 제련소의 `soul_shard` 가칭은 현재 정식 공용 +성장 재화 `soul_essence`로 연결.
- 진화의 문은 `evo_fragment/evo_core/evo_crown` 사용.
- 별빛 균열은 `summon_crystal` 사용.
- 진화의 문 V charged crown 확률 후보는 반복 RNG 스트레스를 피하기 위해 현재 실행값에서 crown을 확률 드랍으로 만들지 않았다.

## 의도적으로 남긴 것

- periodic enemy 24종 production art/motion. 현재는 generic runtime fallback을 사용하며 별도 회귀 테스트로 이 임시 상태를 명시한다.
- 실제 sweep 실행 및 소탕권 소비 transaction.
- authenticated account/server wallet에 charge state를 병합하는 release-grade persistence.
- 사람 플레이 기반 경제량/난이도 LOCKED 승격.

파일 존재만으로 완료 처리하지 않으며, 위 항목을 제외한 주기 재화 SPECIAL의 전투/해금/availability/charge/reward 실행 경로를 이번 배치의 구현 완료 범위로 본다.
