# 1차 메인 보스 8종 — 전투 상세 목표

상태: `DESIGN_TARGET`  
개념: `INITIAL_BOSSES_V1.md`  
30F = 1초. 모든 값은 기준 배율 ×1.0.

보스 스탯은 해당 장 최종전에서 정상 진행 계정이 실제 패턴을 경험할 만큼 버티되, HP만 높은 샌드백이 되지 않도록 설계한다.

---

# B1-01 황금가면 사령술사

bossId: `boss_ch1_goldenmask`  
속성: NEUTRAL  
태그: BOSS  
역할: 장거리 AREA / 사각 학습

- HP 2600
- 공격 180
- 주기 120F
- startup 65F
- standing 365
- attack 260~455
- moveSpeed 0.8
- KB 4
- 처치보급 120

공격:

- AREA 단타.
- 황금가면이 뒤로 젖혀졌다 앞으로 기울어지는 65F 예고.
- 259 이내 사각.

페이즈:

- 메인 ST19/20에서 보스 본체 스탯은 크게 변하지 않고 지원군이 변화.
- 자체 랜덤 소환 능력 없음.

약점:

- 사각 침투
- 낮은 이동속도
- KB4라 고단발 공격에 주문이 끊길 수 있음

금지:

- ARCANE 속성으로 지정해 1장의 속성 도입 순서를 깨지 않음.
- 무작위 저주/상태이상 추가 금지.

---

# B1-02 철문장군

bossId: `boss_ch1_irongate`  
속성: NEUTRAL  
태그: BOSS, ARMORED  
역할: 초고HP 전열 / 느린 범위 한방

- HP 5200
- 공격 260
- 주기 100F
- startup 52F
- standing 130
- attack 0~190
- moveSpeed 0.55
- KB 2
- 처치보급 180

공격:

- AREA.
- 성문 방패를 들어 올렸다 내려찍음.
- 큰 타격이지만 공격 공백이 길어 후열 지속딜이 유효.

약점:

- 장거리
- 낮은 이동
- 상태효과 허용 시 Slow보다 Push/KB가 더 유효할 수 있음

ST20 의도:

- 황금가면과 동시에 풀체력으로 겹치는 것이 아니라 순차 등장.
- 철문장군 등장 시 플레이어가 이미 완전히 빈사 상태가 되지 않게 보조웨이브 조정.

---

# B2-01 뿌리과부

bossId: `boss_ch2_rootwidow`  
속성: NATURE  
태그: BOSS, GIANT  
역할: 두 거리 공격 / 전선 위치 학습

- HP 7200
- 기본 공격 총합 260
- 기본 주기 100F
- standing 230
- moveSpeed 0.75
- KB 3
- 처치보급 220

패턴 루프:

### A 뿌리 휩쓸기

- 2회 연속 사용 후 B 1회.
- startup 36F
- damage 220
- range 0~285
- AREA

### B 먼뿌리 찌르기

- startup 72F
- damage 330
- range 260~430
- AREA
- 259 이내 사각

패턴은 `A → A → B → 반복` 고정.

상태:

- B에 Slow 25% / 45F 후보. 플레이테스트 후 제거 가능.

약점:

- 공격 거리 전환을 읽고 전열 위치 변화 가능
- 움직임 느림

---

# B2-02 종 없는 장의왕

bossId: `boss_ch2_funeral_king`  
속성: UNDEAD  
태그: BOSS, ARMORED  
역할: 느린 광역 + 근접 방어

- HP 9000
- standing 315
- moveSpeed 0.55
- KB 3
- 처치보급 260

패턴:

### A 장례파

- startup 74F
- damage 300
- range 180~410
- AREA
- 주기 125F

### B 관짝 충격

- 타겟이 170 이내로 진입했을 때 다음 공격을 B로 교체
- startup 28F
- damage 180
- range 0~190
- AREA
- 동일 타겟이 계속 붙어도 B만 초고속 반복하지 않도록 최소 cycle 75F

부활 테마:

