# 화면별 UI 레이아웃·터치·반응형 상세 사양

상태: `DESIGN_TARGET`  
상위: `docs/GAME_DESIGN_FULL.md`, `UI_UX_ENCYCLOPEDIA.md`, `SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`

목적은 실제 구현자가 화면마다 임의의 크기/간격/입력 방식을 다시 정하지 않도록 **PC와 모바일 가로화면의 구체적인 UI 구조와 상호작용 수치**를 정의하는 것이다.

CSS px 기준이며 최종 아트/브라우저 테스트로 일부 조정 가능하다.

---

# 1. 지원 viewport 원칙

전투와 핵심 메타 UI는 가로화면을 기준으로 한다.

실전 검증 viewport:

- 640×360
- 720×405
- 844×390
- 915×412
- 960×540
- 1024×576
- 1280×720
- 1366×768
- 1600×900
- 1920×1080

세로 viewport에서 전투를 시작하려 하면 회전 안내를 표시한다.

메타 화면은 가능하면 세로에서도 치명적으로 깨지지 않게 하지만 1차 완성 품질 기준은 모바일 가로 + PC다.

---

# 2. 반응형 등급

## COMPACT

```text
width < 900 또는 height < 450
```

주 대상:

- 640×360
- 844×390
- 915×412

특징:

- 1열/2열 중심
- 보조 설명 축약
- bottom sheet 적극 사용
- 전투 HUD 최소 높이
- 카드 그림보다 조작 영역 우선

## MEDIUM

```text
900 ≤ width < 1280
```

- 태블릿/소형 노트북
- 좌우 2영역 가능
- 상세 패널과 grid 동시 표시 가능

## WIDE

```text
width ≥ 1280
```

- 데스크톱
- 2~3 column
- side detail panel 사용
- 빈 공간을 카드 크기만 무한 확대해 채우지 않음

---

# 3. Safe Area

모든 고정 UI는 다음을 반영한다.

```css
padding-left: max(basePadding, env(safe-area-inset-left));
padding-right: max(basePadding, env(safe-area-inset-right));
padding-top: max(basePadding, env(safe-area-inset-top));
padding-bottom: max(basePadding, env(safe-area-inset-bottom));
```

기본 basePadding:

- COMPACT: 8px
- MEDIUM: 12px
- WIDE: 16px

노치 영역에:

- Skip
- 뒤로가기
- 생산 버튼
- PvP surrender
- 소탕 확인

같은 핵심 조작을 놓지 않는다.

---

# 4. 터치 크기

최소 터치 hit area:

- 일반 버튼: **44×44**
- 주요 행동 버튼: **48×48 이상**
- 전투 캐릭터 슬롯 COMPACT: 최소 **54×58**
- 위험/확정 버튼: 최소 **52px 높이**

아이콘 그림 자체가 24px이어도 투명 hit area는 44px 이상 확보한다.

버튼 사이 간격:

- 최소 6px
- 파괴적/취소가 붙어 있는 경우 10px 이상

텍스트만 있는 20px 높이 링크를 핵심 터치 입력으로 사용하지 않는다.

---

# 5. Typography

최소 렌더 목표:

- 보조 라벨: 12~13px, 중요하지 않은 경우만
- 일반 본문: 14~16px
- 버튼: 14~16px, semibold 후보
- 핵심 자원/전투 숫자: 16~22px
- 화면 제목: 20~30px

COMPACT에서 12px 아래로 줄여 맞추는 것을 금지한다.

글자가 안 들어가면:

1. 문구 축약
2. 줄바꿈
3. container 확장/스크롤

순서로 해결하고 글자를 극단적으로 축소하지 않는다.

---

# 6. 공통 상단바

메타 화면 상단바 목표 높이:

- COMPACT: 48px
- MEDIUM: 56px
- WIDE: 60px

구성:

```text
[뒤로/메뉴] [화면 제목] ........ [Gold] [모집재화] [프로필/설정]
```

COMPACT에서는 모든 재화를 상시 늘어놓지 않고 대표 재화 1~2개 + 재화 상세 버튼으로 축약 가능.

화면 제목이 자원 표시 때문에 잘리면 자원 표시를 축약하지 제목을 잘라내지 않는다.

---

# 7. 메인 홈

목표: 가장 많이 쓰는 진입점을 1~2회 입력 안에 제공.

핵심:

- 출정
- 편성
- 성장
- 모집
- 도감
- 친구
- PvP
- 설정/계정

## COMPACT

