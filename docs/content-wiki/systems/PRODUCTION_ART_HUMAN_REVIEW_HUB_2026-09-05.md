# Production Art Human Review Hub — 2026-09-05

## 목적

production art의 자동 구조/품질 감사가 전 범위에서 `severe=0`, `atRisk=0`, `weakEvolution=0`, `watchEvolution=0`, `clippingRisk=0`까지 정리된 뒤, 실제 사람 검수를 시작하기 위한 단일 진입점을 제공한다.

이 허브는 승인 시스템이 아니다. review mode를 빠르게 열고 브라우저 로컬 체크를 남길 수 있게 할 뿐이며, provenance / reviewer / reviewedAt / approval evidence를 생성하거나 수정하지 않는다.

## 공개 경로

- `/assets/production/review/index.html`
- `/assets/production/review/production-review-master.json`

허브는 다음 11개 기존 review mode를 한 화면에서 연다.

1. `?productionReview=first-slice`
2. `?productionReview=second-slice`
3. `?productionReview=third-slice`
4. `?productionReview=fourth-slice`
5. `?productionReview=fifth-slice`
6. `?productionReview=sixth-slice`
7. `?productionReview=chapter-02`
8. `?productionReview=chapter-03`
9. `?productionReview=chapter-04`
10. `?productionReview=special-content`
11. `?productionReview=recruitment`

## 허브가 표시하는 정보

각 카드는 해당 runtime metadata를 직접 읽어 다음을 생성한다.

- review route
- 대상 수
- motion strip 수
- 현재 review state
- `normalRuntimeAuthoritative`
- `generativeAiUsed`
- source policy가 metadata에 존재하는 경우 해당 값

상단에는 `production-art-quality-audit.json`의 최신 machine readiness 요약을 함께 표시한다.

## 로컬 체크리스트

각 review mode마다 다음 네 항목을 브라우저 localStorage에만 저장한다.

- 실루엣/형태 구분
- idle / move / attack 동세
- 크기 / 겹침 / 클리핑
- 실전 배경/전투 문맥 가독성

이 체크는 개인 탐색 편의를 위한 로컬 메모다. 정본 review package나 human approval 상태에는 어떤 영향도 주지 않는다.

## 자동 검증

`tools/validate-production-review-hub.mjs`는 다음을 강제한다.

- review mode 정확히 11개
- route 중복 없음
- route와 실제 runtime module의 query 값 정합
- metadata target/strip count 정합
- 모든 target에 idle/move/attack/knockback/death 존재
- 승인 상태로 승격되지 않았음
- 명시된 `normalRuntimeAuthoritative`는 false
- 명시된 `generativeAiUsed`는 false
- machine readiness가 severe/atRisk/weak/watch/clipping 전부 0
- HTML에 UNAPPROVED 및 NOT APPROVAL EVIDENCE 경고 존재
- local checklist가 reviewer identity / reviewedAt를 기록하지 않음

## 권한 경계

이 작업 후에도 다음은 그대로 유지한다.

- human review: PENDING / UNREVIEWED
- normal runtime authority: false
- generative AI: false
- `PRODUCTION_UNIT_ART_CANDIDATES`: 사람 승인 전 비권위 상태 유지

사람 검수에서 문제를 발견하면 해당 production 후보를 수정하고 다시 자동 검증을 통과시킨다. 허브의 체크박스를 모두 눌렀다는 사실만으로는 어떤 후보도 승인되지 않는다.
