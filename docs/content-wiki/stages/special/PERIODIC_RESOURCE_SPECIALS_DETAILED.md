# 주기 재화 SPECIAL — 상세 제작 사양

상태: `DESIGN_TARGET`  
상위: `INITIAL_SPECIAL_COLLECTIONS.md`, `REWARD_ECONOMY_AND_SKIP.md`

목표: 냥코식 게릴라/요일 콘텐츠의 “오늘 열리는 옆길” 감각은 가져오되, 짧은 시간창·에너지·접속 강제를 제거한다.

---

# 1. 공통 주기 정책

1차 후보:

- 각 묶음은 한 번 열리면 **72시간** 유지.
- 닫힌 뒤 다음 등장은 **최대 5일 이내**.
- 네 묶음을 서로 엇갈리게 열어 항상 1~2개는 주기 SPECIAL에 보이게 한다.
- 정확한 요일표는 라이브 운영 전 조정 가능.
- 묶음별 보상 충전은 닫혀 있는 동안에도 회복하며 상한에서 멈춘다.
- 충전은 시즌 종료/요일 변경 때 소멸하지 않는다.

보상 충전 1차 후보:

- 최대 4회
- 12시간마다 +1
- 직접 플레이/소탕 모두 1회 소비
- 충전 0에서도 플레이 가능
- 충전 0 반복 보상은 정상의 20%
- 각 단계 첫 클리어는 충전 불소모

이 숫자는 전체 메타경제 검증 전 `DESIGN_TARGET`이다.

공통 협동:

- SOLO_OR_COOP
- HP ×1.18~1.22
- 공격 ×1.08
- 적 기지 ×1.10~1.12
- 스폰 동일

공통 편의:

- 최초 클리어 1×
- 클리어 후 1×/2×
- 클리어 후 소탕 가능

---

# 2. 황금 수송대

collectionId: `special_gold_convoy`  
목적 재화: 골드  
단계: 5

전용 적:

- `special_gold_porter` — 황금 짐꾼: 약한 NEUTRAL, 처치 보급 낮음
- `special_gold_cart` — 금화마차: 느린 고HP STRUCTURE
- `special_gold_guard` — 금빛 호위병: ARMORED 중거리
- `special_gold_train` — 무장 수송열차: MACHINE+STRUCTURE, 긴 몸체 연출
- `special_gold_vault_golem` — 금고 골렘: ARMORED+GIANT
- `boss_gold_carrier` — 황금왕의 운송괴수: BEAST+ARMORED+GIANT+BOSS

## I 외곽의 짐마차

stageId: `special_gold_convoy_01`  
난이도: 2  
권장: 1장 초반 Lv3~5  
mapLength: 1900  
bases: 1000 / 1100  
startingSupply: 80  
목표시간: 50~80초

스폰:

- 90F 짐꾼 ×2
- 300F 금화마차 ×1 (0.7×)
- 510F 짐꾼 ×3
- 750F 금화마차 ×1 + 짐꾼 ×2

보상:

- 첫 클리어: 골드 600 + 소탕권 1
- charged: 골드 450
- depleted: 골드 90

목적: 신규 계정이 낮은 단계라도 의미 있게 골드 확보.

## II 황금 호송대

stageId: `special_gold_convoy_02`  
난이도: 3  
권장: 1장 중후반 Lv6~10  
mapLength: 2150  
bases: 1500 / 1800  
startingSupply: 150  
목표시간: 55~85초

스폰:

- 90F 짐꾼 ×2
- 270F 금빛 호위병 ×1
- 480F 금화마차 ×1
- 690F 호위병 ×2
- 930F 금화마차 ×1 + 짐꾼 ×3

보상:

- 첫: 골드 1200
- charged: 850
- depleted: 170

## III 무장 수송열차

stageId: `special_gold_convoy_03`  
난이도: 5  
권장: 2장 중반 Lv15~18  
mapLength: 2500  
bases: 2600 / 3800  
startingSupply: 240  
목표시간: 65~95초

스폰:

- 120F 호위병 ×1
- 390F 금화마차 ×1
- 660F 무장 수송열차 ×1 (0.75×)
- +210F 짐꾼 ×3
- 열차 HP 50%: 호위병 ×2

보상:

- 첫: 골드 2600
- charged: 1900
- depleted: 380

## IV 왕실 금고 행렬

stageId: `special_gold_convoy_04`  
난이도: 6  
권장: 3장 중반 Lv25~28  
mapLength: 2650  
bases: 4300 / 6500  
startingSupply: 350  
목표시간: 70~105초

스폰:

- 120F 호위병 ×2
- 390F 금고 골렘 ×1 (0.8×)
- 690F 금화마차 ×1
- 930F 무장 수송열차 ×1
- 1230F 금고 골렘 ×1 + 호위병 ×2

보상:

- 첫: 골드 5000
- charged: 3600
- depleted: 720

