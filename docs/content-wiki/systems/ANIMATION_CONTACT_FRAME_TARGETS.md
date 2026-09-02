# 캐릭터 공격 애니메이션·Contact Frame 상세 목표

상태: `DESIGN_TARGET / runtime-synchronized, automated drift gate`  
상위: `CHARACTER_SPEC_SCHEMA.md`, 각 로스터 `*_COMBAT_SPECS.md`

목적: 전투 수치가 정해져 있어도 아트가 따로 만들어지면서 `검이 맞기 전에 데미지`, `화살이 도착하기 전에 피격`, `멀티히트 연출과 실제 hit 수 불일치`가 생기는 것을 막는다.

모든 시간은 30F=1초 simulation 기준이다. 아래 `hit`은 공격 상태 진입 후 실제 피해 프레임이다. 렌더 애니메이션은 60fps 이상이어도 simulation hit은 이 frame에 고정한다.

**2026-09-02부터 아래 43×3 표는 디자인 희망값이 아니라 현재 `buildCharacterCombatSlot()`이 만드는 실제 F1/F2/F3 `attackTiming.hitFrames`의 문서 mirror다.** `apps/client/test/animation-contact-runtime-sync.test.ts`가 43명/129형태를 전수 비교하므로 런타임 수치만 바꾸고 이 표를 방치하면 CI가 실패한다.

---

# 1. 공통 원칙

## 근접

- 실제 무기/몸이 목표 hurtbox와 겹치는 순간 ±1 render frame 안에 simulation hit.
- simulation hit이 시각 contact보다 먼저 발생하면 실패.
- 과장된 잔상은 hit 뒤에 남아도 되지만 실제 타격점보다 먼저 목표를 통과하지 않는다.

## 투사체

- simulation은 hitFrame에 피해를 결정한다.
- 시각 투사체는 공격자에서 출발해 hitFrame에 목표/판정 지점에 도착하도록 렌더한다.
- 발사 직후 즉시 피해 + 늦게 도착하는 투사체 금지.

## 마법/범위

- 바닥 문양, 충격파, 폭발의 `실제 위험 영역이 완성되는 순간`을 hitFrame으로 맞춘다.
- 예고 VFX와 피해 VFX를 분리한다.

## 멀티히트

- 각 hit마다 독립 contact/impact가 있어야 한다.
- 한 번 폭발했는데 숫자만 4번 들어가는 연출 금지.
- 자연 KB로 공격이 취소되면 남은 hit의 VFX도 취소하거나 불발 연출로 전환.
- 문서의 hit 개수보다 많은 장식성 접촉 연출을 넣어 실제 피해 횟수로 오인시키지 않는다.

---

# 2. 애니메이션 단계 명칭

- `anticipation`: 힘 모으기/조준/무기 들기.
- `commit`: 되돌리기 어려운 공격 동작 진입.
- `contact`: 실제 hit.
- `followThrough`: 공격 관성.
- `recovery`: 다음 행동 가능 전까지 복귀.

보스/고화력 유닛일수록 anticipation을 시각적으로 크게 주되, 단순히 애니메이션만 느리게 늘이지 않는다.

---

# 3. 스토리 10종 contact — 현재 runtime

| 캐릭터 | F1 hit | F2 hit | F3 hit | 연출 핵심 |
| --- | --- | --- | --- | --- |
| 징집병 | 5F | 5F | 5F | 짧은 창/몽둥이 접촉. F3도 빠른 5F contact에 맞춰 anticipation을 압축 |
| 방벽기사 | 10F | 10F | 10F | 방패 뒤 짧은 밀치기, 공격 중요도 낮음 |
| 수렵창병 | 11F | 11F | 11F | 창끝이 실제 판정 지점에 도달하는 순간 |
| 결투검사 | 8F | 8F | 8F | 매우 빠른 일섬. 세 형태 모두 8F 실제 contact |
| 청창대 | 14F | 14F | 14F | 방진 찌르기/파진 횡쓸기 모양은 달라도 실제 contact는 동일 |
| 전투마도사 | 19F | 19F | 19F | F1/2 전방 폭발, F3 포격도 현재 판정은 19F에 완성 |
| 화염술사 | 27F | 27F | 27F | 압축 → 방출 → 위험 영역 완성을 27F에 맞춤 |
| 왕실기사 | 20F | 20F | 20F | 대검이 지면/적을 가르는 순간 |
| 이단주술사 | 34F | 34F | 34F | 의식 위치의 실제 판정 완성 순간 |
| 공허현자 | 48F | 48F | 48F | 현재 F3도 단일 48F. 다단 연출은 simulation이 다단으로 바뀌기 전 금지 |

스토리 F1~F3 실제 attack cycle을 넘지 않아야 하며, 수치 변경 시 런타임과 이 표를 같은 변경에서 갱신한다.

---

# 4. 공통 C/B/A 15종 contact — 현재 runtime

