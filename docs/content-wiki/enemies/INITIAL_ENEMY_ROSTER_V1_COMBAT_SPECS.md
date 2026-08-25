# 1차 메인 일반 적 32종 — 전투 기준 사양

상태: `DESIGN_TARGET`  
개념 정본: `INITIAL_ENEMY_ROSTER_V1.md`

모든 값은 **기준 배율 ×1.0**일 때의 전투 목표값이다. 개별 스테이지는 `magnification`으로 HP/공격을 조절할 수 있으나 사거리/이속/공격 구조까지 배율로 바꾸지 않는다. 30F=1초.

처치 보급은 기준값이며 스테이지 killSupplyMultiplier가 별도로 적용될 수 있다.

---

# 제1장 — NEUTRAL / BEAST

| ID | 이름 | 속성/태그 | HP | 공격 | 주기 | standing / 공격범위 | 이속 | KB | 처치보급 |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `enemy_ch1_raider` | 약탈병 | NEUTRAL | 70 | 18 | 45F | 80 / 0~100 | 2.0 | 2 | 8 |
| `enemy_ch1_runhound` | 달림개 | BEAST | 45 | 14 | 32F | 65 / 0~85 | 5.0 | 3 | 7 |
| `enemy_ch1_potshield` | 냄비방패 | NEUTRAL, ARMORED | 260 | 12 | 75F | 70 / 0~90 | 0.9 | 1 | 18 |
| `enemy_ch1_longlance` | 긴목창잡이 | NEUTRAL | 120 | 32 | 58F | 190 / 160~220 | 1.6 | 2 | 16 |
| `enemy_ch1_glassrod` | 유리봉 사수 | NEUTRAL | 85 | 90 | 110F | 410 / 300~500 | 1.0 | 3 | 24 |
| `enemy_ch1_macebrute` | 철퇴 난동꾼 | NEUTRAL | 420 | 145 | 105F | 135 / 0~190 | 1.0 | 2 | 34 |
| `enemy_ch1_barrelboar` | 굴렁통 멧돼지 | BEAST, ARMORED | 520 | 80 | 72F | 105 / 0~140 | 3.0 | 2 | 38 |
| `enemy_ch1_blackbanner` | 검은 깃발지기 | NEUTRAL | 300 | 65 | 70F | 175 / 120~220 | 1.5 | 3 | 30 |

## 약탈병

- startup 12F.
- SINGLE.
- 기준 비교용 적. 별도 능력 없음.
- 허용 magnification: ×0.6~×4.0. 후반에는 새 적을 우선하고 무한 배율 남발 금지.

## 달림개

- startup 7F.
- SINGLE.
- 빠른 접근이 정체성이므로 이속을 스테이지별로 올리지 않는다.
- 허용 배율 ×0.6~×3.5.

## 냄비방패

- startup 25F.
- SINGLE.
- 낮은 DPS와 높은 HP로 전선 정체.
- ARMORED 대항 학습용이 아니라 물량/지속딜 학습이 우선.

## 긴목창잡이

- startup 18F.
- SINGLE.
- 150 안쪽 사각을 둬 돌파 후 무력화 가능.

## 유리봉 사수

- startup 58F.
- SINGLE.
- 큰 사각 0~299.
- 투사체 도착 연출은 hitFrame과 일치.
- 동시 3기 이상은 1차 메인에서 매우 제한.

## 철퇴 난동꾼

- startup 56F.
- AREA.
- 큰 선딜을 모션/사운드로 예고.
- 한방이 아군 저비용 벽 다수를 정리하지만 고체력 벽을 즉사시키지는 않는 수준.

## 굴렁통 멧돼지

- startup 20F.
- AREA 소범위.
- 첫 접촉은 빠르지만 공격 빈도는 평범.
- 별도 돌진 데미지 시스템은 1차에서 넣지 않는다.

## 검은 깃발지기

