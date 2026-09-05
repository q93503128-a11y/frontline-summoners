# Production Art Human Review Hub — 2026-09-05

## 목적

production art의 자동 구조/품질 감사를 통과한 후보를 실제 사람 검수로 넘기기 위한 단일 진입점을 제공한다.

이 허브를 묶는 과정에서 기존 전역 품질 감사가 Fourth Slice의 per-target `runtime-metadata.json` 8개를 root metadata scan에 포함하지 못하고 있던 사실을 발견했다. 따라서 허브 공개와 동시에 `fourth-slice-runtime-metadata.json` aggregate index를 생성하도록 보강하여 Fourth Slice 8타깃 / 40 strips도 전역 audit과 review manifest에 포함한다.

이 허브는 승인 시스템이 아니다. review mode와 motion gallery, comparison lab을 빠르게 열고 브라우저 로컬 체크를 남길 수 있게 할 뿐이며, provenance / reviewer / approval evidence를 생성하거나 수정하지 않는다.

## 공개 경로

- `/assets/production/review/index.html`
- `/assets/production/review/gallery.html?mode=<review-mode>`
- `/assets/production/review/compare.html?mode=<review-mode>&a=<target-key>&b=<target-key>&motion=<motion>`
- `/assets/production/review/rework-queue.html`
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

각 mode 카드에는 실제 전투 문맥을 보는 `OPEN BATTLE REVIEW`와 타깃별 5모션을 빠르게 훑는 `MOTION GALLERY`가 함께 노출된다. Motion Gallery에서 전역 `COMPARE LAB` 버튼 또는 각 타깃의 `COMPARE` 버튼으로 같은 mode의 A/B 비교 화면을 연다.

## Motion Gallery

`tools/materialize-production-review-gallery.mjs`가 공용 `gallery.html`을 만들고 `tools/patch-production-review-gallery-runtime.mjs`가 현재 runtime metadata contract에 맞는 strip resolver와 comparison route를 보강한다. query의 `mode` 값에 따라 해당 root runtime metadata를 읽고 그 mode의 모든 target/form을 카드로 렌더링한다.

각 target/form 카드에는 다음 다섯 motion이 동시에 표시된다.

- idle
- move
- attack
- knockback
- death

각 strip은 canvas에서 실제 frameWidth/frameHeight/frames 값을 사용해 반복 재생한다. 화면 근처 카드만 `IntersectionObserver`로 이미지를 읽기 때문에 recruitment의 99 forms처럼 큰 묶음도 처음부터 모든 strip을 한꺼번에 디코드하지 않는다.

attack은 metadata의 `attackContactFrame`과 현재 프레임이 일치할 때 preview 경계를 강조하여 접촉 타이밍을 빠르게 확인할 수 있게 한다.

검수 편의를 위해 target/asset 검색, ALL/PENDING/LOCAL CHECKED/REVISIT 필터, 전체 pause/play, 진행률 표시, J/K 이동, R 로컬 체크, X revisit, Space 재생 토글을 제공한다.

Gallery의 `LOCAL CHECKED`와 `REVISIT`은 `frontline-production-review-gallery-local-v1:` namespace의 localStorage에만 기록된다. 정본 metadata나 human approval 상태를 수정하지 않는다.

### Recruitment runtime metadata 차이

recruitment canonical form metadata는 다른 mode와 달리 motion 객체에 `url`, `frameWidth`, `frameHeight`를 중복 기록하지 않는다. 대신 target 레벨의 `unitId`, `formId`, `frameWidth`, `frameHeight`와 motion별 `frames`를 사용하고 실제 runtime도 `/assets/production/units/<unitId>/<formId>/<motion>.png` 규칙으로 strip을 연다.

Gallery는 이 계약을 명시적으로 해석한다. `tools/validate-production-review-gallery.mjs`는 HTML 문자열만 검사하지 않고 현재 11개 metadata를 직접 읽어 209 canonical target/form × 5 motion = 1,045 strip을 실제 runtime PNG까지 확인한다. 이 중 recruitment 99 forms × 5 = 495 strip은 위 fallback route와 target-level frame size를 사용한다. 따라서 metadata shape가 달라져 브라우저에서 그림이 깨지는 회귀를 CI에서 차단한다.

## Production Comparison Lab