- 중앙 2×3 또는 4×2 기능 타일
- 출정은 가장 큰 primary tile
- 하단/우측에 모집/친구/PvP
- 화면당 최대 8개 핵심 항목

## WIDE

- 좌측 메인 출정/현재 진행
- 중앙 이벤트/SPECIAL 요약
- 우측 계정/친구/빠른 진입

붉은 알림점은 실제 새 항목이 있을 때만 사용한다.

---

# 8. 출정 허브

상단 탭:

- 메인
- SPECIAL

SPECIAL이 제1장 전 미해금이면:

A안 기본: 탭은 잠금 상태로 보이고 `제1장 완료 후 개방` tooltip/label 제공.

완전히 숨기는 것보다 이후 콘텐츠 존재를 약하게 알려주는 쪽을 기본 후보로 한다.

제1장 ST20 NORMAL_CLEAR 직후 잠금이 즉시 풀린다.

SPECIAL 내부 분류:

- 상시
- 주기
- 이벤트
- 기록

COMPACT에서는 상단 4탭을 모두 글자+아이콘으로 억지로 좁히지 않고 horizontal segmented scroll을 허용한다.

---

# 9. 메인 장 선택

구성:

```text
[장 배너/지역 아트]
[진행 13/20]
[현재 Lv cap]
[스테이지 목록/지도]
```

COMPACT:

- 장 배너 높이 72~96px
- 스테이지는 가로 지도보다 세로/곡선형 scroll list 우선

WIDE:

- 지도형 배치 가능
- 단 stage node 클릭 영역 44px 이상

잠긴 스테이지는 자물쇠만 두지 않고 필요한 조건을 누르면 설명한다.

---

# 10. SPECIAL collection 화면

collection 카드 표시:

- collection name
- 종류: 상시/주기/이벤트/기록
- 남은 시간 또는 상시
- 진행 단계
- 보상 category
- 보상 충전
- SOLO/COOP
- 최고 난이도

카드를 열면 내부 stage list.

예: 황금 수송대

```text
황금 수송대
보상 충전 3/4   다음 +1 08:42:15

I 외곽의 짐마차       Clear
II 황금 호송대        Clear
III 무장 수송열차     도전 가능
IV 왕실 금고 행렬     제3장 진행 후
V 황금왕의 대수송     잠김
```

COMPACT에서 단계 카드 최소 높이 54px.

고단계 잠금 조건은 자연어 한 줄로 바로 읽히게 한다.

---

# 11. 스테이지 상세 화면

목표: 입장 전에 전략 정보를 한 화면 또는 한 번의 scroll 안에 확인.

표시:

- 이름
- 난이도
- map/theme
- 발견 적
- 첫 클리어 보상
- 반복 보상
- 영구 보상
- NORMAL_CLEAR 여부
- 2배속/소탕 가능 여부
- 멀티 정책

하단 고정 primary actions:

```text
[편성] [혼자 출전] [친구와 협동] [공개 협동]
```

COMPACT에서는 4개를 한 줄에 작은 버튼으로 압축하지 않는다.

권장:

- `혼자 출전` 큰 primary
- `협동` 큰 secondary → 친구/공개 선택 bottom sheet
- `편성` 아이콘 버튼
- `소탕` 조건부 별도 버튼

기록전은 협동 버튼 자체를 표시하지 않는다.

---

# 12. 편성 화면

## 공통 구조

```text
[빠른 필터 / 검색]
[보유 캐릭터 grid]
[고정 deck bar]
```

솔로/1v1 deck 10칸.

협동/2v2 준비 화면은 5칸.

## COMPACT

- deck bar 화면 하단 고정
- 10칸을 한 줄 유지하는 것을 1차 후보로 함
- slot 폭 54~68px 범위
- portrait art는 slot 전체를 가리지 않게 crop
- cost/recharge readiness를 최소 표시

640px 폭에서 safe padding 포함 10칸이 54px 아래로 내려가면:

- 슬롯 사이 gap을 2~3px까지 줄일 수 있음
- 불필요 테두리 제거
- 그러나 터치 hit area는 52px 아래로 내리지 않음

아주 좁은 viewport는 전체 게임 가로 최소폭 경고로 처리하는 것이 낫다.

## MEDIUM/WIDE

- 좌/중앙 캐릭터 grid
- 우측 선택 캐릭터 상세 panel 후보
- deck bar는 하단 고정

---

# 13. 캐릭터 Grid

COMPACT:

- 4~5 columns
- card 최소 92×104 후보

