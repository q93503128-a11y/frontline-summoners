# 첫 Production Vertical Slice 인입 계약 — 2026-09-02

상태: `DESIGN_TARGET / intake contract code-wired, integrated CI GREEN, human art review pending`

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `CHARACTER_ART_MOTION_PRODUCTION_RULES.md`
- `ANIMATION_CONTACT_FRAME_TARGETS.md`
- `../characters/STORY_ROSTER_V1_ART_BIBLE.md`
- `../enemies/INITIAL_ENEMY_ROSTER_V1.md`
- `../bosses/INITIAL_BOSSES_V1.md`
- 실제 runtime content JSON

이 문서는 최종 캐릭터 그림을 승인하거나 생성한 기록이 아니다. 첫 정식 아트 제작을 시작할 때 무엇을 만들고 어떤 조건을 통과해야 런타임 후보가 될 수 있는지 고정하는 제작·인입 계약이다.

## 1. 이번 vertical slice 범위

첫 시각 세트는 아래 6개만 대상으로 한다.

1. 징집병 F1 — `militia_f1`
2. 정규보병 F2 — `militia_f2`
3. 노련한 전선병 F3 — `militia_f3`
4. 약탈병 — `enemy-raider`
5. 황금가면 사령술사 — `enemy-boss`
6. 첫 전장 — `meadow`, `main_01_001 뒤집힌 초소`

BGM/SFX reservation은 기존 production pipeline에 계속 남아 있지만, 이번 visual intake 계약은 실제 이미지·sprite 제작 품질 기준 검증에 집중한다.

## 2. 기계 판독 정본

`assets/raw/production/vertical-slice-01.json`

사람이 읽는 설명만 적어 두지 않고 다음을 구조화했다.

- asset id / unit id / form id
- review lifecycle
- 실제 Vite public runtime root
- 전투 화면 상대 스케일
- 최소 3개 silhouette hook
- F1/F2/F3 differentiation axis
- Idle / Move / Attack / KB / Death 방향
- 현재 simulation hit frame
- required motion 5종
- 첫 전장 visual/readability 방향과 산출물

현재 모든 항목은 `AWAITING_ART`다.

## 3. 징집병 F1/F2/F3 시각 차이

### F1 징집병

핵심은 `싸구려 병사`가 아니라 `급하게 전선에 들어온 생활형 보병`이다.

- 0.9H 일반 인간형
- 짧은 실용 창/몽둥이
- 사각 여행 배낭
- 느슨한 천·가죽 장비
- 방패 없음
- 배낭과 무기 끝이 머리보다 먼저 읽히는 실루엣

### F2 정규보병

F1 체형을 유지하되 조직화가 보인다.

- 배낭 외곽 정돈
- 창날/허리띠/어깨 보호구 통일
- 보행과 공격 궤적 정돈
- 단순 색상 변경 금지

### F3 노련한 전선병

갑옷과 장식을 늘리는 방향이 아니다.

- 무기는 오히려 조금 짧아짐
- 낮고 공격적인 자세
- 깨끗한 장비보다 마모·수선·흉터 흔적
- 베테랑성은 훈장보다 자세와 사용감으로 표현

F1→F2→F3는 최소 `무기 구조`, `자세`, `재질/장비 상태` 축에서 명확하게 달라진다.

## 4. 적 대표

### 약탈병

제1장의 기준 근접 적이다.

징집병과 같은 `가벼운 인간형 + 작은 무기`로 뭉개지지 않게 가장 큰 구분점은 **한쪽에 크게 치우친 등짐 자루**다.

- 좌우 비대칭
- 훔친 생활도구/천 조각이 삐져나온 불균형 덩어리
- 작은 검보다 자루가 먼저 보임
- 평균 이동/평균 공격의 기준 적답게 Attack 예고는 단순하고 명료

### 황금가면 사령술사

`enemy-boss`의 실제 현재 displayName이며 제1장 후열 보스 기준이다.

- 본체 얼굴보다 훨씬 큰 부유 황금가면
- 가면 아래에는 작은 지휘자형 본체
- 근접 거구가 아니라 중장거리 AREA 후열 보스
- 긴 anticipation 중 위험 영역이 읽혀야 함
- KB에서 본체와 가면의 관성 차이
- Death에서 가면 부유가 먼저 끊기고 본체 자세가 붕괴

기존 placeholder처럼 인간형 sprite를 크게 하고 tint만 바꾸는 것은 승인 불가다.

## 5. 첫 전장 meadow

`main_01_001 뒤집힌 초소`의 실제 theme는 `meadow`다.

첫 production 전장은 풍경 일러스트보다 전투 가독성 검증용 기준판 역할이 우선이다.

- 중앙 전투선 장식 밀도 낮음
- 캐릭터 접지선 뒤에 최고 명도 영역을 두지 않음
- 국경 초소가 뒤집히고 급히 재점거된 흔적은 큰 구조 2~3개로 전달
- 배경 수직 구조물이 실제 벽/장애물처럼 오인되지 않게 함
- 8~12기 중첩, 2배속, 밝은/어두운 캐릭터 모두 판독 가능해야 함

## 6. Contact frame 정합성

첫 인입 계약을 만들면서 징집병의 오래된 art/contact 숫자와 현재 runtime 사이 drift를 발견했다.

과거 문서에는 징집병 F1/F2/F3 simulation contact가 `12F / 13F / 9F`로 남아 있었지만 현재 runtime 정본은 다음이다.

