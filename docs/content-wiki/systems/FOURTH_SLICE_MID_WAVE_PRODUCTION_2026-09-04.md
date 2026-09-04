# Fourth Slice Mid-Wave Production — 2026-09-04

상태: `AWAITING_ART / PENDING / UNAPPROVED`

범위: 제1장 `main_01_009` ~ `main_01_013`.

## 신규 production 후보

- 화염술사 F1 / 화로지기 F2 / 재앙의 화염술사 F3
- 왕실기사 F1 / 근위대장 F2 / 왕의 검 F3
- 철퇴 난동꾼
- 굴렁통 멧돼지

총 8타깃 × 5모션 = 40 runtime strips.

굴렁통 멧돼지는 인간형 CC0 스프라이트를 강제로 변형하지 않는다. `project-authored-beast`로 코드에서 직접 구성한 deterministic original candidate이며 `generativeAiUsed=false`다.

## 전장

신규: `golden` 3레이어 (`battlefield-base`, `background-landmarks`, `foreground-low-density`) — `main_01_011 긴 시야`.

재사용:
- `main_01_009` meadow — first slice
- `main_01_010` fortress — third slice
- `main_01_012` canyon — second slice
- `main_01_013` moon — third slice

## 리뷰 진입

`?productionReview=fourth-slice`

선택 파라미터:
- `pyromancerForm=f1|f2|f3`
- `royalForm=f1|f2|f3`

리뷰 모드는 presentation-only다. simulation, progression, save, trusted command logging, normal runtime art authority를 변경하지 않는다.

## 시각 계약 핵심

화염술사: 손불보다 등 화로가 먼저 읽혀야 한다. F3는 본체보다 큰 갈라진 용광로 고리가 공격 때 열리고 `압축 → 방출 → 범위 완성`이 읽혀야 한다.

왕실기사: 방패는 없다. F2는 대검을 세운 방어 삼각형, F3는 더 가벼운 갑옷과 길고 얇은 대검으로 공격형 sidegrade가 읽혀야 한다.

철퇴 난동꾼: 긴 선딜 뒤 거대한 철퇴가 지면을 먼저 때리는 area-hit 언어를 갖는다.

굴렁통 멧돼지: 낮고 긴 장갑 멧돼지 체형, 갑옷보다 엄니와 몸통 돌진이 먼저 읽혀야 한다. contact는 어깨/몸통 충돌이다.

## 승인 경계

자동 materialization, validator 성공, CI 성공은 review evidence나 human approval이 아니다. 사람 캡처와 명시적 승인 전까지 모든 후보는 normal runtime 비권위 상태를 유지한다.