- 보스 자신 부활 없음.
- HP 70%, 40% 등 스테이지 웨이브 트리거로 되살아난 갑옷 등장.
- 보스 데이터와 스테이지 스폰 책임을 분리.

약점:

- 긴 기본 선딜
- 느린 이동
- 안쪽 접근 시 약한 근접 공격으로 전환돼 장례파를 막을 수 있음

---

# B3-01 제7첨탑의 대마도장

bossId: `boss_ch3_archmagus`  
속성: ARCANE  
태그: BOSS  
역할: 초장거리 사각 보스

- HP 10500
- standing 560
- moveSpeed 0.5
- KB 4
- 처치보급 280

패턴 루프:

### A 첨탑 포격

- startup 96F
- 2hit: 35% / 65%
- total damage 420
- hit frames 96F / 108F
- range 390~690
- AREA
- cycle 155F

### B 내측 파열

- HP 50% 이하부터 A 두 번마다 B 한 번
- startup 58F
- damage 260
- range 220~410
- AREA
- cycle 110F

목적:

- 사각에 들어가면 완전히 무력한 보스가 되지 않지만, 장거리 주포 효율은 크게 떨어짐.
- 첨탑 7개가 순서대로 점등되어 A 선딜을 읽게 함.

약점:

- 빠른 러셔
- 큰 KB로 포격 취소
- 낮은 이동

---

# B3-02 계약대공 벨자르

bossId: `boss_ch3_belzar`  
속성: DEMON  
태그: BOSS, ARMORED  
역할: 중근거리 다단 + 마지막 Push

- HP 12500
- totalAttack 420
- cycle 92F
- startup 28F
- standing 205
- attack 100~285
- moveSpeed 1.2
- KB 4
- 처치보급 300

공격:

- 3hit: 25% / 25% / 50%
- hit frames 28 / 36 / 48F
- AREA
- 마지막 hit만 Push 35% 확률, 45 distance/12F

HP 40% 이하:

- cycle 92F → 82F 후보.
- 피해 자체는 증가시키지 않음.

약점:

- 초장거리
- KB로 3hit 마지막 타 취소 가능
- 공격 범위 밖 후열에 직접 압력 낮음

상태잠금 방지:

- 마지막 Push가 연속으로 발동해 전열을 기지까지 영구 밀지 않도록 동일 소스 Push 내부 쿨다운 후보 60F.

---

# B4-01 기어황제의 이동왕좌

bossId: `boss_ch4_moving_throne`  
속성: MACHINE  
태그: BOSS, STRUCTURE, GIANT, ARMORED  
역할: 이동 성채 / 두 거리 압박

- HP 16500
- standing 290
- moveSpeed 0.40
- KB 1
- 처치보급 360

패턴:

### A 왕좌 포문

- startup 70F
- damage 430
- range 170~390
- AREA
- cycle 120F

### B 하부 압착

- 타겟 150 이내일 때 A 대신 사용 가능
- startup 30F
- damage 300
- range 0~175
- AREA
- cycle 85F

### C 황제 신호

- 별도 공격 아님.
- 스테이지에서 HP 구간 지원군 스폰의 VFX 신호로 사용.
- 서버 sim은 스테이지 trigger를 기준으로 하며 애니메이션은 이를 반영.

약점:

- 매우 느림
- KB1이라 밀리지 않지만 장거리 지속딜에 노출
- 공격주기가 길어 전선 복구 가능

시각 상한:

- 일반 유닛 대비 높이 약 1.8배 이내.
- 클릭/HUD/후열 적을 가리지 않도록 투명/레이어링 규칙 검증.

---

# B4-02 공허엔진 제로

bossId: `boss_ch4_zero_engine`  
속성: MACHINE + ANOMALY  
태그: BOSS, GIANT  
역할: 1차 메인 최종보스 / 세 가지 읽을 수 있는 고정 패턴

- HP 23000
- standing 330
- moveSpeed 0.65
- KB 5
- 처치보급 500

무작위 패턴 없음. HP 페이즈마다 고정 루프가 바뀐다.

