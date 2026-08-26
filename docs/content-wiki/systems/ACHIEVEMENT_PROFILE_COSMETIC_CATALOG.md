# 업적·프로필·장식 카탈로그 v1

상태: `DESIGN_TARGET`  
상위: `GAME_DESIGN_FULL.md`, `PVP_RANKING_MMR_REWARDS.md`, `REWARD_ECONOMY_AND_SKIP.md`

목표는 메인·SPECIAL·협동·PvP의 장기 목표를 제공하되, 업적이 필수 성장 체크리스트나 매일 접속 숙제로 변하지 않게 하는 것이다.

---

# 1. 업적 철학

업적은 다음 역할을 한다.

- 자연스러운 진행 기념
- 다양한 덱/모드 탐색 유도
- 개인 기록 표현
- 프로필 꾸미기 해금

업적을 하지 않았다고 정상 성장이 막히지 않는다.

금지:

- 매일 10판 30일 연속 같은 출석성 업적
- PvP 상위권만 필수 성장재화 획득
- 기간 이벤트 한 번 놓치면 영구 성능 손해
- 재미없는 반복 횟수만 수백/수천 단위로 늘린 업적

---

# 2. 업적 상태

- LOCKED: 숨김 또는 조건 힌트
- IN_PROGRESS
- COMPLETE
- CLAIMED 또는 자동지급

1차 추천은 완료 즉시 자동 지급 + 결과 toast/card.

보상 수령 버튼을 눌러야만 재화를 받는 불필요한 우편함형 구조는 피한다.

---

# 3. 업적 카테고리

- 메인 진행
- 캐릭터/성장
- 전투
- SPECIAL
- 협동/친구
- PvP
- 기록
- 수집/도감
- 기묘한 도전

UI에서 카테고리를 너무 잘게 나누지 않는다.

---

# 4. 보상 타입

주력:

- 칭호
- 프로필 테두리
- 배너
- 문장/emblem
- 프로필 배경
- 소량 Gold
- 모집재화
- 소탕권

업적 전용 필수 진화재료는 두지 않는다.

성능 보상은 있어도 보조 수준으로 제한한다.

---

# 5. 프로필 구성

프로필에 표시 가능한 항목:

- nickname
- 대표 portrait/character
- title 1개
- frame 1개
- banner/background 1개
- emblem 1개
- PvP tier
- selected achievement badges 0~3개 후보
- 메인 진행도

숨길 수 있는 정보:

- 세부 PvP 승률
- 친구 코드
- 최근 접속

privacy 설정은 계정 시스템과 연결.

---

# 6. 칭호 규칙

한 번에 1개 장착.

길이:

- 한국어 2~12자 권장
- 최대 16자 후보

칭호가 닉네임보다 3배 길어 UI를 깨지 않게 한다.

예:

- 국경 돌파자
- 숲을 지난 자
- 세라페의 손님
- 기어를 멈춘 자
- 황금 운송감독
- 끝없는 10분
- 전선의 짝꿍

---

# 7. 프로필 테두리

테두리는 rarity처럼 성능 오해를 만들지 않는다.

종류 후보:

- 기본 목재
- 국경 철제
- 숲 덩굴
- 세라페 유리
- 기어 금속
- 황금 수송대
- PvP tier seasonal
- 이벤트 theme

화려한 frame도 portrait를 가리지 않는다.

---

# 8. 배너/배경

프로필 카드 가로 배경.

- 메인 장 테마
- SPECIAL collection
- 모집 series
- 이벤트
- PvP season

배경 text contrast를 자동/반투명 overlay로 유지.

---

# 9. 메인 진행 업적

| id | 조건 | 보상 후보 |
| --- | --- | --- |
| ach_main_c1 | 제1장 완료 | `국경 돌파자` 칭호 + 국경 frame |
| ach_main_c2 | 제2장 완료 | 숲 banner |
| ach_main_c3 | 제3장 완료 | 세라페 frame |
| ach_main_c4 | 제4장 완료 | `첫 전선 완주` 칭호 + 기어 banner |
| ach_main_20 | 메인 20 NORMAL_CLEAR | Gold + 소탕권 |
| ach_main_40 | 메인 40 NORMAL_CLEAR | 모집재화 소량 |
| ach_main_60 | 메인 60 NORMAL_CLEAR | emblem |
| ach_main_80 | 메인80 NORMAL_CLEAR | 1차 완주 badge |

