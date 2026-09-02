# 첫 Production Concept Candidate — 2026-09-02

상태: `DESIGN_TARGET / candidate v1 revision required / runtime promotion forbidden`

첫 실제 시각 작업은 징집병 F1/F2/F3와 약탈병의 흑백 측면 실루엣 비교판으로 제한했다. 이 파일은 최종 sprite, `READY_FOR_REVIEW` evidence, 사람 승인 기록이 아니다.

## v1 판정

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

따라서 v1은 `REVISION_REQUIRED`이며 6개 production target은 모두 `AWAITING_ART`를 유지한다. 다음 후보는 F1 무기/배낭을 더 짧고 불균일하게, F2는 체형을 키우지 않은 채 사각 배낭과 보호구 외곽을 규칙적으로 정리해야 한다.

기계 정본은 `assets/raw/production/concept-candidates-01.json`, 검사기는 `tools/validate-production-concept-candidates.mjs`다. `npm run assets:production:check`가 파일 SHA/PNG 크기/대상/판정/승격 금지를 함께 검사한다.