- startup 24F.
- AREA 소범위.
- 1차에서는 실제 버프 오라 없음. 강한 웨이브의 시각 기준점.
- 향후 오라 시스템이 생겨도 이 적에게 자동 적용하지 않고 재설계.

---

# 제2장 — NATURE / UNDEAD

| ID | 이름 | 속성/태그 | HP | 공격 | 주기 | standing / 공격범위 | 이속 | KB | 처치보급 |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `enemy_ch2_mossboar` | 이끼멧돼지 | BEAST+NATURE | 850 | 105 | 82F | 110 / 0~145 | 1.4 | 1 | 48 |
| `enemy_ch2_umbrella` | 우산버섯 | NATURE | 220 | 55 | 78F | 150 / 0~210 | 1.0 | 3 | 24 |
| `enemy_ch2_vinerider` | 덩굴기수 | NATURE | 330 | 70 | 72F | 220 / 170~275 | 1.7 | 3 | 32 |
| `enemy_ch2_seedbattery` | 씨앗포대 | NATURE, STRUCTURE | 180 | 150 | 125F | 440 / 320~530 | 0.6 | 2 | 38 |
| `enemy_ch2_bonewheel` | 뼈바퀴 | UNDEAD | 100 | 32 | 30F | 60 / 0~85 | 6.0 | 4 | 14 |
| `enemy_ch2_coffinbug` | 관짝벌레 | UNDEAD, ARMORED | 1000 | 45 | 95F | 90 / 0~120 | 0.55 | 1 | 52 |
| `enemy_ch2_gravebell` | 묘지종지기 | UNDEAD | 420 | 130 | 100F | 250 / 170~310 | 1.1 | 3 | 42 |
| `enemy_ch2_revivedarmor` | 되살아난 갑옷 | UNDEAD, ARMORED | 650 | 95 | 70F | 120 / 0~165 | 1.3 | 2 | 50 |

## 이끼멧돼지

- startup 25F, AREA 소범위.
- 높은 HP/낮은 KB가 핵심.
- 굴렁통 멧돼지보다 느리고 훨씬 오래 버팀.

## 우산버섯

- startup 30F, AREA.
- Slow: 20% 확률, 45F 후보.
- 멀티 버섯이 겹쳐도 영구 Slow가 되지 않게 stacking 규칙 적용.

## 덩굴기수

- startup 24F, SINGLE 또는 매우 좁은 AREA.
- Push: 20% 확률, 35 distance/10F 후보.
- 첫 구현에서 Slow와 Push를 동시에 주지 않는다.

## 씨앗포대

- startup 70F, AREA 소범위.
- 319 이내 사각.
- 이동은 매우 느리지만 고정 포대는 아님.

## 뼈바퀴

- startup 6F, SINGLE.
- 매우 빠르지만 HP 낮음.
- 부활 없음.

## 관짝벌레

- startup 32F, SINGLE.
- 초고HP/저DPS.
- 되살아난 갑옷과 달리 부활 없음.

## 묘지종지기

- startup 55F, AREA.
- 종 울림이 실제 타격 프레임을 예고.
- 상태효과 없음이 기본.

## 되살아난 갑옷

- startup 22F, AREA 소범위.
- 첫 사망 후 75F 뒤 HP 25%로 1회만 재생.
- 재생 중 untargetable.
- 처치 보급은 최종 사망 때 1회.
- 부활 횟수는 magnification으로 증가하지 않는다.

---

# 제3장 — ARCANE / DEMON

