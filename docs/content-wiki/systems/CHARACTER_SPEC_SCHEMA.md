# 캐릭터/적 전투 상세 사양 표준

상태: `LOCKED`  
목적: 아군·적·보스를 구현하기 전에 필요한 정보를 빠짐없이 기록한다.

---

## 1. 공통 메타 블록

```yaml
id:
displayName:
status: CONCEPT | DESIGN_TARGET | TESTED | LOCKED | REWORK
acquisitionClass: STORY | RECRUITMENT | SPECIAL | EVENT | NONE
rarity: null | C | B | A | S | SS
seriesId: null | string
attributes: []
combatTags: []
roles: []
firstAvailableAt:
contentDataPath:
artPath:
```

스토리 캐릭터의 `rarity`는 `null`이다. 적의 acquisitionClass는 NONE.

---

## 2. 형태 블록

아군은 F1/F2/F3 각각 작성한다.

```yaml
formId:
formOrder: 1 | 2 | 3
formName:
unlock:
  baseLevel:
  materials: []
  specialCondition: null
statsAtLv1:
  hp:
  attackTotal:
  moveSpeed:
  standingRange:
  attackMinRange:
  attackMaxRange:
  knockbacks:
  cost:
  rechargeFrames:
attack:
  targeting: SINGLE | AREA | OMNI | CUSTOM
  totalCycleFrames:
  startupFrames:
  backswingFrames:
  hits:
    - frame:
      damageRatio:
      minRange:
      maxRange:
  effects: []
```

`attackTotal`은 멀티히트 전체 합계 기준이며 각 hit의 damageRatio 합은 기본적으로 1.0. 의도적으로 Strengthen 등 조건부 추가 피해가 있으면 별도 기록한다.

---

## 3. 레벨 적용

캐릭터 페이지에는 다음을 명시한다.

- 기본 레벨이 적용되는 스탯
- +레벨이 적용되는 스탯
- 형태 고유 고정값
- 반올림 규칙

기본 원칙:

- Base Lv/+Lv: HP와 기본 공격 중심
- 사거리/비용/재생산/이속/KB는 레벨 때문에 자동 증가하지 않음
- 형태가 바뀌면 고정 정체성 수치는 별도값 사용 가능

페이지 예시:

```yaml
scaling:
  hp: BASE_PLUS
  attack: BASE_PLUS
  range: FIXED_BY_FORM
  cost: FIXED_BY_FORM
  recharge: FIXED_BY_FORM
```

---

## 4. 대항 능력

효과 하나마다 조건과 수치를 분리한다.

```yaml
- type: DAMAGE_MULTIPLIER
  target:
    attributes: [BEAST]
    tags: []
  value: 1.5

- type: SLOW
  target:
    attributes: [MACHINE]
  chance: 0.30
  durationFrames: 60
```

`BEAST에 강함` 같은 설명만 남기지 않는다.

---

## 5. 상태효과

모든 상태효과는 최소 다음을 정의한다.

- 타겟 조건
- 확률
- 지속시간
- hit별 발동 여부
- 멀티히트에서 각 hit 독립 판정인지
- 같은 효과 중첩 규칙
- 면역/저항 상호작용

캐릭터별로 중첩 규칙을 다르게 만들지 않고 공통 sim 규칙을 참조한다.

---

## 6. 공격 범위

페이지에는 숫자와 함께 전선 의미를 설명한다.

예:

- standing 280
- attack 260~320
- 역할: 벽 뒤 안정딜
- 위험: 250 안쪽에 파고든 러셔를 때리지 못함

범위가 특이하면 간단한 ASCII 또는 좌표 설명을 추가한다.

```text
아군기지 <- [blind] 0---220 | HIT 220---460 | -> 적기지
```

---

## 7. DPS와 단발

위키에는 자동 계산 가능한 입력값과 사람이 읽을 요약을 둘 다 기록한다.

- 1회 공격 총 피해
- 공격주기
- 명목 DPS
- 속성 대항 적용 DPS
- 멀티히트가 모두 맞았을 때/일부만 맞았을 때

DPS만으로 캐릭터를 평가하지 않는다. 사거리, 생존, 공격 실패율, 비용, 재생산을 함께 본다.

---

## 8. 생산 경제

각 형태는 다음을 설명한다.

- 비용이 같은 시점 평균 보급의 몇 %인지
- 첫 생산까지 예상 대기
- 재생산 1회 동안 보급이 얼마나 회복되는지
- 같은 역할 캐릭터 대비 비용/쿨

