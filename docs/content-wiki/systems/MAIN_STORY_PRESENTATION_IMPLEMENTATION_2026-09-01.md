# 메인 1차 스토리 표시 구현 — 2026-09-01

상태: **IMPLEMENTED AUTOMATIC STORY ROUTING / human multiplayer & viewport QA pending**

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

## 자동 재생 경로

초판 자동 스토리 경로는 현재 모두 연결되어 있다.

- 게스트 솔로 MAIN
- 로그인 계정 trusted MAIN
- 로그인 친구 2인 협동
- 로그인 공개 매칭 2인 협동
- 참가 코드형 게스트 2인 협동

솔로/trusted에서는 scene 전환형 `StoryScene`, 멀티플레이에서는 WebSocket/room을 유지하는 로컬 `story-overlay.ts`를 사용한다.

## 솔로 및 로그인 계정 흐름

스테이지 선택은 기존 `StageSelectScene`의 해금/편성/온라인 권한 판정을 그대로 사용한다. 실제 `battle` 전환 직전에만 아직 보지 않은 PRE 장면이 있으면 `StoryScene`을 거친다.

따라서 스토리가 스테이지 잠금, SPECIAL 조건, 편성 제한, 로그인 계정 온라인 전투 요구, trusted battle ticket 발급을 우회할 수 없다.

장 완료 후일담은 보상/진행 저장보다 먼저 나오지 않는다.

- 게스트 솔로: `recordNormalStageClear`가 `firstClear && persisted`를 확정한 뒤 POST 장면을 대기시킨다.
- 로그인 계정 솔로: trusted replay와 authoritative claim이 성공하고 `reward.firstClear`가 확정된 뒤 POST 장면을 대기시킨다.
- 결과 화면에서 보상과 저장 상태를 먼저 읽을 수 있고, 사용자가 결과 화면을 나갈 때 후일담을 한 번 재생한다.
- 저장 실패나 서버 검증 실패 때문에 거짓 장 완료 스토리가 먼저 재생되지 않는다.

## 협동 로컬 연출

협동 PRE/POST는 각 플레이어의 로컬 overlay다. 한 플레이어가 스토리를 읽어도 상대의 WebSocket, room, simulation을 정지시키지 않는다.

로그인 친구/공개 협동:

- PRE는 `LOBBY` room의 현재 stageId를 보고 로컬 표시
- POST는 자신의 `ACCOUNT_SETTLED`가 도착한 실제 첫 NORMAL_CLEAR에만 표시
- 전투 전 이미 해당 ST20을 클리어했다면 재클리어 후일담을 띄우지 않음

참가 코드형 게스트 협동:

- PRE는 기존 `CoopLobbyScene` 위에서 로컬 overlay로 표시
- 로비 단계의 guest clear set을 session별로 snapshot
- `BATTLE_FINISHED` 승리 + 전투 전 미클리어 + authored outro 조건을 확인
- 기존 `recordNormalStageClear(..., 'COOP_BATTLE')`가 durable 저장되어 결과 UI가 `협동 NORMAL_CLEAR 저장 완료`에 도달한 뒤에만 POST 표시
- IndexedDB 저장 실패로 `현재 탭에서 클리어 유지` 상태이면 POST를 표시하지 않음

세부 구현은 `GUEST_COOP_STORY_OVERLAY_IMPLEMENTATION_2026-09-01.md`를 참고한다.

## SKIP / 자동 건너뛰기

모든 단독 `StoryScene`과 협동 로컬 overlay는 처음부터 `건너뛰기`를 제공한다.

- 확인창 없음
- 길게 누르기 없음
- `Esc` 즉시 스킵
- `Space` / `Enter` 다음 beat
- 스킵 여부는 전투/보상/해금에 영향을 주지 않음

클라이언트 설정의 `스토리 연출 자동 건너뛰기`가 ON이면 장면을 렌더하지 않고 viewed 처리한다.

## 다시 보기 / 본 장면 기록

본 장면 ID는 로컬 키 `frontline-summoners:story-viewed:v1`에 저장한다.

- 동일 장면은 일반 재클리어 시 자동 재생하지 않는다.
- 솔로/협동이 동일 viewed 기록을 공유한다.
- 손상된 storage는 안전하게 빈 기록으로 복구한다.
- 저장 실패가 게임 진입이나 전투를 막지 않는다.
- 도감/기록실 수동 다시 보기는 후순위다.

현재 viewed-story 기록은 연출 선호에 해당하는 로컬 상태이며 계정 진행 정본이나 보상 authority가 아니다.

## 전투 시스템과 분리

스토리 스킵/자동 스킵은 boss arrival gameplay telegraph, 보스 이름/위험 표시, 전투 HUD, 전투 판정과 30Hz simulation, trusted command recording, 협동 room/session authority, 시스템 해금 카드/보상 결과를 제거하거나 변경하지 않는다.

스토리 모듈은 simulation 패키지나 협동 서버 authority를 수정하지 않는다.

## 자동 회귀 작성 범위

`apps/client/test/story-presentation.test.ts` 및 `guest-coop-story-wiring.test.ts`에 다음 계약을 작성했다.

- 4장 × intro/final/outro = 12개 장면
- 정확한 장 시작/최종전/장 완료 stage mapping
- viewed-story idempotency 및 자동 스킵
- solo/trusted result wiring
- friend/public coop local overlay wiring
- guest coop main scene adapter wiring
- guest PRE story lookup
- guest `BATTLE_FINISHED` 이후 durable clear 성공 경계에서 POST 표시

## 아직 남은 범위

자동 스토리 콘텐츠를 더 늘리는 것보다 다른 초판 콘텐츠 공백을 우선한다. 스토리 자체의 잔여는 품질 검수다.

1. 실제 2인 기기 플레이에서 overlay/READY/전투 시작 동시성 확인
2. 공개/친구 협동에서 결과 직후 너무 빠르게 scene을 이탈해 `ACCOUNT_SETTLED`를 수신하기 전인 경우의 후일담 복구 UX 보강
3. 640×360 및 모바일 safe-area에서 Skip/다음 버튼 터치 영역 확인
4. 실제 1장~4장 연속 플레이 문장 톤/반복 피로도 사람 검수
5. 도감/기록실 수동 다시 보기(후순위)

위 항목 전까지 문서 상태를 `TESTED` 또는 `LOCKED`로 올리지 않는다.