MEDIUM:

- 5~7 columns

WIDE:

- 7~9 columns
- card max width를 제한해 사진만 거대해지지 않게 함

카드 표시 최소:

- portrait
- 이름 축약 가능
- Lv/+Lv
- STORY 또는 rarity
- cost icon/value
- favorite

속성 아이콘 6개를 카드에 전부 우겨 넣지 않는다. 상세 패널에서 확인.

---

# 14. 편성 Drag & Drop

PC:

- mouse down + 4px 이상 move → drag
- deck ↔ grid
- deck slot ↔ deck slot swap

모바일:

- short tap: 선택/상세
- **long press 220ms**: drag mode
- 220ms 전에 finger move 10px 이상이면 일반 scroll로 판정
- drag 시작 시 8~12% 확대
- 가능한 slot highlight
- 화면 가장자리 48px 진입 시 grid auto-scroll

드롭 성공:

- 120~180ms snap animation
- 짧은 tactile/haptic 지원 가능

실패:

- 원래 위치로 복귀
- 이유가 있으면 toast

접근성 fallback:

`캐릭터 선택 → 슬롯 선택` 방식도 항상 제공한다.

드래그만이 유일 입력 방식이면 안 된다.

---

# 15. 상세 필터

빠른 chips:

- 전체
- STORY
- C
- B
- A
- S
- SS

상세 bottom sheet/modal:

- 속성 대항
- 역할
- SINGLE/AREA
- cost range
- range group
- Lv/+Lv
- form
- recent
- favorite

필터 적용 상태는 `필터 3개 적용 중`처럼 숨기지 말고 현재 chip/summary로 표시.

`초기화` 버튼 44px 이상.

---

# 16. 성장 화면

선택 캐릭터 좌측/상단.

중앙:

- 현재 F1/F2/F3
- Lv
- +Lv
- HP/ATK 주요 변화

행동:

- Lv 강화
- +레벨
- 진화
- 형태 선택

강화 전/후 값:

```text
HP 1,240 → 1,310
ATK 360 → 381
Gold 2,400
```

처럼 변화를 즉시 보여준다.

버튼을 누른 뒤 숫자만 조용히 바뀌지 않고 짧은 증가 feedback 제공.

---

# 17. 진화 화면

- F1/F2/F3 preview
- 현재/목표 silhouette
- exact recipe
- 보유/필요 재료
- Gold
- 역할 변화 요약

3형태가 상위호환이 아니므로 `진화하면 무조건 더 강해집니다` 같은 문구 금지.

재선택 가능한 형태는 진화 후 언제든 전환 가능하다는 정보 표시.

---

# 18. 모집 화면

구성:

- series banner
- 남은/복각 정보
- 공통 C/B/A 정책
- 시리즈 S list
- SS 정확히 1
- 확률 보기
- 1회/10회

확률은 별도 modal에 숨기더라도 쉽게 접근 가능해야 한다.

천장 progress UI는 존재하지 않는다.

S/SS 연출은 Skip 제공.

10회 결과는 한 캐릭터씩 강제로 오래 넘기기보다 결과 grid와 고희귀 강조를 병행.

---

# 19. 도감

## 미획득/미발견

- silhouette
- ???

## 획득 아군

상단:

- 캐릭터 name/form
- portrait/miniature

전투 정보:

- Lv/+Lv
- HP
- attack / DPS
- range
- attack cycle
- cost
- recharge
- speed
- KB
- attributes
- tags
- abilities

도감 설명은 전략 정보보다 아래.

외부 위키가 있어야만 핵심 수치를 알 수 있는 구조 금지.

---

# 20. 친구 화면

탭:

- 친구
- 요청
- 최근 플레이어
- 차단

친구 row:

- avatar/profile
- nickname
- online state
- 현재 초대 가능 여부
- `[협동] [친선전] [...]`

COMPACT에서 한 row에 버튼 4개를 넣지 않고 overflow menu 사용 가능.

친구 코드 복사/검색은 한 번에 접근.

---

# 21. 협동 준비방

화면:

```text
[Stage]
[Player A 5 slots]    [Player B 5 slots]
[빠른 통신]
[준비]
```

표시:

- 연결 상태
- deck ready
- ping/latency는 필요 시 작은 아이콘
- 준비 여부

파트너가 아직 준비하지 않았으면 왜 시작되지 않는지 바로 표시.

스토리 때문에 `상대가 컷신을 보고 있습니다` 상태로 장시간 묶지 않는다.

---

