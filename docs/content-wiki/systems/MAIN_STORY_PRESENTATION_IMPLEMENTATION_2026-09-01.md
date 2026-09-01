# 메인 1차 스토리 표시 구현 — 2026-09-01

상태: **IMPLEMENTED SOLO/TRUSTED + ACCOUNT FRIEND/PUBLIC COOP STORY FOUNDATION / guest-code coop + human QA pending**

상위 정책: `SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`  
상위 메인 지도: `stages/main/INITIAL_MAIN_4_CHAPTERS.md`

## 구현된 1차 장면

메인 4장에 각각 다음 세 종류의 짧은 선택형 장면을 배치했다.

- 장 최초 진입 `CHAPTER_INTRO`
- 장 최종전 직전 `BOSS_PRELUDE`
- 장 ST20 첫 NORMAL_CLEAR 뒤 `CHAPTER_OUTRO`

총 12개다.

| 장 | 최초 진입 | 최종전 직전 | 장 완료 |
| --- | --- | --- | --- |
| 1 뒤집힌 국경 | `main_01_001` | `main_01_020` | `main_01_020` 첫 클리어 |
| 2 뒤틀린 숲 | `main_02_001` | `main_02_020` | `main_02_020` 첫 클리어 |
| 3 마도도시 세라페 | `main_03_001` | `main_03_020` | `main_03_020` 첫 클리어 |
| 4 기어 제국의 균열 | `main_04_001` | `main_04_020` | `main_04_020` 첫 클리어 |

각 장면은 3개의 짧은 beat로 제한했다. 장/적군/보스 분위기를 연결하지만 전투 규칙, 스테이지 잠금 조건, 보상 수치, 보스 위험기 설명을 대사 안에 의존시키지 않는다.

## 솔로 및 로그인 계정 흐름

스테이지 선택은 기존 `StageSelectScene`의 해금/편성/온라인 권한 판정을 그대로 사용한다. 실제 `battle` 전환 직전에만 아직 보지 않은 PRE 장면이 있으면 `StoryScene`을 거친다.

따라서 스토리가 다음 권한을 우회할 수 없다.

- 스테이지 잠금
- SPECIAL 조건
- 편성 제한
- 로그인 계정의 온라인 전투 요구
- trusted battle ticket 발급

로그인 계정도 같은 stage-select 흐름을 사용하므로 PRE 장면 이후 기존 trusted 전투 시작 경로로 들어간다.

장 완료 후일담은 보상/진행 저장보다 먼저 나오지 않는다.

- 게스트: `recordNormalStageClear`가 `firstClear && persisted`를 확정한 뒤에만 POST 장면을 대기시킨다.
- 로그인 계정 솔로: trusted replay와 authoritative claim이 성공하고 `reward.firstClear`가 확정된 뒤에만 POST 장면을 대기시킨다.
- 결과 화면에서 보상과 저장 상태를 먼저 읽을 수 있고, 사용자가 결과 화면을 나갈 때 후일담을 한 번 재생한다.
- 저장 실패나 서버 검증 실패 때문에 거짓 장 완료 스토리가 먼저 재생되지 않는다.

## 친구/공개 계정 협동 로컬 연출

친구 협동과 공개 협동은 `StoryScene`으로 장면 전환하지 않고 현재 로비/결과 scene 위에 로컬 overlay를 띄운다.

PRE 장면:

- WebSocket room/session은 그대로 유지한다.
- room phase가 `LOBBY`일 때 현재 stageId의 PRE 장면을 각 클라이언트가 독립적으로 확인한다.
- overlay가 로컬 입력을 가리지만 서버 room update와 상대 접속 상태는 계속 수신한다.
- 다른 플레이어의 화면에는 장면을 강제로 띄우지 않는다.
- 상대가 같은 장면을 이미 봤거나 자동 스킵이면 상대 클라이언트는 즉시 평상시 로비를 유지한다.
- `건너뛰기` 또는 `Esc`로 즉시 닫을 수 있다.

POST 장면:

