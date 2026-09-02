# 첫 Production Visual Review Package — 2026-09-02

상태: `DESIGN_TARGET / review contract code-wired, integrated CI GREEN, human art review pending`

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `CHARACTER_ART_MOTION_PRODUCTION_RULES.md`
- `ANIMATION_CONTACT_FRAME_TARGETS.md`
- `FIRST_PRODUCTION_VERTICAL_SLICE_INTAKE_2026-09-02.md`
- `assets/raw/production/vertical-slice-01.json`
- 실제 runtime content JSON

기계 판독 review package:

`assets/raw/production/review-package-01.json`

자동 검증:

`tools/validate-production-review-package.mjs`

루트 통합 gate:

`npm run assets:production:check`

이 문서는 최종 그림을 승인한 기록이 아니다. 첫 production 이미지가 들어왔을 때 무엇을 제출해야 `READY_FOR_REVIEW`가 될 수 있고, 무엇을 사람이 직접 확인해야 `APPROVED`가 될 수 있는지를 고정한다.

## 1. Review 대상

vertical slice와 정확히 같은 6개 target을 사용한다.

1. `unit:militia:militia_f1` — 징집병 F1
2. `unit:militia:militia_f2` — 정규보병 F2
3. `unit:militia:militia_f3` — 노련한 전선병 F3
4. `unit:enemy-raider` — 약탈병
5. `unit:enemy-boss` — 황금가면 사령술사
6. `battlefield:meadow` — 뒤집힌 초소 기준 초원 전장

현재 6개 모두 `AWAITING_ART`다.

따라서 현재 review package에는 실제 evidence, provenance, reviewer, checklist 결과를 채우지 않았다. 아직 존재하지 않는 아트를 제출한 것처럼 보이게 만드는 placeholder review data도 금지한다.

## 2. Landscape viewport를 정확히 해석하는 방법

기존 제작/UI 문서의 `390×844`, `360×640`은 모바일 기기 클래스를 설명하는 세로 기준 수치다. 게임 자체는 가로 orientation을 기본으로 한다.

따라서 실제 review screenshot의 CSS viewport는 다음으로 고정한다.

| 기기 클래스/대상 | 실제 review CSS viewport |
| --- | --- |
| desktop 기준 | `1280×720` |
| `390×844` mobile class | `844×390` |
| `360×640` mobile class | `640×360` |

즉 `390×844 계열 가로`를 폭 390짜리 세로 화면으로 캡처하는 것이 아니다.

review validator는 위 세 viewport의 width/height와 landscape 방향을 정확히 검사한다.

## 3. 공통 capture scenario

첫 package는 다음 시각 검수를 구조화한다.

### `silhouette-comparison`

- `1280×720`
- grayscale 필수
- 이름·색상 없이 가장 가까운 비교 대상과 실루엣 구분

### `mobile-wide-standard`

- `844×390`
- 일반 전투 크기 판독

### `mobile-small-standard`

- `640×360`
- 첫 slice의 최소 모바일 판독 기준

### `overlap-8-12`

- `844×390`
- 화면에 실제 8~12기 유닛이 보이는 혼전 상태
- 외곽선, 무기 방향, 접지선, HUD가 무너지지 않아야 함

### `bright-background`

- `640×360`
- 밝은 전장 영역 뒤에서도 실루엣/HUD 판독

### `dark-background`

- `640×360`
- 어두운 전장 영역 뒤에서도 실루엣/HUD 판독

### `contact-alignment`

- `1280×720`
- 장식용 swing frame이 아니라 실제 simulation hit timing에 시각 contact/impact가 맞는지 확인

### `boss-small-screen`

- `640×360`
- 황금가면 사령술사의 큰 가면과 작은 지휘자 본체 관계
- 긴 공격 예고가 작은 화면에서도 읽히는지 확인

## 4. Unit 제출물

PLAYER_FORM / ENEMY / BOSS는 `READY_FOR_REVIEW` 전에 기본적으로 다음 evidence를 제출해야 한다.

- turnaround 또는 충분한 reference
- silhouette comparison
- Idle / Move / Attack / KB / Death motion key pose
- contact board
- scale sheet
- 가장 가까운 기존 3종과 무엇이 다른지 비교판/메모

실제 runtime 쪽은 별도 vertical-slice validator가 다음 5개 strip을 요구한다.

- Idle
- Move
- Attack
- Knockback
- Death

따라서 review board만 있고 실제 runtime sprite가 없는 상태도 `READY_FOR_REVIEW`로 올릴 수 없다.

## 5. Battlefield 제출물

`battlefield:meadow`는 다음 evidence를 요구한다.

- battlefield base
- foreground low-density 판
- background landmark 판
- crop guide
- readability board

그리고 실제 전투 capture에서 확인한다.

- `844×390`
- `640×360`
- 8~12기 중첩
- 밝은 캐릭터/어두운 캐릭터 대비
- 중앙 combat line 저밀도
- 배경 구조물이 실제 벽/장애물/사거리 표시처럼 보이지 않는지
- HUD가 묻히지 않는지

## 6. Militia F1/F2/F3 승인 핵심

세 형태는 색을 지운 뒤에도 달라야 한다.