## V 황금왕의 대수송

stageId: `special_gold_convoy_05`  
난이도: 7  
권장: 4장 후반 Lv38~40  
mapLength: 2850  
bases: 6500 / 9500  
startingSupply: 470  
목표시간: 80~120초

스폰:

- 120F 호위병 ×2
- 420F 금고 골렘 ×1
- 780F 황금왕의 운송괴수 ×1
- 보스 +210F 무장 수송열차 ×1 (0.65×)
- HP 60% 호위병 ×2
- HP 30% 금고 골렘 ×1 (0.7×)

보상:

- 첫: 골드 9000 + 프로필 훈장 후보
- charged: 골드 6500
- depleted: 1300

고단계 효율이 I보다 시간당 약 8~10배까지 좋아질 수 있으나, 실제 레벨업 총비용과 함께 재검증한다.

---

# 3. 혼의 제련소

collectionId: `special_soul_forge`  
보상: 공용 +성장 재화 `soul_shard` 가칭  
단계: 4

전용 적:

- `soul_ember` — 작은 ARCANE 부유 혼불
- `soul_shell` — UNDEAD+ARMORED 단단한 그릇
- `soul_hammer` — ARCANE 중거리 망치형 정령
- `soul_chorus` — UNDEAD 군집 멀티히트
- `boss_soul_furnace` — 거대한 이동 노/제련로, ARCANE+STRUCTURE+BOSS

## I 잔불의 제련

난이도 3 / `special_soul_forge_01`  
권장 Lv8~12  
map 2050 / bases 1500:1900 / supply 150 / 55~85초

스폰:
- 120F 혼불 ×2
- 330F 혼그릇 ×1 (0.65×)
- 570F 혼불 ×3
- 810F 혼망치 ×1 (0.65×)

보상:
- 첫 30 soul_shard
- charged 18
- depleted 4

## II 푸른 혼불

난이도 4 / `special_soul_forge_02`  
권장 Lv14~18  
map 2250 / bases 2300:3100 / supply 220 / 60~90초

스폰:
- 90F 혼불 ×3
- 330F 혼그릇 ×1
- 600F 혼망치 ×1
- 870F 혼불 ×4 + 혼그릇 ×1

보상: 첫 65 / charged 40 / depleted 8.

## III 울부짖는 노

난이도 6 / `special_soul_forge_03`  
권장 Lv26~30  
map 2500 / bases 4200:6000 / supply 350 / 70~105초

스폰:
- 120F 혼그릇 ×1
- 390F 혼합창 ×1
- 660F 혼망치 ×2
- 960F 혼그릇 ×1 + 혼합창 ×1
- 1260F 혼불 ×4

보상: 첫 140 / charged 90 / depleted 18.

## IV 천혼의 대제련

난이도 7 / `special_soul_forge_04`  
권장 Lv38~40  
map 2750 / bases 6500:9200 / supply 470 / 85~125초

스폰:
- 120F 혼그릇 ×1
- 420F 혼망치 ×1
- 750F 대제련로 ×1
- HP70% 혼합창 ×1
- HP45% 혼그릇 ×1 + 혼불 ×3
- HP20% 혼망치 ×2

보상: 첫 300 / charged 190 / depleted 38.

경제 주의: 이 재화만 반복해서 모집 중복의 의미를 없애지 않도록 +레벨 비용과 함께 확정.

---

# 4. 진화의 문

collectionId: `special_evolution_gate`  
보상: 진화재료  
단계: 5

공용 재료 후보:

- `evo_fragment` — 일반 파편
- `evo_core` — 상급 핵
- `evo_crown` — 희귀 심층 재료

속성별 재료를 추가하더라도 8속성 각각 별도 재화로 과도하게 쪼개지 않는 것을 우선한다.

전용 적은 문의 봉인수호체로 통일된 세계관을 가지되 골격을 달리한다.

## I 금 간 문

`special_evolution_gate_01` / 난이도3 / Lv8~12  
map2000 / bases1600:2100 / supply150 / 55~85초

- 120F 봉인조각 ×2
- 390F 작은 문지기 ×1
- 690F 봉인조각 ×3

첫: fragment 12  
charged: fragment 7  
depleted: 1~2

## II 두 번째 자물쇠

`..._02` / 난이도4 / Lv14~18  
map2200 / 2500:3300 / supply220 / 60~90초

- 120F 문지기 ×1
- 390F 사슬봉인체 ×1
- 690F 봉인조각 ×3
- 960F 문지기 ×2

첫: fragment 24 + core 1  
charged: fragment 14  
depleted: 3

## III 세 겹 문양

`..._03` / 난이도5 / Lv20~25  
map2400 / 3400:4700 / supply300 / 65~100초

- 120F 사슬봉인체 ×1
- 420F 거울봉인체 ×1
- 720F 문지기 ×1 + 봉인조각 ×2
- 1020F 거울봉인체 ×1