| 캐릭터 | F1 hit | F2 hit | F3 hit | 연출 핵심 |
| --- | --- | --- | --- | --- |
| 순무기수 | 9F | 9F | 9F | 순무 돌진/무기 접촉 |
| 양철방패 시종 | 22F | 22F | 22F | 방패 모서리 밀치기 |
| 목동 투석수 | 24F | 24F | 24F | 투석체가 실제 판정 위치에 도착 |
| 종껍질 게 | 22F | 22F | 22F | 종 울림 충격파가 판정 반경에 도달 |
| 등불나방 | 10F | 10F | 10F | 현재 세 형태 모두 단일 contact. F3 다중 빛가루는 장식으로 피해 횟수를 오인시키지 않음 |
| 등불마녀 | 20F | 20F | 20F | 등불 불꽃이 전방 판정에 닿는 순간 |
| 태엽오리기사 | 12F | 12F | 12F | 태엽 검 타격 |
| 관짝 장사꾼 | 42F | 42F | 42F | 관뚜껑이 열리고 내부 타격체 접촉 |
| 이끼골렘 | 28F | 28F | 28F | 양팔/뿌리 지면 충격 |
| 먹물까마귀 | 24F | 24F | 24F | 먹물 떼가 목표 판정 영역을 덮는 순간 |
| 유리등대지기 | 70F | 70F | 70F | 광선/빛탄이 원거리 판정 위치에 도착 |
| 뼈북 악단장 | 18/26/34F | 18/26/34F | 18/26/34/42/50F | 북 타격 1회당 실제 1hit |
| 접지 않은 종이용 | 24F | 18/24/30/36F | 24F | F2만 현재 4연타, F1/F3는 단일 판정 |
| 고철 운석차 | 58F | 58F | 58F | 투사체가 지면에 착탄해 충격파 생성 |
| 거울길잡이 | 24/34F | 24/34F | 24/34/44F | 거울 반사 위치마다 실제 독립 hit 생성 |

공통 로스터 공식 부유 태그 표기는 `FLOATING`만 사용한다. `FLYING`은 금지된 구식 별칭이다.

---

# 5. 성휘의 기사단 S/SS contact — 현재 runtime

표의 캐릭터명은 현재 roster `displayName`을 사용한다. 개별 form명은 evolution catalog가 별도 권위다.

| 캐릭터 | F1 hit | F2 hit | F3 hit | 비고 |
| --- | --- | --- | --- | --- |
| 에르시아, 백은의 창 | 16F | 20F | 18F | 장창 끝이 실제 판정 지점에 도달 |
| 리에나, 불량 성녀 | 42F | 48F | 52F | 철퇴/사슬 성물의 최대 접촉 순간 |
| 미레이유, 유리궁의 사수 | 80F | 90F | 100F | 수정 화살이 실제 원거리 판정점 도착 |
| 네리아, 흑장미 기사 | 20F | 20F | 20F | 대검 근거리 AREA. 형태별 리듬 차이는 cycle/recovery에서 표현 |
| 토토리아, 마도인형사 | 28F | 28F | 28F | 본체가 아니라 전방 인형 손/무기가 접촉 |
| 아르셀리아, 별의 왕녀 | 40/50/60F | 42/54/66F | 42/54/68/84F | 별 구조체의 각 hit와 damage packet을 1:1로 대응 |

아르셀리아는 별 구조체의 위치가 실제 공격범위를 설명해야 하며 별이 닿지도 않은 뒤쪽 적에게 선행 피해가 들어가면 실패.

---

# 6. 태고의 거수 S/SS contact — 현재 runtime

| 캐릭터 | F1 hit | F2 hit | F3 hit | 비고 |
| --- | --- | --- | --- | --- |
| 돌등껍질 바르가 | 24F | 24F | 24F | 몸/앞발 지면 충격 |
| 꼬리칼날 지르카 | 8F | 8F | 8F | 꼬리칼날 횡베기 |
| 풍선포자 모구 | 30F | 30F | 30F | 포자 구름이 공격영역에 번지는 순간 |
| 천공턱 가르도 | 90F | 100F | 115F | 거대 턱이 완전히 닫히는 긴 예고형 한방 |
| 수정벌레 크리크 | 20/27/34F | 20/27/34F | 20/27/34F | 수정탄 3발 각각 독립 impact |
| 고대등짐 고르무 | 50F | 50F | 50F | 등짐 지형 전체가 흔들리는 대형 지면 충격 |

`풍선포자 모구` 등 부유 캐릭터 태그는 `FLOATING`으로 통일한다.

---

# 7. 제로 엣지 S/SS contact — 현재 runtime