- F1: 급조 장비 + 실용 무기 + 사각 여행 배낭
- F2: 같은 체형을 유지하되 무기/배낭/보호구 정돈
- F3: 갑옷 증량이 아니라 더 낮은 자세 + 짧아진 실전 무기 + 마모/수선 흔적

`f1f2f3DistinctWithoutColor=true`는 사람이 실제 비교판을 보고 확인해야 한다. validator가 그림의 미학이나 실루엣 품질을 자동으로 판정하지 않는다.

## 7. 약탈병 승인 핵심

징집병과 가장 위험한 충돌 대상이다.

- 한쪽으로 크게 치우친 등짐 자루
- 작은 검보다 자루가 먼저 읽힘
- 행군 배낭이 아니라 훔친 생활도구가 삐져나온 불균형 덩어리

이름표와 색상을 가리고도 징집병과 즉시 구분되어야 한다.

## 8. 황금가면 사령술사 승인 핵심

- 큰 부유 황금가면이 본체보다 먼저 읽힘
- 작은 지휘자 본체가 가면 아래에서 사라지지 않음
- 근접 거구처럼 보이지 않고 중장거리 AREA 보스임이 자세에서 읽힘
- KB에서 본체/가면 관성 차이
- Death에서 가면 부유 붕괴 → 본체 자세 붕괴 순서
- `640×360`에서 가면/본체/공격 예고가 동시에 판독 가능

## 9. Provenance gate

`READY_FOR_REVIEW` 이상으로 올라가는 순간 review package는 target별 provenance를 요구한다.

필수:

- `authorOrSource`
- `rightsOrLicense`
- `productionMethod` = `MANUAL` / `AI` / `MIXED`
- 수정·리터치 설명
- master file 위치
- runtime file 위치

아트가 존재한다는 사실과 사용 권한이 있다는 사실은 별개이므로 둘을 분리해서 기록한다.

## 10. Review lifecycle

### `AWAITING_ART`

- evidence 없음
- capture 없음
- provenance 없음
- 사람 검수 `PENDING`
- reviewer / reviewedAt / checklist를 임의로 채우면 validator 실패

### `READY_FOR_REVIEW`

- 실제 review evidence 존재
- profile별 모든 capture 존재
- screenshot PNG가 지정 viewport와 정확히 같은 크기
- provenance 완비
- vertical slice 쪽 실제 runtime sprite/file 조건도 통과
- 사람 검수는 아직 완료 상태가 아님

### `APPROVED`

자동 검증만으로 올릴 수 없다.

- 사람 검수 상태 `COMPLETE`
- reviewer 기록
- 검수 시각 기록
- profile별 필수 human checklist 전부 true
- vertical slice manifest도 `humanReviewComplete=true`

둘 중 하나라도 빠지면 승인 실패다.

## 11. Human checklist 종류

PLAYER_FORM 예:

- silhouette readable
- F1/F2/F3 color 없이 구분
- nearest neighbor와 구분
- motion readable
- contact aligned
- KB/Death authored
- mobile readable
- overlap readable
- bright/dark readable

BOSS는 추가:

- boss mask/body readable
- warning readable

BATTLEFIELD는 추가/대체:

- combat line low density
- background does not imply collision
- HUD readable

이 boolean은 사람이 실제 화면을 보고 결정한다. 자동화는 값이 존재하는지와 승인 시 전부 true인지까지만 검사한다.

## 12. 자동 validator가 막는 것

`tools/validate-production-review-package.mjs`는 다음을 검사한다.

- vertical slice와 review package의 6개 target 1:1 대응
- target status 동기화
- target kind에 맞는 review profile
- 필수 viewport 3종
- 모바일 portrait-class → landscape CSS viewport 변환
- capture scenario 누락
- 8~12기 overlap requirement 약화
- boss-small-screen이 최소 viewport를 벗어나는 것
- READY/APPROVED인데 evidence 파일이 없는 것
- review 파일이 review root 밖으로 탈출하는 것
- capture가 PNG가 아닌 것
- capture PNG width/height가 지정 viewport와 다른 것
- provenance 누락
- AWAITING_ART에 가짜 review 결과를 채우는 것
- 사람 검수 없이 APPROVED 선언하는 것

## 13. CI 결과

통합 검증 코드 HEAD:

`2035e100e675898f49848aa78d6cbadad72aef5c`

CI:

- run number: **#928**
- run id: **`33631797689`**
- conclusion: **SUCCESS**

PASS:

- install
- typecheck
- production asset intake validator
- production visual review package validator
- content schema
- simulation
- server co-op protocol
- client individual diagnostics
- client full suite
- production build

이 GREEN은 실제 그림의 미적 품질, 실루엣 판독, contact의 체감, 모바일 가독성을 사람이 검수했다는 뜻이 아니다.

## 14. 현재 상태와 다음 제작 단계

현재 실제 production PNG는 아직 인입되지 않았다.

6개 target은 모두 계속 `AWAITING_ART`다.

따라서 다음 실제 아트 작업에서 해야 할 것은 129형태를 한 번에 만드는 것이 아니라, 이 package에 맞춰 먼저:

- 징집병 F1/F2/F3
- 약탈병
- 황금가면 사령술사
- meadow

의 첫 시각 시안을 준비하고, silhouette/reference/key pose 단계에서 사람 검수를 거친 뒤 runtime strip 제작으로 내려가는 것이다.
