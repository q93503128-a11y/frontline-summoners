# 캐릭터 초상화·도감 문구·모집 Reveal 상세 사양

상태: `DESIGN_TARGET`  
상위: 각 캐릭터 art bible, `UI_SCREEN_LAYOUT_TOUCH_SPEC.md`, `GROWTH_RECRUITMENT_DESIGN.md`

목적은 전투 미니어처, 도감 초상화, 모집 결과 연출이 서로 다른 캐릭터처럼 보이는 문제를 막고, 고희귀 연출이 길고 피곤한 뽑기 영상으로 변질되지 않게 하는 것이다.

---

# 1. 초상화 공통 원칙

초상화는 전투 미니어처와 동일한 캐릭터 디자인을 사용한다.

금지:

- 얼굴형/헤어/무기/장식이 전투 모델과 달라짐
- rarity 연출을 위해 캐릭터 색을 임의 변경
- F1 portrait를 F3 도감에 그대로 사용
- 인간형 아닌 캐릭터를 억지 human face crop으로 표현

형태별 silhouette와 대표 소품이 portrait에서도 보이게 한다.

---

# 2. Portrait 종류

최소 3종 crop을 지원하는 방향.

## ICON

사용:

- 전투 슬롯
- 작은 목록
- 친구/PvP deck preview

목표:

- 1:1
- 얼굴 또는 가장 식별력 높은 전면부
- 무기/꼬리/등짐 중 핵심 하나 포함 가능

## CARD

사용:

- 편성 grid
- 모집 결과
- 성장 화면

목표:

- 3:4 또는 4:5
- 상반신/주요 몸체
- 대표 무기/소품 포함

## CODEX HERO

사용:

- 도감 상세
- series preview

목표:

- 16:10~3:2 영역 대응
- 전신 또는 캐릭터 성격이 가장 잘 드러나는 pose
- background는 캐릭터 silhouette를 방해하지 않는 얕은 motif

---

# 3. 비인간 캐릭터 framing

괴수/기계/구조물은 얼굴을 찾으려고 강제 crop하지 않는다.

예:

- 세계등짐 고르무: 머리+등짐 산 실루엣까지 보여야 함
- 오버레이 아스트라: 중앙 core + 부유 blade ring 전체가 식별 포인트
- 종껍질 게: 몸+종껍질 비율이 핵심
- 고철 운석차: 투석 구조까지 포함

ICON에서도 핵심 구조가 잘리면 head crop 대신 emblematic body crop을 사용한다.

---

# 4. 형태별 portrait

F1/F2/F3는 각각 portrait를 가진다.

조건:

- 같은 카메라 각도 복붙 가능하지만 외형 변화가 읽혀야 함
- 진화가 큰 캐릭터는 pose도 변화 가능
- F3만 과도하게 광원/효과를 넣어 실제 디자인을 가리지 않음

도감에서 형태 전환 시 portrait/miniature/stat을 함께 전환한다.

---

# 5. STORY portrait

STORY는 rarity frame을 사용하지 않는다.

대신 획득 분류를 별도 작은 표식으로:

`STORY`

또는 세계관형 `기본 전선` 아이콘 후보.

C/B/A/S/SS frame을 STORY에 억지 매핑하지 않는다.

---

# 6. Rarity frame

C/B/A/S/SS는 frame의 장식 강도가 증가할 수 있다.

단 색만으로 rarity를 구분하지 않는다.

- C: 단순 테두리 + C
- B: 작은 금속/문장 + B
- A: 추가 motif + A
- S: series emblem 포함 후보 + S
- SS: series-specific 최고 frame + SS

frame이 portrait 면적의 20% 이상을 먹지 않게 한다.

---

# 7. 도감 문구 길이

스토리는 핵심이 아니므로 도감 lore를 장문으로 만들지 않는다.

캐릭터별 권장:

- 한 줄 캐치: 12~28자
- 짧은 설명: 40~100자
- 전투 설명: 시스템 생성/정형 정보로 별도

예시 구조:

```text
이름
한 줄 캐치
짧은 세계관 설명

[전투 정보]
역할 / 속성 / 태그 / 수치 / 능력
```

lore가 전투 정보를 밀어 아래로 숨기지 않는다.

---

# 8. 도감 문체

톤:

- 짧고 개성 있음
- 약간의 유머/이상함 허용
- 세계관 백과사전처럼 과도하게 장중하지 않음

금지:

- 개발 메모
- 밸런스 설명
- 내부 ID
- `DPS가 좋아서 추천` 같은 공략자 말투를 lore에 섞음

전투 설명은 별도 전략 정보 영역.

---

# 9. 미획득 캐릭터

도감:

- silhouette
- `???`

획득 전에는 full portrait를 공개하지 않는다.

단 모집 라인업 화면은 확률 고지를 위해 캐릭터 이름/희귀도/라인업 정보를 제공할 수 있다.

도감 미획득 정책과 모집 확률 공개 정책을 혼동하지 않는다.

---

# 10. 모집 Reveal 전체 목표

좋은 reveal은 rarity를 체감시키되 반복을 방해하지 않는다.

목표 길이:

- C/B: 0.4~0.8초
- A: 0.7~1.1초
- S: 1.2~2.0초
- SS: 2.0~3.5초

처음 획득한 S/SS는 조금 더 길 수 있으나 5초 이상 강제 연출을 기본으로 하지 않는다.

---

# 11. 공통 Reveal sequence

기본:

1. summon token/card 등장
2. rarity cue
3. silhouette reveal
4. character portrait/name
5. NEW/duplicate 처리

duplicate 정보는 reveal climax 전에 떠서 희귀 결과 감정을 깨지 않게 한다.

---

# 12. C/B

목적: 빠름.

- 단일 flash/flip
- portrait
- name
- rarity

사용자가 10회 모집에서 C/B 때문에 수초씩 기다리지 않게 한다.

Skip을 누르지 않아도 빠르게 지나감.

---

# 13. A

- 1단계 추가 motif
- 짧은 emblem burst
- silhouette delay 0.2~0.4초 후보

S처럼 과도한 컷인을 사용하지 않는다.

---

# 14. S

S는 series identity를 보여준다.

공통:

- series emblem
- 고유 background motif
- 짧은 character action pose 또는 parallax
- S label

전체 1.2~2초 목표.

같은 series S 5명이 완전히 같은 animation이어도 되지만 character silhouette/pose가 분명히 달라야 한다.

---

# 15. SS 공통 규칙

시리즈당 정확히 1명인 만큼 SS는 각 series의 최고 상징.

필수:

- 일반 S와 시작 cue부터 차이
- series-specific sequence
- 해당 SS의 핵심 silhouette를 reveal 자체에 활용
- 2~3.5초
- 첫 획득은 Skip 가능하지만 선택적으로 조금 더 감상할 수 있음

금지:

- 10초 이상의 강제 cinematic
- 화면 전체 반복 strobe
- 확률 결과를 일부러 오래 감춤
- SS인데 실제 portrait는 일반 S frame 재사용

---

# 16. 성휘의 기사단 Reveal

시리즈 motif:

- 천문 문장
- 금속/유리 장식
- 별빛 궤도

S:

1. 기사단 문장
2. 무기 silhouette line
3. portrait

SS 아르셀리아:

1. 화면 중앙 어두워짐
2. 작은 별 5~7개가 원형 궤도
3. 궤도가 여왕의 별 구조체 silhouette로 정렬
4. 망토 내부 밤하늘 reveal
5. 이름/SS

과도한 은하 full-screen noise 금지.

---

# 17. 태고의 거수 Reveal

시리즈 motif:

- 흙/암석 crack
- 거대한 발자국
- 낮은 진동

S:

1. 땅 흔들림
2. creature silhouette
3. dust clear
4. portrait

SS 세계등짐 고르무:

1. 화면 아래 지면 crack
2. 멀리 산처럼 보이는 silhouette
3. 실제로 걸어 움직이며 괴수임을 reveal
4. 등에 성채/숲 silhouette 강조
5. 이름/SS

카메라 흔들림 reduce-motion 옵션 반영.

---

# 18. 제로 엣지 Reveal

시리즈 motif:

- scan line
- blade alignment
- clean machine UI

S:

1. target scan
2. unit outline
3. system lock
4. portrait

SS 오버레이 아스트라:

1. 중앙 core 점등
2. 6~8 blade module이 화면 외곽에서 진입
3. 원형 정렬
4. 순간적으로 일직선 blade formation
5. full silhouette reveal
6. 이름/SS

실제 게임 HUD처럼 보이는 debug text를 연출에 사용하지 않는다.

---

# 19. 10회 모집

기본 UX:

- 사용자가 `전체 빠르게 보기` 가능
- C/B/A는 빠르게
- S/SS 발견 시 자동 작은 pause 후보
- 이미 본 S/SS 연출은 설정/Skip에 따라 생략 가능

