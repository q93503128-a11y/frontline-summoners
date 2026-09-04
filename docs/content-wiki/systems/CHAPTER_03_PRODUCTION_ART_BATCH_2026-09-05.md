# 제3장 Production Art Batch — 2026-09-05

상태: `IMPLEMENTED / UNREVIEWED`

## 범위

- 제3장 `main_03_001` ~ `main_03_020`
- 신규 일반 적 8종 + 보스 2종
- 총 10타깃 × `idle / move / attack / knockback / death` = 50 motion strips
- 신규 전장 테마 없음
- 기존 production 전장 `golden / ruins / moon / fortress / canyon / burning` 재사용

## 신규 production 후보

### ARCANE

- `enemy_ch3_glasseye` — 유리눈 마도체: 몸 없는 유리 안구 + 3개 얇은 다리, 26F 중거리 contact 언어
- `enemy_ch3_spellbug` — 주문먹는 벌레: 책장/두루마리를 물어뜯는 저신장 러셔, 5F 초고속 contact
- `enemy_ch3_floating_library` — 떠다니는 서고: 6개 책장 궤도 + 중앙 빈 의자, 76F 장거리 포격 예고
- `enemy_ch3_arcane_battery` — 마도포대: 4족 구조물 + 다중 마법진 포신, 98F 초장거리 충전

### DEMON

- `enemy_ch3_inkdemon` — 잉크마귀: 낮은 먹물 웅덩이에서 팔/뿔이 솟는 3hit 근거리 실루엣
- `enemy_ch3_chain_demon` — 사슬악마: 팔 대신 사슬 고리, 40F AREA Push contact
- `enemy_ch3_contract_enforcer` — 계약집행관: 계약서 판 갑주가 몸을 감싼 고HP 전열

### ARCANE + DEMON

- `enemy_ch3_torn_mirror` — 찢어진 거울수: 빈 중심을 깨진 거울 조각이 사람 모양으로 둘러싼 변칙체, 28/40F 2hit

### 보스

- `boss_ch3_archmagus` — 제7첨탑의 대마도장: 중앙 마도핵 + 7개 첨탑 순차 점등, 96/108F 장거리 2hit
- `boss_ch3_belzar` — 계약대공 벨자르: 계약 인장 갑주 + 세 갈래 집행 칼날, 28/36/48F 중근거리 3hit

## 생산 정책

- `generativeAiUsed: false`
- `sourcePolicy: PROJECT_AUTHORED_DETERMINISTIC_ONLY`
- 외부 sprite/source art를 사용하지 않는다.
- normal runtime authority는 부여하지 않는다.
- 사람 승인 전까지 `AWAITING_ART / PENDING / UNREVIEWED_RUNTIME_FILES`를 유지한다.
- `PRODUCTION_UNIT_ART_CANDIDATES` 승격 금지.

## 구현 파일

- `assets/raw/production/chapter-03-production-01.json`
- `tools/materialize-chapter-03-production-art.mjs`
- `tools/validate-chapter-03-runtime-files.mjs`
- `apps/client/src/chapter-03-production-review-runtime.ts`
- `apps/client/src/chapter-03-production-review-battlefields.ts`

리뷰 진입:

`?productionReview=chapter-03`

## 전장 재사용

제3장 ST01~20에서 사용하는 테마는 모두 기존 production layer가 존재하므로 장 전용 복제본을 만들지 않는다.

- golden
- ruins
- moon
- fortress
- canyon
- burning

## 완료 기준

`npm run assets:production:runtime:chapter-03:check`가 다음을 보장한다.

- 10 target / 50 strip 존재
- PNG frame dimension 일치
- metadata byte length / SHA-256 일치
- chapter 내부 strip SHA 중복 없음
- 6개 재사용 battlefield의 base/background/foreground 존재
- lifecycle / AI / runtime-authority 정책 유지

이 문서는 자동 생성물을 사람 검수 증거로 승격하지 않는다.