협동 클리어도 NORMAL_CLEAR이므로 동일 카운트.

---

# 10. SPECIAL 업적

| id | 조건 | 보상 후보 |
| --- | --- | --- |
| ach_special_unlock | SPECIAL 허브 개방 | SPECIAL emblem |
| ach_gold_1 | 황금 수송대 I 완료 | Gold 소량 |
| ach_gold_5 | 황금 수송대 V 완료 | 황금 frame |
| ach_soul_4 | 혼의 제련소 최종 완료 | soul emblem |
| ach_evo_5 | 진화의 문 V 완료 | gate banner |
| ach_star_4 | 별빛 균열 IV 완료 | star background |
| ach_permanent_3 | 상시 collection 3종 최종 완료 | 모집재화 |
| ach_special_20 | SPECIAL 개별 stage 20종 NORMAL_CLEAR | 소탕권 |

반복 farming 횟수 500회 같은 업적은 만들지 않는다.

---

# 11. 성장/캐릭터 업적

| id | 조건 | 보상 후보 |
| --- | --- | --- |
| ach_lv10 | 첫 캐릭터 Lv10 | Gold |
| ach_lv50 | 첫 캐릭터 Lv50 | `완성된 전선병` 칭호 |
| ach_plus10 | 첫 +10 | soul_shard 소량 |
| ach_plus50 | 첫 +50 | plus emblem |
| ach_f2 | 첫 F2 | evo material 소량 |
| ach_f3 | 첫 F3 | evolution frame |
| ach_f3_10 | F3 10종 해금 | 모집재화 |
| ach_owned10 | 아군 10종 보유 | Gold |
| ach_owned25 | 25종 보유 | collection banner |
| ach_owned40 | 40종 보유 | emblem |

+50은 장기 목표지만 SS +50을 요구하는 업적은 별도로 강제하지 않는다.

---

# 12. 도감 업적

- 아군 20종 발견/획득
- 적 20종 발견
- 적 50종 발견
- 메인 적 도감 주요군 완성

보상은 장식/소량 재화.

미획득 캐릭터를 강제로 다 뽑아야 얻는 강한 성능 보상은 금지.

---

# 13. 전투 업적

재미가 실제 행동과 연결되는 것만.

후보:

- 한 전투에서 보급소 Lv8 도달
- 거점 병기로 보스 마지막 타격
- 기지 HP 10% 이하에서 승리
- 3종 이하 캐릭터로 특정 제한전 클리어
- 범위 유닛 없이 지정 SPECIAL 클리어 후보

일반 메인의 정답덱을 강요하는 업적은 최소화한다.

---

# 14. 협동 업적

| id | 조건 | 보상 |
| --- | --- | --- |
| ach_coop_first | 첫 협동 NORMAL_CLEAR | `전선의 짝꿍` 칭호 |
| ach_coop_10 | 서로 다른 협동 stage 10종 완료 | duo emblem |
| ach_coop_friend | 친구와 첫 협동 | 소탕권 소량 |
| ach_coop_revive | 재접속 후 정상 승리 후보 | 장식 또는 없음 |

협동 1000판 같은 강제 grind는 피한다.

---

# 15. PvP 업적

실력/참여를 구분한다.

참여:

- 첫 일반전
- 첫 랭킹전
- 첫 친선전

티어:

- 최초 Silver
- Gold
- Platinum
- Diamond
- Master 후보

상위 랭킹:

- 시즌 top 100/10 등은 **장식 전용** 후보.

PvP 업적에서 영구 전투 성능을 주지 않는다.

---

# 16. 기록 업적

끝없는 전선:

- 5분
- 8분
- 10분
- 12분 후보

보스 러시:

- 3보스
- 5보스
- 8보스
- 전체 1차 boss route 완료 후보

난이도/실제 기록 분포를 보고 수치 조정.

---

# 17. 기묘한 도전 업적

게임 톤을 살리는 소수의 재미용 업적.

예:

- 순무기수 5기 이상 동시에 전장에 유지
- 태엽오리기사로 기계 보스 마무리
- 종껍질 게의 종소리로 한 번에 다수 적 타격
- STORY 10종만으로 특정 후반 스테이지 완료 후보

조건을 몰라도 우연히 달성 가능한 것이 좋다.

숨김 업적은 보상이 크지 않아야 한다.

---

# 18. 이벤트 업적

기간 이벤트 업적은 복각 시 다시 달성 가능해야 한다.