| ID | 이름 | 속성/태그 | HP | 공격 | 주기 | standing / 공격범위 | 이속 | KB | 처치보급 |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `enemy_ch3_glasseye` | 유리눈 마도체 | ARCANE | 360 | 80 | 68F | 250 / 190~300 | 1.5 | 3 | 30 |
| `enemy_ch3_spellbug` | 주문먹는 벌레 | ARCANE, SWARM 후보 | 130 | 28 | 28F | 65 / 0~90 | 5.2 | 4 | 14 |
| `enemy_ch3_floating_library` | 떠다니는 서고 | ARCANE, FLOATING | 360 | 210 | 135F | 500 / 370~610 | 0.9 | 3 | 48 |
| `enemy_ch3_inkdemon` | 잉크마귀 | DEMON | 260 | 105 총합 | 62F | 115 / 0~160 | 2.2 | 4 | 28 |
| `enemy_ch3_chain_demon` | 사슬악마 | DEMON | 480 | 90 | 85F | 220 / 150~285 | 1.4 | 3 | 40 |
| `enemy_ch3_contract_enforcer` | 계약집행관 | DEMON, ARMORED | 1250 | 135 | 92F | 130 / 0~190 | 0.9 | 2 | 58 |
| `enemy_ch3_arcane_battery` | 마도포대 | ARCANE, STRUCTURE | 520 | 280 | 160F | 610 / 430~760 | 0.35 | 1 | 62 |
| `enemy_ch3_torn_mirror` | 찢어진 거울수 | ARCANE+DEMON | 440 | 160 총합 | 95F | 280 / 분리범위 | 1.3 | 4 | 46 |

## 유리눈 마도체

- startup 26F.
- SINGLE.
- ARCANE 기준 중거리.

## 주문먹는 벌레

- startup 5F.
- SINGLE.
- 한 개체는 약하지만 빠르게 후열 사각으로 침투.
- 실제 SWARM 태그를 시스템 용도로 사용할지 구현 전 확정.

## 떠다니는 서고

- startup 76F.
- AREA.
- 369 이하 사각.
- FLOATING은 지면 판정 면역을 자동 의미하지 않는다.

## 잉크마귀

- 3hit: 30%/30%/40%, hit 간 6F.
- AREA 소범위.
- 자연 KB로 중간 hit 취소 가능.

## 사슬악마

- startup 40F.
- AREA 좁은 범위.
- Push 35% 확률, 45 distance/12F 후보.
- 동일 대상 연속 Push 잠금 방지.

## 계약집행관

- startup 36F.
- AREA.
- 높은 HP, 중간 공격.
- 별도 악마 보호막은 1차에서 넣지 않는다.

## 마도포대

- startup 98F.
- AREA 좁은 포격.
- 429 이하 사각.
- 매우 느림.
- 동시 다수 스폰은 제한.

## 찢어진 거울수

- 2hit 50/50.
- hit1: 60~200.
- hit2: 330~470.
- standing 280 주변에 빈 영역 존재.
- AREA.
- 도감에서 분리범위 설명 필수.

---

# 제4장 — MACHINE / ANOMALY

| ID | 이름 | 속성/태그 | HP | 공격 | 주기 | standing / 공격범위 | 이속 | KB | 처치보급 |
| --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| `enemy_ch4_sawbird` | 톱니새 | MACHINE, FLOATING | 160 | 45 | 32F | 80 / 0~105 | 5.5 | 4 | 18 |
| `enemy_ch4_magnet_spider` | 자력거미 | MACHINE | 520 | 85 | 78F | 210 / 150~270 | 1.8 | 3 | 38 |
| `enemy_ch4_railworm` | 레일벌레 | MACHINE | 420 | 320 | 175F | 640 / 450~800 | 0.7 | 2 | 65 |
| `enemy_ch4_furnace_golem` | 용광로 골렘 | MACHINE, ARMORED, GIANT | 1850 | 170 | 105F | 150 / 0~215 | 0.65 | 1 | 75 |
| `enemy_ch4_folded_soldier` | 접힌 병사 | ANOMALY | 460 | 95 | 52F | 120 / 0~165 | 2.6 | 4 | 34 |
| `enemy_ch4_error_mass` | 오류덩어리 | ANOMALY | 700 | 180 총합 | 80F | 190 / 90~250 | 1.4 | 5 | 48 |
| `enemy_ch4_void_lens` | 공허렌즈 | ANOMALY, FLOATING | 500 | 250 | 135F | 500 / 340~610 | 0.9 | 3 | 58 |
| `enemy_ch4_fusion_cavalry` | 융합기병 | MACHINE+ANOMALY | 1050 | 155 | 62F | 205 / 145~255 | 3.1 | 4 | 72 |

