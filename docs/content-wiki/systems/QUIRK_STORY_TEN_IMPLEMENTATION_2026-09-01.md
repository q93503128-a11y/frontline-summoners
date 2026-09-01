# 숨김 업적 — 열 명의 이야기 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_QUIRK_STORY_TEN_LATE`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

## 1. 조건 확정

기존 기획의 `STORY 10종만으로 특정 후반 스테이지 완료 후보`를 1차 실행 조건으로 구체화했다.

숨김 업적 `ach_quirk_story_ten` / fact `quirk_story_ten_late`의 현재 조건:

- 대상 전장: **`main_04_020`**, 메인 4장 최종전
- 승리 필요
- 10칸 편성을 모두 채워야 함
- 편성은 정확히 초기 STORY 10종만 사용
- 순서 자유
- 중복 불가
- 모집/SPECIAL 캐릭터가 한 명이라도 섞이면 조건 실패

정본 STORY 10:

1. `militia` — 징집병
2. `guard` — 방벽기사
3. `hunter` — 수렵창병
4. `duelist` — 결투검사
5. `lancer` — 청창대
6. `battlemage` — 전투마도사
7. `pyromancer` — 화염술사
8. `royal` — 왕실기사
9. `heretic` — 이단주술사
10. `voidsage` — 공허현자

공용 판정은 `packages/sim/src/achievement-quirks.ts`의 `qualifiesStoryTenLateQuirk`가 담당한다.

## 2. 게스트

게스트 솔로 MAIN 결과는 실제 durable progress에서 전투에 사용한 effective deck을 다시 확인한다.

`main_04_020` 승리 + STORY 10 정확 일치 시:

- `recordGuestAchievementFact(..., 'quirk_story_ten_late')`
- 기존 guest achievement/profile 자동 claim 경로로 `badge_story_ten` 소유
- 결과 화면에 처음이면 `숨겨진 업적 달성 · 열 명의 이야기`
- 이미 달성한 계정으로 같은 조건을 다시 만족하면 `숨겨진 업적 조건 재달성`으로 표시해 중복 신규 지급처럼 보이지 않게 함

업적 장식은 반복 지급되지 않는다.

## 3. 로그인 계정 / trusted battle

클라이언트가 `STORY 10으로 깼다`를 자기신고하지 않는다.

서버는 trusted battle 시작 시 이미 저장해 둔 `start_snapshot_json`의 `deckSlotIds`를 사용한다.

`main_04_020` trusted replay가 승리로 끝나고 account MAIN mutation이 성공하면 서버가 시작 snapshot을 기준으로 같은 shared rule을 검증한 뒤:

- `recordAccountAchievementFact(..., 'quirk_story_ten_late')`
- account profile achievement sync
- `badge_story_ten` 소유권 자동 반영

전투 시작 뒤 다른 탭에서 덱을 바꾸면 account revision 충돌 경계가 먼저 작동하므로 현재 덱을 사후 조작해 조건을 위조하는 경로로 사용하지 않는다.

trusted 결과 화면은 claim이 돌려준 authoritative account snapshot의 deck을 같은 shared rule로 확인해 `숨겨진 업적 · 열 명의 이야기`를 표시한다. 이 표시는 UX용이며 실제 업적 권위는 서버 fact 기록이다.

## 4. 왜 메인 최종전인가

이 업적은 STORY 캐릭터를 단순히 10칸에 넣는 수집 체크가 아니라, 모집 고성능 캐릭터 없이 1차 메인 최종전을 넘기는 기묘한 도전으로 둔다.

- 정상 메인 진행을 막지 않음
- 숨김 업적이라 정답덱을 강제하지 않음
- 장식 보상만 존재
- STORY 10 모두를 실제 전투 편성에 사용하게 만듦

난도가 과도하면 사람 플레이 QA에서 대상 전장을 4장 후반의 다른 지정 전장으로 조정할 수 있으나, 현재 실행 조건은 `main_04_020` 하나다.

## 5. 남은 QUIRK fact source

현재 숨김 업적 4종 중 실제 fact source가 닫힌 것은 `quirk_story_ten_late`다.

아직 전투 이벤트 attribution이 필요한 항목:

- `quirk_turnip_five` — 순무기수 5기 동시 생존
- `quirk_duck_mech_finish` — 태엽오리기사의 MACHINE 보스 마무리 타격
- `quirk_bellcrab_multi` — 종껍질 게 한 공격으로 다수 적 타격

이 세 조건은 클라이언트 추정값으로 처리하지 않고 deterministic combat hit/kill event source를 공용 simulation에서 노출한 뒤 guest와 trusted replay가 같은 판정을 쓰도록 하는 것이 다음 구현 방향이다.

## 6. 상태 경계

구현됨:

- shared STORY 10 roster rule
- guest fact source
- authenticated trusted start-snapshot 검증
- account profile fact source
- guest/trusted 결과 화면 reveal
- 기존 `badge_story_ten` 실소유권 연결

아직 `TESTED/LOCKED`가 아님:

- STORY 10 F1/F2/F3 조합별 실제 최종전 난이도
- 모바일 결과 텍스트 최종 레이아웃
- badge production art

전체 CI는 현재 콘텐츠 묶음이 더 진행된 뒤 통합 검증에서 실행한다.