# 22. PvP 허브

큰 세 진입:

- 일반전
- 랭킹전
- 친선전

랭킹전 카드:

- 현재 tier
- MMR
- 시즌 종료
- 현재 rank
- 다음 tier 조건
- 시즌/최초 보상

랭킹전 버튼 주변에 성장 표준화 정보를 간단히 표시.

`Lv50 / +0 표준 전투` 같은 자연어 tooltip 후보.

---

# 23. 전투 HUD — 공통

전투 시 가장 중요한 화면 공간은 유닛과 전선이다.

HUD가 화면 세로의 35% 이상을 상시 가리는 것을 피한다.

COMPACT 목표:

- 상단 HUD 42~48px
- 하단 unit bar 62~72px
- 실제 전장 가시 영역 최소 230px 이상 @ 360px height 후보

상단:

```text
[아군 기지 HP] [보급 / 보급cap] [적 기지 HP]
             [속도/일시정지]
```

보급소 upgrade는 좌하단/하단 별도 버튼.

거점 병기는 우하단 후보.

---

# 24. 전투 생산 슬롯

솔로:

- 10 slots 한 row

slot 정보:

- icon/portrait
- cost
- cooldown mask
- ready state

쿨다운:

- radial 또는 vertical fill
- 남은 시간 텍스트는 긴 쿨에서만 후보

보급 부족:

- 단순 회색 처리만 하지 않음
- cost 숫자 대비 유지
- 눌렀을 때 짧은 `보급 부족` feedback

준비됨:

- 1회 작은 highlight
- 지속 깜빡임 금지

---

# 25. 전투 카메라 입력

PC:

- battlefield drag 또는 middle/right candidate → pan
- wheel은 UI scroll과 충돌하지 않게 battle 영역에서만 camera 기능 후보

모바일:

- 전장 빈 영역 1-finger drag → camera pan
- unit bar에서 drag 시작하면 camera pan 금지
- 두 손가락 pinch zoom은 1차 필수가 아니며 가독성 문제 있으면 후속

카메라가 이동해도 아군/적 기지 방향을 잃지 않게 minimap 또는 edge arrow 후보.

---

# 26. 보스 등장 UI

스토리 컷신과 분리한다.

전투 시스템 연출:

- 1~3초 내
- 보스 name
- HP bar 등장
- 짧은 화면 framing
- 공격 telegraph 유지

스킵 가능한 narrative를 자동 스킵해도 이 gameplay intro는 유지한다.

그러나 gameplay intro 때문에 실제 simulation이 불공정하게 진행되면 안 된다. 멀티에서는 서버 규칙과 동기화.

---

# 27. 스토리 대화 UI

스토리는 선택형.

- Skip 버튼 첫 frame부터 표시
- 우상단 safe-area 안쪽
- hit area 최소 44×44
- `건너뛰기` 텍스트 사용
- 길게 누르기 금지
- 확인창 금지

대사 box:

- 화면 하단 22~30% 이내
- 중요 전투 UI와 동시에 표시하지 않음
- speaker name / text / next

설정 `스토리 연출 자동 건너뛰기`가 ON이면 장면을 렌더하지 않는다.

---

# 28. 결과 화면

우선순위:

1. 승/패
2. FIRST_CLEAR
3. 영구 보상
4. 기능/캐릭터/레벨 cap 해금
5. 일반 재화
6. 재도전/다음 스테이지

제1장 ST20:

- Lv20 해금
- SPECIAL 해금

을 일반 Gold 숫자 사이에 묻히게 하지 않는다.

하단 actions:

- 다음 스테이지
- 재도전
- 편성
- 나가기

COMPACT에서 primary=`다음 스테이지` 또는 재도전 상황에 맞춤.

---

# 29. 소탕 UI

조건 미충족:

- 버튼 완전 숨김보다 상황에 따라 disabled + 이유 표시 가능

예:

- `먼저 한 번 클리어해야 합니다`
- `이 스테이지는 소탕할 수 없습니다`
- `소탕권이 부족합니다`

충전 SPECIAL:

소탕 confirmation에서:

- 소탕권 1
- 보상 충전 1
- 획득 예상 보상

을 동시에 보여준다.

연속 소탕은 1차 후보지만 경제 검증 전 과도한 ×100 입력은 넣지 않는다.

---

# 30. Modal / Bottom Sheet

COMPACT:

- 상세 필터
- 협동 선택
- 재화 상세
- 캐릭터 간단 정보

은 bottom sheet 선호.

높이:

