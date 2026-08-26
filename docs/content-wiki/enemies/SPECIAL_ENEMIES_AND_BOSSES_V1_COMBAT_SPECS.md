# SPECIAL 전용 적·보스 전투 사양 v1

상태: `DESIGN_TARGET`  
상위: `docs/STAGE_SYSTEM_DESIGN.md`, `docs/content-wiki/stages/special/`

이 문서는 메인 32종 일반 적/8종 보스와 별개로, SPECIAL에서만 또는 SPECIAL에서 주로 쓰는 전용 적과 보스의 기준값을 정의한다. 모든 수치는 Lv 개념이 없는 적의 `기준 배율 ×1.00` 값이며, 각 스테이지는 magnification만 적용한다. 단순 색변경 재활용을 금지한다.

---

# 1. 공통 규칙

- 시간: 30F = 1초.
- `standingRange`와 실제 공격 범위를 분리한다.
- `attackCycle`은 한 공격 시작부터 다음 공격 시작까지.
- 보스는 `BOSS` 태그를 가진다.
- SPECIAL 전용 적도 속성은 기존 8속성만 사용한다.
- 시리즈마다 새 태그를 즉흥 추가하지 않는다.
- 협동은 별도 패턴을 추가하지 않고 스테이지 보정값만 적용한다.
- 2배속에서도 보스 선딜/예고가 읽혀야 한다.

---

# 2. 황금 수송대

## G-01 황금 짐꾼

- ID: `enemy_sp_gold_porter`
- 속성: NEUTRAL
- 역할: 저공격 운반 물량 / 처치 보급 테마 적
- HP 150
- 공격 24
- standingRange 55
- 공격범위 0~75
- 이동속도 3.2
- KB 2
- attackCycle 48F
- hitFrame 15F
- 처치 보급 18
- 외형: 금화 자루보다 큰 등짐이 몸 전체를 가리는 작은 운반꾼.
- 목적: 1~2단계 기준 적. 빠르지만 전투력 자체는 낮다.

## G-02 장갑 호위대

- ID: `enemy_sp_gold_guard`
- 속성: NEUTRAL
- 태그: ARMORED
- HP 640
- 공격 72 AREA
- standingRange 90
- 공격범위 0~120
- 이동속도 1.4
- KB 3
- attackCycle 78F
- hitFrame 27F
- 처치 보급 32
- 역할: 짐꾼 앞을 막는 전열.

## G-03 금고 골렘

- ID: `enemy_sp_gold_vault_golem`
- 속성: MACHINE
- 태그: ARMORED+GIANT
- HP 2,600
- 공격 185 AREA
- standingRange 125
- 공격범위 0~165
- 이동속도 0.8
- KB 4
- attackCycle 114F
- hitFrame 42F
- 처치 보급 95
- 역할: IV 이상 중간 보스급 벽.
- 공격 예고: 몸의 금고문이 30F 동안 열리고 42F에 전방 충격파.

## G-B01 황금 운송괴수

- ID: `boss_sp_gold_carrier`
- 속성: BEAST
- 태그: BOSS+GIANT+ARMORED
- HP 9,200
- 공격 A: 420 AREA, 범위 0~190, hit 36F, cycle 108F
- 공격 B: 230 AREA, 범위 140~420, hit 66F, cycle 180F
- standingRange 150
- 이동속도 0.6
- KB 5
- 처치 보급 320
- 패턴: A-A-B 고정 루프.
- B 예고: 등에 실린 금고들이 순서대로 흔들린 뒤 금화/상자가 전방으로 쏟아짐.
- 목적: V 단계의 최종 운송체. 장거리만 쌓아도, 근접만 쌓아도 편하지 않은 구조.

---

# 3. 혼의 제련소

## S-01 잔혼

- ID: `enemy_sp_soul_wisp`
- 속성: UNDEAD
- 태그: FLOATING
- HP 95
- 공격 18
- standingRange 80
- 공격범위 0~105
- 이동속도 3.8
- KB 1
- attackCycle 36F
- hitFrame 11F
- 역할: 빠른 저HP 혼불 물량.

## S-02 청염 혼갑

- ID: `enemy_sp_soul_armor`
- 속성: UNDEAD+ARCANE
- 태그: ARMORED
- HP 820
- 공격 96 AREA
- standingRange 105
- 공격범위 0~145
- 이동속도 1.1
- KB 4
- attackCycle 84F
- hitFrame 30F
- 역할: 중간 전열. 멀티히트 유닛이 효율적일 수 있으나 필수는 아님.

## S-03 울부짖는 노심

- ID: `enemy_sp_soul_furnace`
- 속성: ARCANE
- 태그: STRUCTURE
- HP 1,450
- 공격: 3×54 AREA
- hitFrames 40/47/54F
- standingRange 310
- 공격범위 220~390
- 이동속도 0.2
- KB 2
- attackCycle 132F
- 역할: 후열 포격. 큰 사각이 있어 전선 돌파로 무력화 가능.

