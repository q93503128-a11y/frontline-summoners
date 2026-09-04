# Fifth Production Slice — Chapter 01 ST14–18

상태: `AWAITING_ART / PENDING / UNREVIEWED`

정본 계약: `assets/raw/production/fifth-slice-late-wave-05.json`

## 범위

- ST14 `검은 깃발` — burning 재사용
- ST15 `두꺼운 관문` — fortress 재사용
- ST16 `후열 봉쇄선` — ruins 재사용, 이단주술사 해금
- ST17 `철퇴 난전` — golden 재사용
- ST18 `마지막 보급로` — meadow 재사용, 제1장 일반 병력 총출동

## 신규 production 후보

- 이단주술사 F1 `heretic_f1`
- 금단의 의식자 F2 `heretic_f2`
- 역주술사 F3 `heretic_f3`
- 검은 깃발지기 `enemy-cultist`
- 달림개 `enemy-sprinter`

총 5타깃 × idle/move/attack/knockback/death = 25 motion strips.

달림개는 인간형 CC0를 변형하지 않고 `project-authored-beast` deterministic sprite로 제작한다. 정본에서 확인 가능한 BEAST, 높은 이동속도, 7F 빠른 단일 contact만 시각 언어에 반영하고 별도 미확정 설정을 추가하지 않는다.

## Review runtime

`?productionReview=fifth-slice`

선택형:

- `hereticForm=f1`
- `hereticForm=f2`
- `hereticForm=f3`

이 모드는 presentation-only다. simulation, progression, save, production approval authority를 변경하지 않는다.

## Lifecycle

자동 materialization이나 CI 성공은 review evidence가 아니다. 사람 캡처와 명시적 승인 전에는 `PRODUCTION_UNIT_ART_CANDIDATES`에 넣지 않으며 normal runtime-authoritative로 승격하지 않는다.