- 기본 50~75vh
- 내용 길면 내부 scroll

WIDE:

- center modal / side panel 가능

modal 위 modal을 2중 이상 쌓는 것을 피한다.

ESC/뒤로가기 규칙은 가장 위 layer 하나만 닫는다.

---

# 31. Toast / Error

짧은 상태:

- 보급 부족
- 이미 편성됨
- 저장 완료
- 친구 요청 전송

은 toast.

행동이 필요한 오류:

- 네트워크 재접속
- 저장 충돌
- PvP 매칭 실패

는 toast로 2초 보여주고 사라지게 하지 않고 action panel/modal을 사용.

---

# 32. 로딩

2초 이하 예상:

- skeleton/inline spinner

길어지는 경우:

- 현재 단계 텍스트
- 취소 가능한 작업이면 취소

`Loading...`만 20초 띄우지 않는다.

전투 시작은 필요한 assets/state 준비 후 simulation 시작.

---

# 33. 네트워크 상태

협동/PvP:

- 작은 latency/connection indicator 후보
- 정상 상태에서는 과도하게 눈에 띄지 않음
- reconnect 시 중앙 또는 상단 명확 표시

`재접속 중 8초`처럼 상태를 숨기지 않는다.

입력은 서버가 받을 수 없는 상태면 시각적으로 pending/blocked 처리.

---

# 34. 색만으로 상태 구분 금지

예:

- cooldown: fill + icon/숫자
- rarity: 색 + 문자 C/B/A/S/SS
- online: 점 색 + 상태 text/icon
- 위험 공격: 색 + shape/animation

색각 차이 때문에 핵심 정보가 사라지지 않게 한다.

---

# 35. 애니메이션 시간

일반 UI:

- press response: 50~90ms
- panel transition: 150~240ms
- card reorder: 120~180ms
- reward count-up: 250~600ms, skip 가능

메뉴가 멋있어 보이기 위해 모든 화면 전환을 1초씩 기다리게 하지 않는다.

Reduce Motion 옵션에서는 큰 slide/zoom을 fade/짧은 이동으로 축소한다.

---

# 36. 입력 우선순위

모바일 전투:

1. modal/overlay
2. unit/base weapon/worker UI
3. quick communication
4. battlefield camera gesture

편성:

1. modal/filter
2. deck slot drag
3. character card drag
4. grid scroll

한 touch가 두 행동을 동시에 발동하지 않게 pointer capture 규칙을 고정한다.

---

# 37. 뒤로가기

브라우저/Android back 후보 동작:

1. 열린 modal 닫기
2. detail panel 닫기
3. 현재 메뉴 이전 화면
4. 전투 중이면 즉시 종료하지 않고 일시정지/나가기 확인

PvP에서는 브라우저 back으로 즉시 surrender되지 않게 한다.

---

# 38. UI QA 체크 viewport

각 주요 화면을 최소 다음에서 캡처 검사:

- 640×360
- 844×390
- 915×412
- 1024×576
- 1280×720
- 1920×1080

추가:

- browser zoom 80%
- 100%
- 125%
- 150%

검사:

- overflow
- text clipping
- touch overlap
- safe area
- scroll dead zone
- modal outside viewport
- dropdown offscreen
- drag/drop failure
- combat visibility

---

# 39. UI 실패 조건

다음 하나라도 있으면 해당 화면을 완료로 보지 않는다.

- 텍스트가 container 밖으로 잘림
- 핵심 버튼이 44px 미만
- hover 없이는 정보 확인 불가
- 모바일에서 10칸 중 일부가 누를 수 없음
- drag 실패 이유가 보이지 않음
- SPECIAL 잠금 이유 불명
- 스토리 Skip이 첫 화면에서 안 보임
- 스토리 자동스킵 후 시스템 해금 안내까지 사라짐
- 보급 부족과 cooldown을 구분 못함
- 미발견 적이 상세정보를 노출
- 도감과 편성의 미획득 정책 불일치
- 랭킹전 표준화 여부가 불명
- 재접속 중 사용자에게 아무 상태 표시 없음
- UI가 전투 캐릭터를 과도하게 가림

---

# 40. TESTED 전환 조건

화면별로:

1. spec 기준 구현
2. keyboard/mouse/touch 입력 검사
3. 6개 핵심 viewport 검사
4. 80/100/125/150% zoom 검사
5. 실제 플레이 흐름 검사
6. 문제/수정값 위키 기록

을 완료한 뒤 `TESTED`로 올린다.