결과 grid:

- 10개 모두 표시
- rarity
- NEW
- duplicate/+재화 상태

고희귀 결과를 grid에서도 쉽게 식별.

---

# 20. Skip

모집 reveal Skip은 즉시 반응.

Skip 종류 후보:

- 현재 연출 건너뛰기
- 남은 일반 결과 빠르게 보기

SS를 뽑았다고 Skip 버튼을 없애지 않는다.

Skip 후 결과 데이터는 이미 확정되어 있어야 하며 연출이 결과 판정을 결정하지 않는다.

---

# 21. Duplicate 표시

결과 portrait reveal 후:

- `중복`
- 직접 +1 가능
- 분해 가능

을 결과 단계에서 표시.

중복 때문에 S/SS 연출 자체를 저급하게 바꾸지 않는다.

---

# 22. NEW 표시

NEW는 rarity보다 작은 보조 badge.

첫 획득:

- NEW
- 도감 등록

NEW badge가 캐릭터 이름을 가리지 않게 한다.

---

# 23. Portrait 배경

series portrait의 배경 motif는 약하게 사용 가능.

- 성휘: 별/문장
- 거수: 지층/흙
- 제로 엣지: grid/기계 line

공통 C/B/A는 캐릭터 개별 소재를 얕게 쓰되 배경만 보고 rarity를 오해하지 않게 한다.

---

# 24. 코드/도감 pose

CODEX HERO pose는 idle과 완전히 동일할 필요는 없다.

허용:

- 무기 보여주기
- 대표 silhouette 강조
- 시선/자세 조정

금지:

- 전투에서 없는 장비 추가
- 몸 비율 변경
- F1에서 F3 장식 선사용

---

# 25. 캐릭터별 한 줄 설명 작성 규칙

템플릿을 강제하지 않지만 다음 중 하나를 담는다.

- 역할 정체성
- 성격/기묘함
- 세계관 위치

예:

`전선에서 가장 먼저 쓰러지고, 가장 먼저 다시 돌아오는 병사.`

처럼 짧게.

전 캐릭터를 `~의 전사`, `~을 다루는 기사` 형태로 반복하지 않는다.

---

# 26. 도감 전략 설명

lore와 별도로 자동/정형 영역:

- 역할
- 강점
- 약점
- 유효 대상
- 사거리
- 비용
- 재생산

고급 유저는 정확한 숫자까지 볼 수 있어야 한다.

`공격력이 높다` 같은 모호한 말만 두지 않는다.

---

# 27. Portrait Asset ID

권장:

```text
portrait/{characterId}/{formId}/icon
portrait/{characterId}/{formId}/card
portrait/{characterId}/{formId}/hero
```

rarity frame은 character art에 bake하지 않고 UI layer로 분리.

같은 portrait 파일을 색칠해 rarity frame까지 포함하지 않는다.

---

# 28. Reveal Asset

시리즈 공통:

```text
recruit/{seriesId}/s_intro
recruit/{seriesId}/ss_intro
```

캐릭터별:

```text
recruit/{characterId}/silhouette
recruit/{characterId}/pose
```

가능한 공통 system을 재사용하되 SS의 핵심 silhouette motion은 개별 정의.

---

# 29. 접근성

- Reduce Motion: camera zoom/큰 shake 감소
- Flash Reduction: full-screen flash 대체
- Skip 항상 사용 가능
- rarity color + text/icon
- SS audio cue 없이도 visual로 식별

---

# 30. 실패 조건

- F3 도감에 F1 portrait 사용
- 비인간 캐릭터의 핵심 구조가 crop으로 사라짐
- STORY에 C/B/A/S/SS frame 표시
- SS reveal이 5초 이상 강제
- Skip 불가
- reveal이 debug UI처럼 보임
- 결과 grid에서 NEW/duplicate가 이름을 가림
- portrait와 battle miniature의 장비가 다름
- 미획득 도감에서 full portrait 노출
- lore가 너무 길어 실제 전투수치를 찾기 어려움

---

# 31. TESTED 전환

각 시각군에서 대표 캐릭터:

- STORY 인간형
- STORY 비정상/마법형
- C/B/A 각 1
- series S 각 1
- SS 3명

을 실제 UI에 넣어:

- ICON 54px 전후
- CARD mobile/desktop
- CODEX hero
- 10회 모집
- Reduce Motion/Flash Reduction

을 검사한 뒤 TESTED.
