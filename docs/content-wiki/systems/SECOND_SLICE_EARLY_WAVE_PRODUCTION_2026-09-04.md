# Second Slice Early-Wave Production — 2026-09-04

상태: `UNREVIEWED_RUNTIME_CANDIDATES / AWAITING_ART`

첫 production vertical slice의 파이프라인을 제1장 초반 교육 구간으로 확장한다. 이 문서는 승인 문서가 아니며, 실제 runtime screenshot evidence나 human review를 대체하지 않는다.

## 범위

Stage anchors:
- `main_01_002` 먼지길 추격 — canyon
- `main_01_003` 긴 창의 길목 — ruins
- `main_01_004` 녹슨 방패선 — 기존 fortress 배경 유지

Unit candidates:
- 방벽기사 F1 / 성문수비대 F2 / 이동 성벽 F3
- 수렵창병 F1 / 큰짐승 사냥꾼 F2 / 왕실 수렵대 F3
- `enemy-spearman` 긴목창잡이
- `enemy-shield` 냄비방패

총 8 target × 5 motions = 40 generated PNG strips.

## 의도적 보류

`enemy-sprinter` 달림개는 `BEAST`다. 현재 검증된 production source-reference family가 인간형 중심이므로, 사람 스프라이트를 억지로 네발짐승처럼 쓰지 않는다. 적합한 lawful non-humanoid source를 검증하기 전까지 placeholder/source-reference 상태를 유지한다.

## 아트 계약 핵심

### 방벽기사
- 몸보다 큰 직사각 방패가 먼저 읽힌다.
- F1은 목재+철 보강, F2는 성문 톱니형 상단과 고정쇠, F3는 바닥 지지 구조를 포함한 이동 성벽 실루엣.
- 대검/장창을 주어 공격형 기사처럼 만들지 않는다.

### 수렵창병
- 몸보다 긴 얇은 사냥창이 핵심.
- F2는 갈고리/이중날과 전리품, F3는 가장 긴 수평 창대와 표식 끈/작은 깃발.
- 몸통 갑옷 증량으로 형태 차이를 만들지 않는다.

### 긴목창잡이
- 아군 수렵창병과 다른 적군 체형/장비 비율을 유지한다.
- 긴 창과 사각 구조가 작은 화면에서도 읽혀야 한다.

### 냄비방패
- 방벽기사의 직사각 방패와 반대로 둥글고 찌그러진 조리도구 방패가 먼저 읽힌다.
- 느린 단일 벽 역할이 실루엣에서 드러나야 한다.

## 전장

### canyon
- 좌우 절벽 덩어리로 먼지길 추격을 설명한다.
- 중앙 전투 corridor는 저밀도로 유지한다.
- 세로 구조물이 실제 range/obstacle wall처럼 보이면 실패다.

### ruins
- 무너진 국경 석조물과 양쪽의 붕괴 아치를 랜드마크로 둔다.
- 긴 창 교육을 위해 중앙은 비워 둔다.
- foreground 잔해가 유닛 몸통을 가리지 않는다.

## Runtime review

Query:

`?productionReview=second-slice`

Optional form overrides:
- `guardForm=f1|f2|f3`
- `hunterForm=f1|f2|f3`

review mode에서만 production 후보를 사용한다. normal runtime authority는 변경하지 않는다.

## 생성/검증

- materializer: `tools/materialize-second-slice-production-art.mjs`
- validator: `tools/validate-second-slice-runtime-files.mjs`
- batch contract: `assets/raw/production/second-slice-early-wave-02.json`
- generated metadata: `apps/client/public/assets/production/units/second-slice-runtime-metadata.json`

Battlefield roots:
- `apps/client/public/assets/production/battlefields/canyon/`
- `apps/client/public/assets/production/battlefields/ruins/`

## 승인 상태

모든 신규 unit/battlefield candidate는 `AWAITING_ART / UNREVIEWED_RUNTIME_FILES / PENDING`을 유지한다. 자동 생성 strip, deterministic SVG, runtime review 표시만으로 READY_FOR_REVIEW 또는 APPROVED로 올리지 않는다.