| 캐릭터 | F1 hit | F2 hit | F3 hit | 비고 |
| --- | --- | --- | --- | --- |
| K-17 절단자 | 6F | 6F | 6F | 에너지 블레이드의 초고속 단일 contact |
| 아크 레일러 | 110F | 120F | 135F | 충전 완료 후 레일탄/광선이 판정점에 도착 |
| NANA-04 | 18/24/30/36F | 18/24/30/36F | 18/24/30/36F | 네 드론 순번과 4개 hit 순번 1:1 |
| 방벽기 RX-Ω | 22F | 22F | 22F | 방패 본체 밀치기, 공격 존재감 낮음 |
| 크로노 블레이드 하운드 | 12/16/20/24/28F | 12/16/20/24/28F | 12/16/20/24/28F | 5연속 칼날 접촉과 damage packet 1:1 |
| 아스트라 프레임 | 32/40/48/56/64F | 34/42/50/58/66/74/90F | 34/42/50/58/66/74/86/102F | F1 5단, F2 7단, F3 8단 배열. 마지막 hit의 시각적 중량을 가장 크게 |

---

# 8. 원거리 투사체 속도 계산

시각 투사체 출발 프레임은 `hit - travelFrames`.

```text
travelFrames = ceil(visualDistance / visualProjectileSpeedPerFrame)
launchFrame = hitFrame - travelFrames
```

launchFrame이 anticipation 이전으로 나가면 투사체 속도를 올리거나, 전투 리듬 자체를 바꿀 의도가 있을 때에만 simulation hitFrame과 관련 데이터를 함께 수정한다. 아트 편의를 위해 문서 값만 임의로 늦추지 않는다.

판정 위치가 공격 시작 이후 적 이동 때문에 달라질 수 있는 공격은 simulation 규칙에 맞춰:

- target snapshot 방식인지
- hitFrame 재판정 방식인지

캐릭터별 combat spec에서 명시한다.

---

# 9. 사운드 동기화

SFX 레이어:

- windup: 선택적
- release: 발사/휘두름
- impact: hitFrame ±1 render frame
- tail/reverb: 피해 후

큰 공격도 impact SFX가 contact보다 먼저 나오지 않는다.

멀티히트는 모든 hit에 같은 큰 소리를 반복해 귀가 피로해지지 않도록 첫/마지막 hit의 강도를 차별화 가능.

---

# 10. KB/공격 취소

자연 KB가 hit 이전 발생:

- 실제 hit 없음.
- 아직 발사하지 않은 투사체 없음.
- 차징 VFX 취소.

투사체가 이미 발사된 뒤 공격자가 KB되었을 때 투사체가 계속 유효한지는 공격 정의가 `PROJECTILE_COMMITTED`인지에 따라 명시한다. 1차는 시각 투사체 대부분이 판정용 독립 엔티티가 아니라 hitFrame 연출이므로 기본적으로 남은 hit 취소를 우선한다.

---

# 11. 2배속

2배속은 simulation tick을 건너뛰지 않는다.

- 30Hz sim 결과 동일.
- 렌더만 빠르게 진행.
- 8F 이하 초고속 선딜도 최소한 공격 자세 변화가 보이게 프레임 보간.
- 보스 위험기는 별도 예고 VFX 때문에 2배속에서도 읽혀야 한다.

---

# 12. 아트 납품 체크

캐릭터/형태마다 최소:

- Idle
- Move
- Attack anticipation
- Attack contact pose
- Follow-through/recovery
- Natural KB
- Death
- Summon/entry 후보

원거리/특수:

- Projectile or beam
- impact
- area marker
- 상태효과 적용 VFX

F1/F2/F3가 같은 sprite에 색만 바뀌어서는 안 된다.

---

# 13. 자동검증 데이터와 현재 gate

현재 전투 런타임 form에는 `attackTiming.cycleFrames`, `hitFrames[]`, `backswingFrames`가 있고 production sprite에는 별도 `attackContactFrame` metadata가 있다.

자동 검증:

- `apps/client/test/animation-contact-runtime-sync.test.ts`
  - initial roster 43명 확인
  - 문서 contact row 43개 확인
  - 각 row를 현재 roster `displayName`에 연결
  - F1/F2/F3 129형태를 `buildCharacterCombatSlot()`으로 실제 생성
  - 문서 `F1/F2/F3 hit`과 runtime `attackTiming.hitFrames`를 배열 단위로 전수 비교
  - 빠진 캐릭터, 중복 row, 단일↔멀티히트 drift도 실패 처리
- `tools/validate-production-vertical-slice.mjs`
  - 첫 production slice의 실제 simulation hit frame과 intake manifest를 다시 비교
  - sprite sheet `attackContactFrame` 자체는 이미지 strip index 범위로 별도 검사

향후 production animation metadata가 확장되면 다음도 구조화한다.

```text
animationContactFrames[]
projectileLaunchFrames[]
```

검증 원칙:

- hitFrames.length와 의도된 damage packet 수 일치.
- 시각 contact와 simulation hit 차이 허용치 기본 ±1 render frame.
- 마지막 hit < attackCycle.
- projectile launch < corresponding hit.
- startup이 0 이하가 아님.

실제 최종 아트 contact 때문에 전투 리듬을 바꿔야 할 경우 문서 숫자만 수정하지 않는다. simulation 수치, 관련 combat/evolution data, 본 표, production metadata를 같은 변경에서 함께 갱신하고 사람 플레이 검수 전에는 `TESTED`로 올리지 않는다.
