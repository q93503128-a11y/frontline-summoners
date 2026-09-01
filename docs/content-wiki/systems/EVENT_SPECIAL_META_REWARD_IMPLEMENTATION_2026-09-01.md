# 이벤트 SPECIAL 메타 보상 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_EVENT_SPECIAL_PROFILE_AND_SWEEP_META_REWARDS`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/stages/special/EVENT_AND_RECORD_SPECIALS_DETAILED.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

## 1. 목적

기간 이벤트 전장은 이미 실행 가능했지만, 설계에 있던 소탕권과 이벤트 전용 프로필 보상이 공용 재화 보상 뒤에 남아 있었다.

이번 구현은 별도의 이벤트 전용 파밍 화폐를 새로 늘리지 않고 기존 SPECIAL clear + achievement/profile 체계로 메타 보상을 실제 소유권까지 닫는다.

## 2. 한여름 괴수 대소동

실제 첫 클리어 메타 보상:

- `event_summer_01_01`: 소탕권 1
- `event_summer_01_03`: 소탕권 1 + 배너 `한여름 해변`
- `event_summer_01_05`: 테두리 `괴수 불꽃놀이`
- `event_summer_01_06`: 소탕권 2 + 칭호 `한여름 대소동` + 문장 `여름 괴수 토벌`

프로필 content identity:

- `banner_event_summer_kaiju`
- `frame_event_summer_kaiju`
- `title_event_summer_kaiju`
- `emblem_event_summer_kaiju`

이벤트 스테이지가 순차 해금되므로 3/5/6번째 전장 클리어 자체가 각각 누적 3/5/6전장 진행 milestone이다. 별도 포인트 화폐나 일일 미션을 강제로 추가하지 않는다.

## 3. 제로 엣지 시험운용

실제 최종 메타 보상:

- `event_zero_edge_01_05`: 소탕권 2 + 문장 `프로토콜-0 돌파`

프로필 content identity:

- `emblem_event_zero_edge`

픽업 S/SS 보유 여부, 모집 횟수, 숨은 확률 보정은 이벤트 보상 조건에 사용하지 않는다.

## 4. 게스트 / 로그인 계정

게스트:

- 기존 `recordSpecialStageClear`가 공용 `resolveSpecialResourceReward`를 사용하므로 첫 클리어 소탕권이 같은 durable guest resource ledger에 기록된다.
- SPECIAL 결과 직후 guest achievement/profile을 동기화하여 새 이벤트 장식을 즉시 owned cosmetic으로 만든다.

로그인 계정:

- 기존 authoritative SPECIAL mutation이 같은 shared reward table을 사용해 소탕권을 account save에 저장한다.
- authoritative SPECIAL clear 성공 직후 account profile achievement sync를 수행해 이벤트 장식을 바로 서버 프로필 소유권으로 반영한다.
- 협동 SPECIAL 승리도 `applyAccountSpecialBattleResult`를 공용하므로 같은 profile reward 경로를 사용한다.

## 5. 결과 화면

로컬/게스트 결과와 trusted account 결과 모두 첫 클리어일 때 해당 SPECIAL stage에 연결된 프로필 보상 이름을 재화 보상 아래에 표시한다.

따라서 이벤트 보상이 단순히 도감/프로필 화면을 나중에 열었을 때 조용히 생기는 형태가 아니라, 획득 순간에 플레이어에게 보인다.

## 6. 복각과 반복 플레이

- 이벤트 기간 중 플레이 횟수 자체는 제한하지 않는다.
- 기존 첫 클리어 기록은 계정에 유지하므로 첫 클리어 소탕권/프로필 장식을 복각마다 중복 지급하지 않는다.
- 반복 플레이는 기존 event `repeatReward`를 계속 지급하며 전용 주기 재화전보다 낮은 효율을 유지한다.
- 신규 이벤트 스테이지가 후속 복각에서 추가되면 그 신규 stage 보상만 별도로 추가할 수 있다.
- 이벤트 캐릭터가 실제 추가되는 시점에는 한 최종 stage 독점 드랍이 아니라 별도 누적 획득 경로를 설계한다.

## 7. 상태 경계

코드/소유권/결과 표시까지 구현되었지만 아래는 아직 `TESTED/LOCKED`가 아니다.

- 소탕권 수량의 실제 경제 체감
- 프로필 장식 production art asset
- 이벤트 전장 전체 사람 플레이 밸런스
- 복각 운영 시 실제 유저 복귀 동선

따라서 현재 콘텐츠 상태는 구현 완료이며, 수치와 미술 자산은 사람 QA 후 승격한다.