## S-B01 천혼의 대제련로

- ID: `boss_sp_soul_grand_forge`
- 속성: ARCANE+UNDEAD
- 태그: BOSS+STRUCTURE+GIANT
- HP 8,000
- 이동속도 0.25
- KB 4
- 공격 A: 260 AREA, 0~220, hit 34F, cycle 90F
- 공격 B: 3×145 AREA, 240~520, hit 52/60/68F, cycle 162F
- 패턴: A-B-A-A-B 고정.
- HP 50% 이하에서 B의 선딜은 유지하고 데미지만 +15%.
- 무작위 패턴 없음.

---

# 4. 진화의 문

## E-01 봉인석 수호체

- ID: `enemy_sp_evo_seal_guard`
- 속성: ARCANE
- 태그: ARMORED
- HP 1,050
- 공격 118 AREA
- standingRange 115
- 공격범위 0~150
- 이동속도 1.0
- KB 5
- attackCycle 72F
- hitFrame 24F
- 역할: 문 단계의 기준 전열.

## E-02 열쇠먹는 벌레

- ID: `enemy_sp_evo_keyeater`
- 속성: ANOMALY
- HP 180
- 공격 44
- standingRange 50
- 공격범위 0~75
- 이동속도 5.0
- KB 2
- attackCycle 33F
- hitFrame 9F
- 역할: 느린 고비용 덱만 쓰는 것을 견제하는 러셔.

## E-03 삼중문양 포대

- ID: `enemy_sp_evo_glyph_turret`
- 속성: ARCANE
- 태그: STRUCTURE
- HP 1,900
- 공격 210 AREA
- standingRange 390
- 공격범위 300~470
- 이동속도 0
- KB 1
- attackCycle 144F
- hitFrame 60F
- 역할: 사각을 가진 고정 포대.

## E-B01 심층문 수호자

- ID: `boss_sp_evo_gatekeeper`
- 속성: ARCANE+ANOMALY
- 태그: BOSS+GIANT
- HP 12,500
- KB 6
- 이동속도 0.9
- 공격 A: 350 AREA, 0~180, hit 30F, cycle 96F
- 공격 B: 520 AREA, 210~520, hit 72F, cycle 198F
- 공격 C: Push 80거리 + 180 피해, 0~260, hit 48F, cycle 150F
- 패턴: A-A-C-B 반복.
- 난이도 8 단계용. 화면전체 공격/즉사 없음.

---

# 5. 별빛 균열

## R-01 별조각 포자체

- ID: `enemy_sp_rift_shardling`
- 속성: ANOMALY
- HP 130
- 공격 38
- standingRange 75
- 공격범위 0~100
- 이동속도 4.0
- KB 3
- attackCycle 42F
- hitFrame 13F

## R-02 반전 거울구

- ID: `enemy_sp_rift_mirror_orb`
- 속성: ARCANE+ANOMALY
- 태그: FLOATING
- HP 520
- 공격 2×62
- standingRange 250
- 공격범위 160~330
- 이동속도 1.6
- KB 4
- attackCycle 92F
- hitFrames 32/42F
- 역할: 중거리 다단.

## R-03 별비 관측체

- ID: `enemy_sp_rift_observer`
- 속성: ANOMALY
- 태그: FLOATING
- HP 1,350
- 공격 180 AREA
- standingRange 430
- 공격범위 330~510
- 이동속도 0.5
- KB 3
- attackCycle 150F
- hitFrame 66F
- 큰 사각.

## R-B01 붕괴하는 밤

- ID: `boss_sp_rift_nightfall`
- 속성: ANOMALY
- 태그: BOSS+GIANT+FLOATING
- HP 9,800
- 이동속도 0.7
- KB 5
- 공격 A: 240 AREA, 0~210, hit 28F, cycle 84F
- 공격 B: 410 AREA, 260~620, hit 78F, cycle 192F
- 공격 C: 3×115 AREA, 120~360, hit 42/49/56F, cycle 132F
- 패턴 A-C-A-B 고정.
- 모집 재화 SPECIAL의 최종전이므로 특정 속성 단일 덱보다 범용 편성이 유리하도록 설계.

---

# 6. 상시 SPECIAL 보스

## P-B01 폭식룡

- ID: `boss_sp_glutton_drake`
- 속성: BEAST
- 태그: BOSS+GIANT
- HP 10,400
- 공격 470 AREA
- standingRange 170
- 공격범위 0~230
- 이동속도 1.15
- KB 5
- attackCycle 102F
- hitFrame 35F
- 특수: HP 60%/30%에서 각각 1회 210거리 돌진 후 다음 공격 선딜 18F 단축. 돌진 자체 피해 없음.
- 목적: 단순 느린 샌드백이 아닌 전선 압박형 BEAST 보스.

