# 스테이지 상세 사양 표준

상태: `LOCKED`

메인/SPECIAL/이벤트/기록전의 모든 스테이지는 구현 전에 이 규격을 만족한다.

---

## 1. 메타

```yaml
stageId:
displayName:
status:
category: MAIN | SPECIAL | EVENT | RECORD
collectionId:
chapter:
order:
difficulty:
unlock:
recommendedProgress:
  baseLevel:
  plusLevel:
  forms:
  expectedOwnedRoles: []
playModes: SOLO_ONLY | SOLO_OR_COOP | COOP_ONLY
```

난이도는 숫자만 쓰지 않고 `DIFFICULTY_CALIBRATION.md`의 근거를 첨부한다.

---

## 2. 설계 목적

각 스테이지에는 한 문장 목적을 쓴다.

좋은 예:

- 긴 선딜 후열을 빠른 BEAST 러셔로부터 보호하는 법을 가르친다.
- 보급소 1회 선투자와 즉시 병력 생산의 차이를 시험한다.
- 앞선 세 스테이지에서 배운 중갑 대응과 장거리 사각을 동시에 요구한다.

나쁜 예:

- 어려운 스테이지
- 적이 많이 나오는 곳

---

## 3. 전장

```yaml
battlefield:
  mapLength:
  themeId:
  decorSeedPolicy:
  playerBaseHp:
  enemyBaseHp:
  cameraStart:
  specialLandmark:
```

맵 길이와 첫 접촉 시간의 관계를 기록한다.

---

## 4. 경제

```yaml
economy:
  startingSupply:
  workerStartLevel:
  workerMaxLevel:
  killSupplyMultiplier:
  specialRules: []
```

정상 진행 계정이 첫 15초 안에 할 수 있는 선택을 별도로 설명한다.

예:

- 징집병 1기 즉시 + 6초 대기 후 방벽기사
- 아무것도 뽑지 않으면 13초에 보급소 Lv2 가능

---

## 5. 스폰 이벤트

모든 스폰은 시간 또는 조건을 명확히 한다.

```yaml
waves:
  - id: W1
    trigger:
      type: TIME
      frame: 90
    spawn:
      enemyId:
      count:
      intervalFrames:
      magnification:
```

조건 유형 후보:

- TIME
- ENEMY_BASE_HP_BELOW
- PLAYER_BASE_HP_BELOW
- BOSS_HP_BELOW
- ENEMY_COUNT_BELOW
- PREVIOUS_WAVE_CLEARED
- PERIODIC_AFTER_TRIGGER

---

## 6. 반복 웨이브

```yaml
repeat:
  startFrame:
  intervalFrames:
  maxCount: null
  stopCondition:
  composition: []
```

`무한 반복`을 사용할 때는 전투가 끝나지 않는 교착을 만들지 않는지 검사한다.

---

## 7. 기지 HP 트리거

적 기지 HP를 공격했을 때 보스가 나오는 경우:

- 트리거 %
- 이미 시간 트리거로 나왔을 때 중복 여부
- 보스 등장 전에 기지 파괴 가능한지
- 높은 한방 캐릭터로 트리거를 건너뛰는지

를 명시한다.

---

## 8. 보스

```yaml
boss:
  bossId:
  trigger:
  magnification:
  intro:
  supportWaves: []
  phaseRules: []
```

ST20 같은 최종전은 baseline에서 보스가 실질적으로 등장하고 싸우기 전에 기지가 파괴되지 않아야 한다.

---

## 9. 협동

`SOLO_OR_COOP`이면 반드시 작성한다.

```yaml
coop:
  enemyHpMultiplier:
  enemyAttackMultiplier:
  enemyBaseHpMultiplier:
  changeSpawnPattern: false
  changeRange: false
  changeMoveSpeed: false
  notes:
```

출발 후보 범위:

- HP ×1.15~1.30
- 공격 ×1.05~1.15
- 적 기지 ×1.10~1.20

총 덱 종류가 10개로 동일하므로 자동 ×2 금지.

협동에서 한 플레이어가 경제/전열을 전담했을 때 난도가 지나치게 낮아지는지도 검사한다.

---

## 10. 예상 전투 리듬

다음 구간을 서술한다.

- 0~15초: 첫 선택
- 15~30초: 첫 전선 형성
- 30~60초: 핵심 압박
- 60초 이후: 보스/후반/마무리

