# 첫 Production Concept Candidate — 2026-09-02

상태: `DESIGN_TARGET / candidate v2 selected for development / runtime promotion forbidden / human review pending`

첫 실제 시각 작업은 징집병 F1/F2/F3와 약탈병의 흑백 측면 실루엣 비교판으로 제한한다. 이 파일은 최종 sprite, `READY_FOR_REVIEW` evidence, 사람 승인 기록이 아니다.

## v1 판정 — 유지

통과:

- 4종만 포함
- 동일 측면/접지선 비교
- F3의 낮은 공격 자세
- 약탈병의 한쪽 대형 등짐
- 색에 의존하지 않는 비교

수정 필요:

- F1/F2 무기가 정본의 짧은 실용 무기보다 김
- 작은 크기에서 F1/F2 외곽이 아직 지나치게 비슷함
- F1의 급조 장비 외곽과 F2의 정돈된 장비 외곽 차이를 더 키워야 함

따라서 v1은 계속 `REVISION_REQUIRED`다. v1 파일과 실패 사유를 삭제하거나 성공작으로 재분류하지 않는다.

## v2 제작 반영

v2는 v1 실패 사유만 직접 수정했다.

### F1 징집병

- 무기를 몸 가까이에서 끝나는 짧은 실용 무기로 줄임
- 배낭을 F2보다 작고 비정형으로 정리
- 천/가죽 장비의 흐트러진 밑단과 돌출 끈으로 바깥 외곽을 불규칙하게 만듦
- 직립 기본 자세는 유지

### F2 정규보병

- F1보다 체형이나 갑옷량을 키우지 않음
- 사각 배낭, 규칙적인 어깨 보호구, 정돈된 허리 장비로 외곽을 직선적으로 정리
- 창도 짧게 유지하되 창날과 창대의 축을 규격화
- F1과의 차이는 덩치가 아니라 `정돈 정도`에서 읽히게 함

### F3 노련한 전선병

- v1에서 통과한 낮고 공격적인 전진 자세 유지
- 짧은 실전형 무기 축 유지
- 갑옷 증량/훈장/화려한 장식 없음
- 마모된 장비 외곽만 남기고 상체를 전방으로 낮춤

### 약탈병

- 한쪽 대형 등짐이 작은 손무기보다 먼저 읽히는 구조 유지
- 등짐 외곽에 훔친 물건이 튀어나온 비대칭을 강화
- 본체 체형은 일반 인간형 범위를 넘겨 키우지 않음

## 실제 축소·흑백 판독

v2 원본 자체가 grayscale이며, 같은 파일 하단에 각 실루엣을 **25% 크기로 실제 축소한 판독 스트립**을 포함했다.

v1에서 기록된 세 실패 항목을 기준으로 v2 축소판을 다시 대조한 결과:

- F1/F2 무기 길이: `PASS` — 둘 다 짧은 실용 무기 범위로 축소
- F1/F2 작은 크기 외곽 구분: `PASS` — F1의 비정형 등짐/밑단과 F2의 사각 등짐/직선형 외곽이 분리됨
- F1 급조 장비 vs F2 정돈 장비: `PASS` — 색을 제거한 상태에서도 외곽 질서 차이가 남음
- F3 낮은 공격 자세: `PASS`
- 약탈병 대형 비대칭 등짐 우선 판독: `PASS`

따라서 v2는 concept 단계에서 `SELECTED_FOR_DEVELOPMENT`로 기록한다.

이 판정은 **다음 제작 패스에 사용할 방향을 선택했다는 의미만 가진다.** runtime sprite, formal review evidence, `READY_FOR_REVIEW`, `APPROVED`, `humanReviewComplete`로의 승격을 뜻하지 않는다.

## 현재 lifecycle

- `militia-raider-silhouette-v1`: `REVISION_REQUIRED`
- `militia-raider-silhouette-v2`: `SELECTED_FOR_DEVELOPMENT`
- production target 6개: 전부 `AWAITING_ART`
- review package human review: 전부 `PENDING`
- v2 `mayBeRuntimeArt=false`
- v2 `maySatisfyReviewEvidence=false`

황금가면 사령술사와 meadow 전장은 이번 v2에 포함하지 않았다. 두 대상도 계속 `AWAITING_ART`다.

## 자동 검증

기계 정본:

`assets/raw/production/concept-candidates-01.json`

검사기:

`tools/validate-production-concept-candidates.mjs`

루트 통합 gate:

`npm run assets:production:check`

concept validator는 v1 기록 보존, candidate 파일 SHA/PNG 크기, 대상 id, disposition, 선택 후보의 빈 failure 목록, runtime/review 승격 금지를 검사한다.

contact frame 숫자는 이 문서에 다시 복제하지 않는다. 정확한 timing은 `ANIMATION_CONTACT_FRAME_TARGETS.md`와 실제 runtime이 유일한 권위다.