저비용 벽/러셔는 60F 재생산 하한과 함께 검토한다.

---

## 9. 자연 KB

- 자연 KB 횟수
- 임계 계산 방식
- KB 애니메이션 프레임
- KB 후 다시 standing range를 잡는 데 걸리는 시간

높은 KB가 생존 장점인지 공격 취소 약점인지 설명한다.

---

## 10. 시각 사양

### 실루엣

- 화면 축소 상태에서 한 문장으로 구별 가능해야 함
- 주 실루엣 요소 2~4개
- 금지되는 유사 실루엣

### 형태 변화

F1→F2→F3에서 최소 다음 중 3개 이상 변화 권장.

- 몸 비율
- 대표 장비 크기
- 헤드/등/꼬리 구조
- 이동 방식
- 공격 자세
- VFX 구조
- 색 구성

단순 색 변경은 형태 변화로 인정하지 않는다.

---

## 11. 애니메이션 사양

각 모션:

```yaml
idle:
  loopFrames:
move:
  loopFrames:
attack:
  totalFrames:
  visualContactFrames: []
knockback:
  totalFrames:
death:
  totalFrames:
```

simulation hit frame과 visualContactFrame의 대응을 표로 남긴다.

| Sim hit | Animation contact | 허용 오차 |
| ---: | ---: | ---: |
| 12F | 12F | 0~1F |

---

## 12. VFX/SFX

- 소환
- 이동 특수음
- 공격 준비
- hit
- 상태효과 발동
- KB
- 사망

각 소리를 전부 고유 제작할 필요는 없지만, 공격 재질/크기/속성에 맞는 사운드 패밀리를 지정한다.

---

## 13. 역할 비교표

페이지에는 가장 유사한 기존 캐릭터 2~4명과 비교표를 둔다.

| 항목 | 신규 | 비교 A | 비교 B |
| --- | ---: | ---: | ---: |
| 비용 | | | |
| HP | | | |
| DPS | | | |
| standing range | | | |
| recharge | | | |
| 핵심 장점 | | | |
| 핵심 약점 | | | |

비교표에서 신규가 거의 모든 축을 이기면 재설계한다.

---

## 14. 카운터와 실패 조건

캐릭터마다 최소 2개 약점을 의도적으로 적는다.

예:

- 빠른 러셔에게 사각 침투
- 장거리 저격수에게 먼저 맞음
- 비싼 비용 때문에 초반 사용 곤란
- 공격 선딜이 길어 KB에 취소
- 낮은 HP
- 긴 재생산

“강하지만 약점 없음”은 승인하지 않는다.

---

## 15. 협동 검토

- 두 플레이어가 동일 캐릭터를 가져왔을 때
- 팀 10칸에서 동일 역할 2배 구성
- 개인 경제 2개가 존재할 때 생산량
- 화면 엔티티 수
- 합동 병기와의 시너지

필요하면 협동 금지 대신 기본값/비용을 고치는 쪽을 우선한다.

---

## 16. PvP 검토

랭킹 표준화 상태에서 다음을 본다.

- 표준 HP/공격에서 비용 대비 효율
- 스폰킬/기지 러시 가능성
- 무한 벽
- 장거리 교착
- 상태효과 잠금
- 특정 미보유 캐릭터 강제 여부

PvE 수치와 PvP 수치를 완전히 별도 캐릭터로 복제하는 것은 최후 수단이다.

---

## 17. 적 전용 추가 필드

```yaml
rewardSupply:
baseMagnification:
allowedMagnificationRange:
spawnRole:
firstEncounter:
synergyEnemies: []
dangerousCombinations: []
```

적 배율은 스테이지 데이터에서 조정하되, 허용 범위를 위키에 둔다.

---

## 18. 보스 전용 추가 필드

- 등장 컷인/경고
- 기지 HP 트리거
- 페이즈 전환 조건
- 페이즈별 공격/스탯 변화
- 동반 웨이브
- 보스 사망 시 후속 스폰 처리
- 보스가 나오기 전 기지가 파괴되는 것을 허용하는지

보스전은 보스가 실제로 전투 핵심이 되도록 baseline을 검사한다.

---

## 19. 테스트 기록

최소:

```yaml
tests:
  deterministic:
  expectedRoleAchieved:
  clearContext:
  coop:
  pvp:
  visual:
  notes:
```

`TESTED`로 올릴 때 빈칸이 없어야 한다.