짧은 스테이지면 구간을 축소한다.

---

## 11. 클리어 시간 목표

- 최소 정상 클리어
- 중앙값 목표
- 느린 안전 클리어

예:

```yaml
clearTimeTarget:
  fast: 55s
  median: 85s
  slow: 125s
```

지나치게 긴 반복 파밍 스테이지는 보상 경제와 함께 재검토한다.

---

## 12. 첫 클리어 보상

```yaml
firstClear:
  gold:
  recruitmentCurrency:
  plusCurrency:
  evolutionMaterials: []
  characterUnlock:
  permanentReward:
  cosmetic:
```

메인 영구 보상은 RNG가 아니다.

---

## 13. 반복 보상

```yaml
repeatReward:
  normal:
  charged:
  depleted:
  chargeCost:
```

상시 메인처럼 반복 파밍 목적이 아닌 스테이지는 낮은 반복 보상 또는 없음도 가능하다.

---

## 14. 보상 충전

사용하는 경우:

- 묶음 최대 충전
- 회복 방식/주기
- 스택 상한
- 한 판 소모량
- 소탕 시 소모량
- 충전 0일 때 보상

`매일 특정 시간 안 들어오면 손해`보다 누적 가능한 회복을 우선한다.

---

## 15. 2배속

- 첫 클리어에서 허용 여부
- 클리어 후 허용 여부
- 기록전 예외
- 배속 상태 저장 정책

기본: 첫 클리어 1×, 재클리어 1×/2× 무료.

---

## 16. 소탕

```yaml
sweep:
  allowed:
  requiresPriorClear:
  consumesTicket:
  consumesRewardCharge:
  grantsFirstClear: false
  grantsRecord: false
```

기록 SPECIAL, PvP는 false.

---

## 17. 난이도 근거

최소 8항목을 0~4점으로 기록한다.

- 성장 요구
- 초반 경제 압박
- 전선 밀도
- 사거리 압박
- 속성/역할 대응 요구
- 보스 복잡도
- 덱 실패 민감도
- 회복 가능성

이 점수는 난이도 숫자를 자동 결정하는 절대 공식이 아니라 비교 일관성을 위한 자료다.

---

## 18. 실패 원인 예상

스테이지가 의도한 대표 실패 이유 2~4개를 쓴다.

예:

- 보급소를 너무 일찍 두 번 올려 첫 러셔를 못 막음
- 장거리만 편성해 사각 침투에 붕괴
- 중갑 적에 단일 저DPS 전열만 사용

의도하지 않은 대표 실패 이유가 발견되면 수정한다.

---

## 19. 특정 캐릭터 필수성 검사

다음 덱군으로 최소 하나 이상 클리어 가능해야 한다.

- 스토리 중심 덱
- 공통 C/B/A 중심 덱
- 해당 시점 일반적인 혼합 덱

특정 S/SS 한 명만 있으면 쉬워지고 없으면 사실상 불가능한 구조는 재설계한다.

---

## 20. deterministic baseline

기록:

- seed
- 덱
- 레벨/+레벨/형태
- 입력 스크립트 또는 bot 정책
- 클리어 여부
- 클리어 시간
- 남은 거점 HP
- 생산 횟수
- 최고 동시 엔티티 수

이 baseline은 사람 난이도를 대체하지 않고 회귀 검출용으로 사용한다.

---

## 21. 사람 플레이테스트

최소 기록:

- 테스트 인원/숙련도
- 사용 덱
- 첫 시도 승률
- 3회 내 승률
- 중앙 클리어 시간
- 패배 이유
- 재미/지루함
- 룰 이해 여부
- 협동 결과

난이도 `TESTED` 판정은 사람 테스트를 포함한다.

---

## 22. UI 표시

스테이지 선택 화면에서 보여줄 것:

- 이름
- 난이도
- 솔로/협동 가능
- 발견한 적 미리보기
- 첫 클리어 보상
- 영구 보상
- 클리어 여부
- SPECIAL 남은 보상 충전
- 2배속/소탕 가능 상태

내부 스폰 프레임이나 권장 정확 덱은 플레이어에게 그대로 노출하지 않는다.

---

## 23. 변경 기록

스폰/보스/보상이 바뀌면 변경 이유와 영향 범위를 기록한다. 난이도가 바뀌었는데 표시 숫자를 그대로 두는 것을 금지한다.
