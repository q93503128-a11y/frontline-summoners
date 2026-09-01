# 참가 코드형 협동 스토리 오버레이 구현 — 2026-09-01

상태: **IMPLEMENTED / human multiplayer QA pending**

상위 정책: `SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`
관련 구현: `MAIN_STORY_PRESENTATION_IMPLEMENTATION_2026-09-01.md`

## 범위

메인 메뉴의 `2인 협동`에서 만드는 참가 코드형 게스트 협동에도 메인 4장 선택형 스토리를 연결했다.

- 장 최초 진입 / 최종전 직전 PRE 장면
- 장 ST20 첫 NORMAL_CLEAR 뒤 POST 장면
- 스토리 자동 건너뛰기
- 이미 본 장면 재생 방지

스토리 내용은 솔로/로그인 협동과 동일한 `MAIN_STORY_PRESENTATIONS`를 사용한다.

## PRE 장면

`StoryGuestCoopLobbyScene`은 기존 `CoopLobbyScene` 위에 로컬 오버레이만 얹는다.

- WebSocket과 room은 유지된다.
- 상대 클라이언트의 화면은 멈추지 않는다.
- 서버 READY/전투 authority를 변경하지 않는다.
- 로비 단계의 guest clear set을 session별로 snapshot하여 이후 first-clear 판정에 사용한다.

## POST 장면

참가 코드형 협동은 게스트 IndexedDB가 진행 정본이므로 ACCOUNT_SETTLED 신호를 사용하지 않는다.

대신 다음 조건을 모두 만족할 때만 장 완료 후일담을 띄운다.

1. `BATTLE_FINISHED` winner가 PLAYER
2. 전투 시작 전 해당 ST20이 미클리어
3. 해당 stage에 authored `CHAPTER_OUTRO`가 존재
4. 기존 `CoopBattleScene`의 `recordNormalStageClear(..., 'COOP_BATTLE')`가 durable 저장 성공
5. 결과 UI가 `협동 NORMAL_CLEAR 저장 완료` 상태에 도달

`현재 탭에서 클리어 유지`처럼 IndexedDB 저장에 실패한 경우에는 후일담을 띄우지 않는다. 따라서 저장되지 않은 진행을 장 완료처럼 연출하지 않는다.

## 멀티플레이 분리 원칙

스토리 오버레이는 presentation-only다.

- simulation 정지 없음
- 30Hz 전투 판정 변경 없음
- room phase 변경 없음
- 상대 입력/READY 상태 변경 없음
- 공유 기지/병기 authority 변경 없음

PRE/POST 모두 각 클라이언트가 독립적으로 읽거나 즉시 건너뛸 수 있다.

## 회귀 계약

`apps/client/test/guest-coop-story-wiring.test.ts`가 다음 wiring을 고정한다.

- main scene이 guest coop story adapter를 사용
- PRE stage story lookup
- BATTLE_FINISHED 기반 POST 후보 판정
- durable guest clear 성공 문구 확인 뒤 POST 표시
- 기존 guest coop persistence 경로가 그대로 유지됨

전체 CI는 이번 콘텐츠 묶음에서는 재실행하지 않았다. 다음 통합 마일스톤에서 함께 검증한다.

## 남은 스토리 범위

초판의 자동 재생 경로 기준으로는 솔로, trusted 로그인 전투, 친구 협동, 공개 협동, 참가 코드형 협동이 모두 연결됐다.

남은 것은 기능 필수 범위가 아니라 다음 품질 작업이다.

- 실제 2인 기기 플레이에서 overlay/READY/전투 시작 동시성 확인
- 640×360 및 모바일 safe area 검수
- 4장 연속 플레이 문장 톤/피로도 사람 검수
- 도감/기록실 수동 다시 보기(후순위)