`tools/materialize-production-review-compare.mjs`가 `compare.html`을 만든다. Gallery에서 mode와 target A를 그대로 deep-link할 수 있고, 같은 mode에서 target B와 motion을 선택해 다음 방식으로 비교한다.

- A/B side-by-side synchronized playback
- normalized motion phase 기반 프레임 동기화
- `RUNTIME HEIGHT`: 실제 battle runtime의 `displayHeight` 비율을 동일 pixels-per-unit 기준으로 비교
- `FRAME FIT`: 각 sprite frame을 화면에 최대한 맞춰 순수 실루엣/동세를 비교
- `OVERLAY`: 같은 중심과 기준선에 A/B를 겹쳐 형태 차이를 확인
- `BLINK`: A/B를 번갈아 표시하여 작은 실루엣 차이를 확인
- attack contact frame 동시 강조
- recruitment에서는 같은 `unitId`의 다른 F1/F2/F3를 우선 `RELATED / NEXT` 대상으로 선택
- URL의 `a`, `b`, `motion`을 갱신해 특정 비교 상태를 그대로 다시 열 수 있음

Comparison Lab은 localStorage를 사용하지 않고 정본 write request도 만들지 않는 read-only review aid다. 비교 결과 자체는 승인 증거가 아니다.

## Fourth Slice 전역 감사 누락 보강

기존 Fourth Slice materializer는 각 대상 폴더에 `runtime-metadata.json`만 생성했다. 반면 `tools/audit-production-art-quality.mjs`는 production units root의 `*-runtime-metadata.json`을 전역 감사 입력으로 사용한다. 그 결과 Fourth Slice의 다음 8타깃은 개별 runtime validator에는 포함됐지만 전역 silhouette/motion quality audit에는 포함되지 않았다.

- pyromancer F1/F2/F3
- royal F1/F2/F3
- enemy-berserker
- enemy-knight

`tools/materialize-fourth-slice-runtime-index.mjs`가 이 8타깃을 aggregate root metadata로 변환한다. URL, frame dimensions/count, byte length, SHA-256, review lifecycle를 실제 per-target metadata와 PNG에서 다시 읽어 작성하며, `tools/validate-fourth-slice-runtime-files.mjs`가 aggregate와 원본 파일의 정합도 함께 검증한다.

## 허브가 표시하는 정보

각 카드는 해당 runtime metadata를 직접 읽어 다음을 생성한다.

- battle review route
- motion gallery route
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

`tools/validate-production-review-hub.mjs`, `tools/validate-production-review-gallery.mjs`, `tools/validate-production-review-compare.mjs`는 다음을 강제한다.

- review mode 정확히 11개
- battle route와 gallery route 중복 없음
- battle route와 실제 runtime module의 query 값 정합
- gallery / comparison mode와 metadata mapping 정합
- metadata target/strip count 정합
- 모든 target에 idle/move/attack/knockback/death 존재
- Gallery가 209 canonical target/form / 1,045 strip의 runtime URL, frame dimensions/count, 실제 PNG 존재를 검증
- recruitment 495 canonical form strip의 target-level size + derived runtime URL 계약 검증
- 승인 상태로 승격되지 않았음
- 명시된 `normalRuntimeAuthoritative`는 false
- 명시된 `generativeAiUsed`는 false
- machine readiness가 severe/atRisk/weak/watch/clipping 전부 0
- hub/gallery/comparison에 UNAPPROVED 경고 존재
- gallery가 canvas + lazy loading + attack contact-frame 표시를 유지
- comparison이 synchronized phase + runtime-height/frame-fit + overlay/blink + contact-frame 비교를 유지
- 로컬 체크가 reviewer identity나 승인 증거를 기록하지 않음
- gallery/comparison이 canonical data에 쓰기 요청을 만들지 않음

## 권한 경계

이 작업 후에도 다음은 그대로 유지한다.

- human review: PENDING / UNREVIEWED
- normal runtime authority: false
- generative AI: false
- `PRODUCTION_UNIT_ART_CANDIDATES`: 사람 승인 전 비권위 상태 유지

사람 검수에서 문제를 발견하면 해당 production 후보를 수정하고 다시 자동 검증을 통과시킨다. 허브나 gallery의 체크박스를 모두 눌렀다는 사실, 또는 comparison lab에서 두 후보를 비교했다는 사실만으로는 어떤 후보도 승인되지 않는다.