- 친구/공개 계정 협동은 서버의 해당 좌석 `ACCOUNT_SETTLED` 신호 이후에만 장 완료 후일담 후보를 연다.
- 전투 전 계정 진행에 이미 해당 ST20 클리어가 있었다면 재클리어 후일담으로 취급하지 않는다.
- 전투 winner가 `PLAYER`이고, 전투 전 미클리어였고, 해당 stage에 `CHAPTER_OUTRO`가 있을 때만 로컬 overlay를 띄운다.
- 따라서 한 플레이어의 POST 감상이 다른 플레이어의 종료/저장/전투 simulation을 정지시키지 않는다.
- 공개 협동도 실제 전투 scene은 친구 협동 계정 전투 scene을 공유하므로 같은 authoritative POST 규칙을 사용한다.

현재 로컬 overlay 구현은 `story-overlay.ts`, 협동 연결 adapter는 `coop-story-scenes.ts`가 담당한다. adapter는 기존 방/전투 authority를 수정하지 않고 story presentation만 덧댄다.

## SKIP / 자동 건너뛰기

모든 단독 `StoryScene`과 협동 로컬 story overlay는 처음부터 `건너뛰기`를 제공한다.

- 확인창 없음
- 길게 누르기 없음
- `Esc`도 즉시 스킵
- `Space` / `Enter`는 다음 beat
- 스킵 여부는 전투/보상/해금에 영향을 주지 않음

클라이언트 설정의 `스토리 연출 자동 건너뛰기`는 `autoSkipStory`다. ON이면 PRE/POST 라우터 또는 협동 overlay presenter 단계에서 장면을 본 것으로 기록하고 장면 자체를 렌더하지 않는다.

## 다시 보기 / 본 장면 기록

본 장면 ID는 로컬 키 `frontline-summoners:story-viewed:v1`에 저장한다.

- 동일 장면은 일반 재클리어 시 자동 재생하지 않는다.
- 솔로와 협동은 동일 viewed-story 기록을 공유한다.
- 손상된 storage는 안전하게 빈 기록으로 복구한다.
- 저장 실패가 게임 진입이나 전투를 막지 않는다.
- 도감/기록실에서의 수동 다시 보기는 상위 정책대로 후순위이며 아직 구현하지 않는다.

현재 viewed-story 기록은 연출 선호에 해당하는 로컬 상태이며 계정 진행 정본이나 보상 authority가 아니다.

## 전투 시스템과 분리

스토리 스킵/자동 스킵은 다음을 제거하지 않는다.

- boss arrival gameplay telegraph
- 보스 이름/위험 표시
- 전투 HUD
- 전투 판정과 30Hz simulation
- trusted command recording
- 협동 server-authoritative room/battle state
- 시스템 해금 카드/보상 결과

스토리 모듈은 simulation 패키지나 협동 서버 authority를 수정하지 않는다.

## 자동 회귀 작성 범위

`apps/client/test/story-presentation.test.ts`에 다음 계약을 작성했다.

- 4장 × intro/final/outro = 12개 장면
- 정확한 장 시작/최종전/장 완료 stage mapping
- 장면당 2~5 beat 범위
- viewed-story idempotency
- 자동 스킵 시 장면을 표시하지 않고 viewed 처리
- 과거 v1 설정 payload의 `autoSkipStory=false` 기본 복구
- main/stage-select/result/trusted-result/settings wiring
- 친구/공개 협동 scene adapter wiring
- PRE가 `LOBBY` phase에서 stage story를 찾는 계약
- POST가 로컬 `ACCOUNT_SETTLED` + PLAYER 승리 + 전투 전 미클리어 조건을 요구하는 계약
- 협동 overlay의 로컬-only 안내/즉시 Skip 계약

## 아직 남은 범위

이 문서를 `TESTED` 또는 스토리 전체 완료로 올리지 않는다.

1. 메인 메뉴의 별도 `2인 협동` 참가 코드형 게스트/로컬 협동에도 동일 PRE/POST 로컬 연출을 연결한다.
2. 공개/친구 협동에서 결과 직후 너무 빠르게 scene을 이탈해 `ACCOUNT_SETTLED`를 수신하기 전인 경우의 후일담 복구 UX를 보강한다.
3. 640×360 및 모바일 safe-area에서 Skip/다음 버튼 터치 영역과 겹침 확인.
4. 실제 1장~4장 연속 플레이로 장면 길이/문장 톤/반복 피로도 사람 검수.
5. 도감/기록실 다시 보기는 후순위.

현재 상태는 **솔로 + 로그인 trusted + 로그인 친구/공개 협동 메인 스토리 foundation 구현 완료**다. 게스트 참가 코드형 협동과 사람 플레이 검증은 별도 남은 범위다.