## 톱니새

- startup 7F, SINGLE.
- 빠른 저HP.
- FLOATING이므로 지면과 분리된 연출, 실제 Y회피 시스템은 없음.

## 자력거미

- startup 32F, AREA 소범위.
- Push 25% 확률, 35 distance 후보.
- Pull 구현이 필요하면 이 적을 바꾸지 말고 별도 능력 설계 후 선택.

## 레일벌레

- startup 110F.
- AREA 좁은 선형.
- 449 이하 사각.
- 높은 한방/매우 긴 공백.

## 용광로 골렘

- startup 46F.
- AREA.
- 매우 높은 HP/낮은 이동.
- 공격 때 바닥 화염 DOT 같은 추가 시스템은 1차에서 사용하지 않는다.

## 접힌 병사

- startup 14F.
- SINGLE.
- 애니메이션은 접혔다 펴지지만 공격주기는 일정하고 예측 가능.

## 오류덩어리

- 4hit: 20/20/20/40%, hit 간 5F.
- AREA 소범위.
- 시각상 글리치 텔레포트처럼 보여도 실제 위치가 무작위로 이동하지 않는다.

## 공허렌즈

- startup 72F.
- AREA.
- 339 이하 사각.
- 약한 Weaken 후보는 메인 난이도 테스트 후만 추가. 기본은 순수 장거리.

## 융합기병

- startup 18F.
- AREA 소범위.
- 강점: 높은 이동+중거리.
- 약점: 체급 대비 긴 재공격 후딜 또는 KB4로 공격 취소 가능.
- MACHINE+ANOMALY 대항 모두 유효하되 피해배율 중첩 규칙은 시스템 공통 적용.

---

# 배율 정책

일반 적 magnification은 기본적으로 HP와 공격에만 적용한다.

```text
actualHp = round(baseHp × magnification)
actualAttack = round(baseAttack × magnification)
```

다음은 배율로 변하지 않는다.

- 사거리
- 이속
- 공격주기
- 상태효과 확률/시간
- KB 횟수
- 부활 횟수
- Push 거리

이 값까지 바꿔야 하면 `variant` 또는 새 적 사양으로 설계한다.

---

# 장간 재사용 정책

이전 장 적을 후반에 재사용할 수 있다.

- 같은 enemyId
- 같은 도감
- 스테이지 magnification만 조정

단, 후반 난이도를 만들기 위해 1장 약탈병을 ×30으로 키우는 식보다 해당 장 역할 적을 우선한다.

일반 적 권장 상한은 대체로 기준 ×4 내외. 그 이상이 자주 필요하면 기준값/장별 적 구성을 재검토한다.

---

# 플레이어 정보

도감에서 발견 후 다음을 보여준다.

- 기준 HP/공격
- 속성/태그
- 사거리 성향
- 공격주기
- 이속/KB
- 상태효과/부활/Push

실제 스테이지 magnification은 스테이지 상세에서 `이 스테이지에서는 강화됨` 정도로 표시할 수 있으나 내부 배율 숫자를 반드시 공개할 필요는 없다.

---

# LOCKED 전 필수 검증

- 각 장 8종의 실루엣을 흑백 축소로 구분 가능
- 빠른 적/벽/중거리/장거리/범위/정예 역할 중복 없음
- 상태효과 두세 종이 동시에 나와 조작불능을 만들지 않음
- 스토리 중심 덱으로 대응 가능
- 협동에서 두 경제 때문에 낮은 HP 후열이 전부 무의미해지지 않음
- 후반 magnification이 지나치게 높지 않음
- 처치 보급이 물량 웨이브에서 보급 무한을 만들지 않음