- F1 `content/units/chapter-01.json` → hit `[5]`
- F2 `content/evolution/story-01-overrides.json` → hit `[5]`
- F3 `content/evolution/story-01-overrides.json` → hit `[5]`

이 발견 이후 `ANIMATION_CONTACT_FRAME_TARGETS.md`의 43명 × 3형태 = 129 form 전체를 실제 `buildCharacterCombatSlot()` 결과와 전수 대조해 현재 runtime 값으로 동기화했다.

`apps/client/test/animation-contact-runtime-sync.test.ts`가 이제 다음을 영구 gate로 고정한다.

- contact table 43행 존재
- 현재 roster 43명과 1:1 대응
- 각 캐릭터 F1/F2/F3 정확히 3형태
- 129 form의 `attackTiming.hitFrames` 배열 전체 일치
- 단일↔멀티히트 packet 수 drift 감지
- 빠진 캐릭터/중복 캐릭터 감지

따라서 앞으로 runtime contact가 바뀌고 표가 그대로 남거나, 반대로 문서만 임의 변경되면 client CI가 실패한다.

이 문서에서 말하는 simulation hit frame과 production sprite metadata의 `attackContactFrame`은 서로 다른 숫자다.

- simulation hit frame: 30Hz 전투 상태 진입 후 실제 피해 시점
- sprite attackContactFrame: sprite strip 안에서 시각적으로 contact를 표현하는 이미지 index

사람 QA에서는 둘이 실제 화면 시간상 ±1 render frame 안에서 맞는지 확인한다.

첫 vertical slice manifest는 별도 validator가 runtime JSON을 직접 읽으므로 global contact table과 함께 이중으로 drift를 막는다.

## 7. 자동 인입 validator

`tools/validate-production-vertical-slice.mjs`

검사 내용:

- 첫 세트 unit 5개 + battlefield 1개가 정확히 존재하는지
- 징집병 F1/F2/F3 id/name이 현재 evolution/runtime과 일치하는지
- 약탈병/황금가면 사령술사 id/name이 현재 enemy runtime과 일치하는지
- `main_01_001`의 실제 theme가 manifest의 `meadow`와 일치하는지
- simulation hit frame이 현재 JSON과 정확히 일치하는지
- 각 unit이 silhouette hook 최소 3개를 갖는지
- F1/F2/F3 및 적/보스가 differentiation axis 최소 2개를 갖는지
- 5개 필수 모션 방향이 모두 정의됐는지
- production runtime root가 정해진 경로를 벗어나지 않는지

`READY_FOR_REVIEW` 또는 `APPROVED`로 올리는 순간에는 추가로 다음을 강제한다.

- Idle / Move / Attack / KB / Death 실제 PNG strip 5개 존재
- PNG signature/IHDR 정상
- sheet width = frameWidth × frames
- sheet height = frameHeight
- attackContactFrame이 attack strip 범위 안
- `APPROVED`는 `humanReviewComplete=true` 없이 금지

즉 파일만 넣었다고 자동 승인되지 않는다.

## 8. CI gate

루트 명령:

`npm run assets:production:check`

GitHub Actions `CI`의 Typecheck 직후 별도 gate로 실행한다.

이 gate는 최종 아트의 미적 품질을 자동 판정하려는 것이 아니다. 다음 종류의 실수를 차단한다.

- 잘못된 form 폴더
- 오래된 hit frame
- 누락 motion
- 잘못된 sprite sheet 메타데이터
- 없는 파일을 READY/APPROVED로 선언
- 사람 검수 없이 APPROVED 선언

## 9. 사람 승인에서 볼 것

첫 이미지가 들어오면 다음 순서로 본다.

1. 1280×720 전투 크기 silhouette
2. 390×844 계열 가로 축소
3. 360×640 계열 가로 축소
4. F1/F2/F3를 색 제거 후에도 구분 가능한지
5. 징집병과 약탈병을 이름 없이 구분 가능한지
6. 황금가면 사령술사의 가면/본체 관계가 작은 화면에서도 읽히는지
7. Attack contact가 실제 simulation hit과 맞는지
8. KB/Death가 공용 placeholder 동작처럼 보이지 않는지
9. meadow에서 8~12기 중첩 시 캐릭터 외곽이 살아 있는지

이 검수 전에는 `READY_FOR_REVIEW` 이상으로 올리지 않는다.

## 10. 자동 검증 결과

### Production intake gate

CI #918 / run `33568943788`에서 새 `Check production asset intake` 단계를 포함한 전체 파이프라인이 GREEN이었다.

검증된 코드 HEAD:

`a66f4897c7aa31c0ceb2e67d439e5842596fed5b`

### 129-form contact synchronization gate

최초 전수 감사 CI #919는 의도대로 오래된 contact 표 drift를 검출해 실패했다. 이를 실제 runtime 값으로 모두 수정한 뒤 CI #920 / run `33613875726`이 전체 GREEN으로 종료됐다.

검증된 code/doc HEAD:

`8c3c4e6d5cb60198abc4ceb47d6be01d6954fe02`

PASS 범위:

- install
- typecheck
- production asset intake check
- content schema
- simulation
- server co-op protocol
- client individual diagnostics — 43×3 contact 전수 sync 포함
- client full suite
- production build

이 자동 검증은 사람의 캐릭터 디자인 승인, 실제 PNG 품질 승인, 브라우저 silhouette/contact QA를 대체하지 않는다.