## Pattern A — 압축파

- startup 38F
- damage 300
- range 0~365
- AREA
- cycle slot 1
- 시각: 외부 링이 안쪽으로 압축 → 전방 충격파

## Pattern B — 균열선

- startup 92F
- damage 520
- range 300~610
- AREA
- 299 이내 사각
- cycle slot 2
- 시각: 링 3개가 같은 각도로 정렬되며 검은 선이 생김

## Pattern C — 분해진동

- startup 48F
- total damage 450
- 3hit: 20% / 25% / 55%
- hit frames 48 / 56 / 68F
- range 130~430
- AREA
- cycle slot 3

## HP 100~61%

루프:

`A → A → B → A → C`

공격 사이 공통 recovery 24~36F를 각 패턴 cycle에 포함.

## HP 60~31%

루프:

`A → B → C → A → B`

- B maxRange 610 → 650 후보.
- 공격력 증가 없음.
- 링 회전속도/VFX로 페이즈 전환 표시.

## HP 30~0%

루프:

`C → A → B → C`

- 각 패턴 후 공통 recovery 약 10% 단축 후보.
- 즉사, 무적, 전맵 공격 없음.

상태효과 저항:

보스 전용 완전 면역을 기본으로 하지 않는다. 다만 Freeze/Slow 중첩으로 아무 행동도 못하는 경우 공통 보스 상태효과 지속시간 보정 시스템을 검토한다. 캐릭터별 예외 면역은 최후 수단.

약점:

- Pattern B 사각 침투
- KB5라 고단발 타이밍에 일부 패턴 취소 가능
- 패턴이 고정되어 학습 가능

강점:

- 단일 사거리 덱으로 모든 패턴 대응 불가
- A/C가 전열, B가 후열을 번갈아 압박

ST20 목표:

- Lv40 정상 계정으로 클리어 가능.
- 첫 시도에는 패턴 학습 때문에 어려워도 3~5회 내 이해 가능.
- 특정 MACHINE/ANOMALY 대항 S/SS 없이도 클리어 가능.

---

# 보스 magnification 정책

보스는 일반 적보다 배율 범위를 좁힌다.

- 메인 예고/약화 버전: ×0.65~0.90
- 정식 최종전: ×1.0 기준
- 상시 SPECIAL 재등장: 최대 ×1.5 정도부터 검토

×3, ×5 같은 배율로 같은 보스를 최상위 콘텐츠처럼 재사용하기보다 패턴/호위/새 보스를 설계한다.

배율은 HP/공격만 변경. 사거리/패턴/상태확률은 별도 variant가 아니면 유지.

---

# 협동 보스 검증

각 보스에서 다음을 기록한다.

- 두 플레이어의 개인 경제로 time-to-kill이 솔로 대비 얼마나 감소하는가
- 5+5 덱 분할 때문에 대응 캐릭터가 부족해지는가
- 상태효과 두 캐릭터가 겹쳐 보스가 영구 정지하는가
- 장거리 2중 편성으로 사각 기믹이 무의미해지는가

보스마다 숨은 협동 전용 패턴을 추가하는 대신 HP/공격/기지 보정만 최소 사용한다.

---

# 2배속 QA

보스 공격은 재클리어 2×에서도 최소 다음이 읽혀야 한다.

- 공격 시작
- 위험 범위 방향
- 실제 contact
- 페이즈 변화

2×에서 전혀 읽히지 않는 5~10F 예고 패턴은 1×에서도 과도하게 빠를 가능성이 높다.

---

# LOCKED 전 검증

- 8개 보스 흑백 실루엣 구별
- 각 보스 패턴 2~3회 경험 시 학습 가능
- 스토리 중심 덱 baseline 클리어
- S/SS 없는 계정 클리어
- 협동 클리어
- 상태효과 잠금 검사
- 보스 등장 전 기지 파괴 검사
- one-shot HP trigger 검사
- animation contact ↔ sim hit frame 일치
- 2배속 가독성