최초 개최 전용으로 남길 수 있는 것:

- 날짜가 적힌 기념 badge
- 성능 없는 장식

금지:

- 최초 개최만 캐릭터 성능 해금
- 복각 시 업적 불가능

---

# 19. 일일/주간 과제와 분리

업적은 영구 milestone.

일일/주간 과제를 도입하더라도 다른 시스템이며 1차 필수 아님.

업적 목록에 `오늘 3판` 같은 항목을 넣지 않는다.

---

# 20. 알림

업적 완료:

- 전투 중: 작은 unobtrusive toast, 필요하면 결과에서 상세
- 메타 화면: toast/card

보상 때문에 전투를 중단하는 fullscreen popup 금지.

---

# 21. 프로필 공개 정보

기본 공개 후보:

- nickname
- portrait
- title/frame/banner/emblem
- current PvP tier
- 선택 badge

옵션 공개:

- 최고 끝없는 전선 기록
- 최고 보스 러시
- main completion

비공개:

- email
- account ID
- save revision
- 내부 MMR 정확값은 랭킹 UI 정책에 따라 공개 가능

---

# 22. 친구 코드

프로필에서 본인 친구 코드를 복사할 수 있다.

다른 사용자의 친구 코드를 무단으로 전체 공개하는 검색 디렉터리는 만들지 않는다.

친구 검색 정책은 social spec을 따른다.

---

# 23. PvP 시즌 장식

시즌 frame/banner:

- 해당 시즌 식별 motif
- tier/상위 rank에 따라 장식 강도 차이

시즌 종료 후 계속 장착 가능 후보.

다만 과거 시즌 장식을 못 얻었다고 프로필 기본 기능이 제한되지 않는다.

---

# 24. 장식 선택 UX

프로필 편집:

- 대표 캐릭터
- 칭호
- frame
- banner
- emblem
- badge slots

미보유 장식은 잠금 상태로 조건을 표시할 수 있다.

기간 종료로 현재 불가능한 조건은 `복각 예정` 등 정확한 설명 필요.

---

# 25. 장식 asset 구조

권장:

```text
profile/frame/{id}
profile/banner/{id}
profile/emblem/{id}
profile/badge/{id}
```

장식 ID와 업적 ID를 같은 문자열로 묶지 않는다.

하나의 장식을 여러 경로에서 지급할 수 있기 때문.

---

# 26. achievement 데이터 필드

최소:

```text
achievementId
category
name
shortDescription
visibility
progressType
requirement
rewardIds[]
seasonId?
eventId?
repeatable=false
```

업적 로직을 UI 코드에서 직접 if문으로 늘리지 않는다.

---

# 27. progressType 후보

- BOOLEAN
- COUNT
- MAX_VALUE
- UNIQUE_SET_COUNT
- TIER_REACHED
- STAGE_CLEAR_SET

자유로운 스크립트 조건은 최소화하고 등록된 evaluator 사용.

---

# 28. 보상 idempotency

업적 완료 보상은 중복 지급되면 안 된다.

서버 계정:

```text
achievementId + accountId
```

등을 기준으로 claim 상태를 원자적으로 처리.

게스트도 local save에서 중복 수령 방지.

---

# 29. 초기 업적 수 목표

1차 후보:

- 진행 8
- 성장/수집 12
- SPECIAL 8
- 협동 4
- PvP 6~10
- 기록 6
- 기묘/숨김 4~8

총 약 **45~55개**.

숫자를 채우기 위해 `100회/500회/1000회` 반복 업적을 복제하지 않는다.

---

# 30. 실패 조건

- 업적 안 하면 정상 F3 진화 불가능
- PvP top rank만 성능 아이템 획득
- 이벤트 최초 개최 한정 성능
- 완료했는데 수령 버튼을 몰라 보상 영구 미수령
- 동일 업적 보상 중복 지급
- 50개 중 30개가 단순 횟수 grind
- 숨김 업적이 필수 재화를 줌
- 장식 frame이 캐릭터 portrait를 심하게 가림
- 칭호 길이 때문에 친구/PvP UI 깨짐

---

# 31. TESTED 전환

실제 프로필/업적 화면 구현 후:

- 신규 계정
- 메인 완주 계정
- PvP 계정
- 이벤트 종료/복각 계정
- guest→login migration

을 테스트하고 achievement progress/reward idempotency를 검증한 뒤 TESTED.