첫: fragment 40 + core 3  
charged: fragment 22 + core 1  
depleted: fragment 5

## IV 봉인 수호자

`..._04` / 난이도6 / Lv28~32  
map2600 / 4700:6800 / supply380 / 75~110초

- 120F 문지기 ×1
- 420F 사슬봉인체 ×1
- 750F 봉인수호자 중보스 ×1
- HP50% 거울봉인체 ×1

첫: fragment 70 + core 6  
charged: fragment 38 + core 2  
depleted: fragment 8

## V 열린 심층문

`..._05` / 난이도8 / Lv40/F3 일부  
map2900 / 7200:11000 / supply500 / 95~140초

- 120F 사슬봉인체 ×1
- 420F 거울봉인체 ×1
- 810F 심층문의 수호자 ×1 BOSS
- HP70% 문지기 ×2
- HP40% 거울봉인체 ×1
- HP20% 사슬봉인체 ×2

첫: fragment 120 + core 12 + crown 2  
charged: fragment 65 + core 5 + crown 0~1 확정 구조는 경제 검토 후 결정  
depleted: fragment 13 + core 1

중요: 희귀재료가 확률 드랍이면 반복 RNG 스트레스를 만들 수 있으므로 `crown`은 확정 누적 조각식 또는 확정 개수 우선.

---

# 5. 별빛 균열

collectionId: `special_starlight_rift`  
보상: 모집 재화  
단계: 4

전투 방향: 하나의 속성 카운터 덱으로 날먹하지 못하게 여러 속성을 섞되 정답덱 강제는 피한다.

## I 작은 별조각

`special_starlight_rift_01` / 난이도3 / Lv8~12  
map2100 / bases1600:2100 / supply160 / 55~85초

- 120F 달림개 ×1
- 330F 우산버섯 ×1 (0.6×)
- 570F 유리눈 마도체 ×1 (0.55×)
- 810F 약탈병 ×3

첫: 모집재화 80  
charged: 45  
depleted: 9

## II 흔들리는 균열

`..._02` / 난이도4 / Lv15~20  
map2300 / 2600:3500 / supply230 / 60~95초

- 90F 뼈바퀴 ×2
- 330F 이끼멧돼지 ×1 (0.75×)
- 630F 유리눈 ×1
- 900F 주문먹는 벌레 ×2 + 우산버섯 ×1

첫: 150  
charged: 85  
depleted: 17

## III 별비의 전선

`..._03` / 난이도6 / Lv27~30  
map2600 / 4500:6200 / supply360 / 75~110초

- 120F 계약집행관 ×1 (0.75×)
- 390F 씨앗포대 ×1 (0.75×)
- 690F 톱니새 ×2 (0.65×)
- 990F 찢어진 거울수 ×1
- 1260F 되살아난 갑옷 ×1

첫: 300  
charged: 180  
depleted: 36

## IV 붕괴하는 밤

`..._04` / 난이도7 / Lv38~40  
map2850 / 6800:9800 / supply480 / 85~125초

- 120F 융합기병 ×1 (0.75×)
- 420F 공허렌즈 ×1 (0.75×)
- 720F 계약집행관 ×1
- 1020F 이끼멧돼지 ×1 + 뼈바퀴 ×2
- 1320F 찢어진 거울수 ×1 + 톱니새 ×2
- 1620F 융합기병 ×1

첫: 600  
charged: 350  
depleted: 70

모집 1회 가격은 이 보상량을 보고 최종 확정한다. 현재 숫자가 모집 속도를 과도하게 빠르게 만들면 보상을 줄이는 대신 플레이 피로/재미도 함께 본다.

---

# 6. 단계 해금

주기 SPECIAL의 높은 단계가 계정 초반에 전부 보이더라도 잠금 이유를 명확히 표시한다.

기본 후보:

- I: 1장 ST03 이후
- II: 1장 ST10 이후
- III: 2장 완료 또는 3장 진입
- IV: 3장 완료
- V: 4장 후반 또는 완료

묶음마다 약간 달라질 수 있다.

---

# 7. 반복 경제 검증

각 묶음에 대해 다음 계정 유형으로 7일 시뮬레이션한다.

- 하루 20분
- 하루 45분
- 하루 90분
- 충전을 2~3일 몰아서 사용하는 사용자
- 소탕 위주 사용자
- 직접 2배속 반복 사용자

검증:

- 충전을 놓치지 않으려고 하루 여러 번 로그인할 필요 없는가
- 최고 단계만 돌면 경제가 폭발하는가
- 낮은 단계도 초보에게 실질적 성장을 주는가
- 소탕권이 부족해 파밍이 막히지 않는가
- 직접 플레이가 소탕보다 불합리하게 손해가 아닌가

`LOCKED` 전 실제 레벨업/진화/모집 비용표와 함께 재조정한다.