## P-B02 죽지 않는 밤의 왕

- ID: `boss_sp_undying_night`
- 속성: UNDEAD
- 태그: BOSS
- HP 7,200
- 공격 320 AREA
- standingRange 250
- 공격범위 120~330
- 이동속도 0.8
- KB 4
- attackCycle 126F
- hitFrame 47F
- 특수: HP 0 도달 시 1회만 35% HP로 150F 후 부활. 부활 중 타겟 불가. 두 번째 사망은 완전 사망.
- 부활은 도감/첫 조우 연출로 명확히 예고.

## P-B03 깨지지 않는 유리성

- ID: `boss_sp_glass_castle`
- 속성: ARCANE
- 태그: BOSS+STRUCTURE+ARMORED
- HP 13,000
- 이동속도 0.15
- KB 3
- 공격 A: 240 AREA, 0~190, hit 36F, cycle 96F
- 공격 B: 620 AREA, 360~690, hit 84F, cycle 210F
- 큰 사각을 핵심 약점으로 유지.

## P-B04 다시 걷는 기계성

- ID: `boss_sp_walking_machine_castle`
- 속성: MACHINE
- 태그: BOSS+STRUCTURE+GIANT+ARMORED
- HP 16,500
- 이동속도 0.35
- KB 5
- 공격 A: 380 AREA, 0~260, hit 45F, cycle 120F
- 공격 B: 2×290 AREA, 240~520, hit 66/78F, cycle 174F
- 목적: 난이도 8의 장기 전선 유지 시험.

## P-B05 관측불가 개체

- ID: `boss_sp_unobservable`
- 속성: ANOMALY
- 태그: BOSS+FLOATING
- HP 11,800
- 이동속도 1.0
- KB 7
- 공격 A: 220 AREA, 0~160, hit 24F, cycle 72F
- 공격 B: 480 AREA, 190~480, hit 70F, cycle 180F
- 공격 C: Weaken 25% / 90F, 피해 120 AREA, 80~300, hit 44F, cycle 150F
- 패턴은 고정. 외형이 불규칙해 보여도 판정은 예측 가능해야 한다.

---

# 7. 이벤트 전용 적 기준

이벤트 적은 기존 적에 여름 모자만 씌운 복제본으로 만들지 않는다. 이벤트 전용 적은 3~5종 + 보스 1종 정도를 기본 목표로 하며, 이벤트 종료 후에도 복각을 전제로 ID를 유지한다.

`한여름 괴수 대소동` 예시:

- `enemy_ev_sand_crab`: BEAST, 빠른 낮은 실루엣, HP 170 / ATK 32.
- `enemy_ev_cotton_wave`: NATURE+ANOMALY, 부유 물량, HP 110 / ATK 26.
- `enemy_ev_firework_cart`: MACHINE, 장거리 포격, HP 620 / ATK 105 / range 300~430.
- `boss_ev_summer_kaiju`: BEAST+ANOMALY, HP 8,500, 근거리 꼬리 + 중거리 파도 2패턴.

`제로 엣지 시험운용` 예시:

- `enemy_ev_ze_drone`: MACHINE+FLOATING, 고속 저HP.
- `enemy_ev_ze_shield`: MACHINE+ARMORED, 전열.
- `enemy_ev_ze_railpod`: MACHINE+STRUCTURE, 장거리 사각.
- `boss_ev_ze_testframe`: MACHINE, 고정 3패턴 시험 프레임.

---

# 8. magnification 규칙

SPECIAL 단계 상승은 같은 적의 HP/ATK 배율만 키우지 않고 적 조합을 발전시키는 것을 우선한다.

권장 일반적 범위:

- 난이도 2~3: 기준 ×0.65~0.90
- 난이도 4~5: ×0.90~1.20
- 난이도 6: ×1.15~1.45
- 난이도 7: ×1.35~1.75
- 난이도 8: ×1.60~2.10

이 범위는 RULE이 아니라 DESIGN_TARGET이다. 실제 난이도는 `DIFFICULTY_CALIBRATION.md`로 검증한다.

보스 HP를 3배 이상 단순 확대해야 원하는 난이도가 나온다면 스테이지 조합/패턴/권장 성장부터 재검토한다.

---

# 9. QA

- SPECIAL 전용 적이 메인 적의 팔레트 스왑인지 검사.
- 공격 모션과 hitFrame 일치.
- 2배속에서도 위험 공격 선딜 판독 가능.
- 협동에서 적 개체 수를 몰래 늘리지 않는지.
- 사각이 있는 적은 실제로 파고들 수 있는지.
- 부활은 무한루프가 없는지.
- 보스 패턴이 seed/RNG에 따라 즉흥적으로 바뀌지 않는지.
- 높은 단계가 단순 HP 스펀지가 아닌지.
- 도감에서 속성/태그/범위/능력 설명 가능 여부.
