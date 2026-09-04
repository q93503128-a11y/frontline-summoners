# 제1장 Production Art Coverage — 2026-09-04

상태: `AWAITING_ART / UNREVIEWED / PENDING`

이 문서는 제1장 production 후보 제작 범위를 한 곳에 요약한다. 자동 materialization, CI 통과, review mode 표시는 인간 승인이나 normal-runtime authority가 아니다.

## 스토리 아군

제1장 스토리 10종의 F1/F2/F3 production 후보가 모두 존재한다.

1. 징집병 / 정규보병 / 노련한 전선병
2. 방벽기사 / 성문수비대 / 이동 성벽
3. 수렵창병 / 큰짐승 사냥꾼 / 왕실 수렵대
4. 결투검사 / 검무가 / 일섬검객
5. 청창대 / 장창방진 / 파진창대
6. 전투마도사 / 전선술사 / 포격마도사
7. 화염술사 / 화로지기 / 재앙의 화염술사
8. 왕실기사 / 근위대장 / 왕의 검
9. 이단주술사 / 금단의 의식자 / 역주술사
10. 공허현자 / 틈새의 현자 / 공허를 본 자

## 제1장 적

제1장 ST01~20에서 사용하는 일반 적 및 보스의 production 후보가 모두 존재한다.

- 약탈병
- 달림개
- 긴목창잡이
- 냄비방패
- 검은 깃발지기
- 유리봉 사수
- 굴렁통 멧돼지
- 철퇴 난동꾼
- 황금가면 사령술사
- 철문장군

BEAST인 달림개/굴렁통 멧돼지는 인간형 CC0를 강제 변형하지 않고 project-authored deterministic sprite를 사용한다.

## 전장

제1장에 쓰이는 production battlefield theme 후보는 meadow, canyon, ruins, fortress, burning, moon, golden을 현재 slice들이 공유한다. ST19은 moon, ST20은 fortress를 재사용한다.

## Final review mode

`?productionReview=sixth-slice`

- ST19: 기존 황금가면 production 후보 + moon battlefield
- ST20: 황금가면 + 철문장군 production 후보 + fortress battlefield
- `voidsageForm=f1|f2|f3`로 공허현자 형태 강제 확인 가능

## Authority

`PRODUCTION_UNIT_ART_CANDIDATES`는 인간 승인 전까지 비워 둔다. 모든 slice의 자동 생성 파일과 review mode는 presentation/review candidate이며 normal runtime 정본이 아니다.
