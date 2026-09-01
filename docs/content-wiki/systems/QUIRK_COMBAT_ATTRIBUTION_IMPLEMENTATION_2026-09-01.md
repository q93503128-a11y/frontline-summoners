# 숨김 업적 — 전투 attribution 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_COMBAT_QUIRK_ATTRIBUTION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

## 1. 목적

기존 숨김 업적 4종 중 `열 명의 이야기`는 편성/승리 정보만으로 서버 검증이 가능해 먼저 닫혔다.

남은 3종은 실제 전투 프레임의 공격 대상과 사망 상태를 알아야 한다.

- `quirk_turnip_five`
- `quirk_duck_mech_finish`
- `quirk_bellcrab_multi`

클라이언트가 `조건을 달성했다`고 직접 신고하는 방식은 사용하지 않는다. 동일 BattleState와 동일 command log를 사용해 guest와 authenticated trusted replay가 같은 공용 판정을 사용한다.

## 2. 공용 attribution observer

새 공용 모듈:

`packages/sim/src/combat-quirk-attribution.ts`

관찰 순서는 다음과 같다.

1. authoritative BattleState step 직전 `captureCombatQuirkFrame`
2. 원래 전투 step 실행
3. 같은 프레임 직후 `resolveCombatQuirkFacts`

observer는 전투 state를 변경하지 않는다. 공격/피격/승패/해시는 기존 simulation이 그대로 결정한다.

중요한 타이밍 규칙:

- core battle은 non-MOVING `stateFrame`을 먼저 +1 한 뒤 hit frame을 수집한다.
- observer는 step 직전에 실행되므로 이미 시작된 foreswing의 `stateFrame + 1`이 이번 frame의 실제 hit frame인지 확인한다.

이 규칙을 별도 test로 고정한다.

## 3. 순무 행진

achievement/fact:

- `ach_quirk_turnip_five`
- `quirk_turnip_five`

실행 조건:

- PLAYER 측에 `char_common_c_turnip_rider`가 **5기 이상 동시에 생존**
- F1/F2/F3 어느 형태든 원 캐릭터 definition id는 같으므로 인정
- natural knockback / forced displacement 중이어도 살아 있으면 인정
- `DYING`, `REVIVING`, HP 0은 생존 수에 포함하지 않음

step 직전과 직후의 생존 수를 모두 확인하므로 다섯 번째 순무기수가 배치된 직후 같은 frame에 전투 상황이 변해도 실제로 5기가 동시에 존재했던 순간을 놓치지 않는다.

## 4. 울려라 종껍질

achievement/fact:

- `ach_quirk_bellcrab_multi`
- `quirk_bellcrab_multi`

실행 조건을 1차 구현에서 다음과 같이 구체화했다.

- `char_common_c_bell_crab`
- **한 번의 실제 AREA hit frame으로 적 유닛 3기 이상 동시 명중**

2기는 달성으로 처리하지 않는다.

대상 수는 공격 직전 단순 거리 추정이 아니라 core targeting과 같은 기준을 적용한다.

- 반대 team
- targetable 상태
- 실제 attackMinRange / attackMaxRange
- 현재 F1/F2/F3가 적용된 definition
- 같은 거리에 있으면 simulationId 순서

거점은 3기 카운트에 포함하지 않는다.

## 5. 태엽 대 기계

achievement/fact:

- `ach_quirk_duck_mech`
- `quirk_duck_mech_finish`

실행 조건:

- 공격자 `char_common_b_clockduck`
- 실제 SINGLE hit가 MACHINE attribute + BOSS tag 적을 타격
- 그 프레임 뒤 대상이 `DYING`
- **태엽오리기사 자신의 해당 타격 피해만으로 공격 직전 남은 HP를 0 이하로 만들 수 있어야 함**

마지막 조건을 둔 이유는 30Hz 동시 damage batch 때문이다.

같은 frame에 다른 아군의 대형 공격과 태엽오리의 작은 공격이 함께 들어와 보스가 죽었을 때, 단순히 `그 frame에 태엽오리가 맞혔다`만으로 막타 업적을 주면 잘못된 attribution이 된다.

따라서 태엽오리 공격의:

- 현재 weaken
- attribute/tag damage bonus
- 대상 damage-taken modifier

까지 반영한 독립 유효 피해가 보스의 공격 직전 HP 이상일 때만 finishing credit을 준다.

부활형 대상이 `REVIVING`으로 전환된 경우는 kill로 보지 않는다.

## 6. guest battle

MAIN/SPECIAL 일반 솔로는 `QuirkBattleScene`이 기존 BattleScene의 authoritative step 순서를 그대로 재사용하면서 observer만 앞뒤에 붙인다.

Record는 `QuirkRecordBattleScene`이 같은 방식으로 처리한다.

guest에서 새 fact가 처음 감지되면:

- `recordGuestAchievementFact`
- 기존 profile achievement 자동 정규화
- 기존 장식 보상 소유권 자동 반영

전투 중에는 작은 `숨겨진 도전` toast만 표시한다. fullscreen interrupt는 만들지 않는다.

## 7. authenticated trusted battle

로그인 계정은 클라이언트 observer 결과를 권위로 쓰지 않는다.

기존 `/api/account/battles/complete` 요청을 서버 entry에서 intercept한 뒤:

1. 기존 canonical `resolveAuthenticatedAccountHttp`가 원래 trusted replay를 먼저 완료
2. 성공한 동일 battleId + 동일 command log로 `trusted-combat-quirk-replay.ts`가 attribution replay 수행
3. initial state hash / final state hash / clearFrames / winner / Record 결과까지 원본 completion과 대조
4. 일치할 때만 combat quirk fact 확정
5. `recordAccountAchievementFact`로 server-owned profile fact 기록

따라서 클라이언트가 임의 fact id를 전송하는 API surface는 없다.

complete 재시도는 기존 battle completion idempotency와 profile fact idempotency를 그대로 사용한다.

## 8. 범위 경계

이번 묶음에서 닫힌 것:

- guest MAIN/SPECIAL 솔로
- guest Record
- authenticated trusted MAIN/SPECIAL
- authenticated trusted Record
- 세 combat hidden achievement의 공용 deterministic 조건
- observer 단위 테스트 추가

아직 별도 작업이 필요한 것:

- 2인 협동에서 어느 seat가 조건을 달성했는지 ownerBySimulationId 기반 개인 attribution
- PvP에서 숨김 PvE형 업적을 허용할지 정책 결정
- production badge art
- authenticated 결과 화면에서 서버 검증 완료 fact명을 별도 reveal하는 UX

현재 3개 combat quirk는 솔로/Record에서 완전한 fact source를 가지며, 협동은 잘못된 공동 지급을 피하기 위해 아직 의도적으로 연결하지 않는다.

## 9. QA 경계

아직 `TESTED/LOCKED`가 아니다.

사람 QA에서 확인할 항목:

- 실제 순무기수 5기 유지 난도
- 종껍질 게 3기 동시 명중 빈도
- MACHINE BOSS를 태엽오리 독립 lethal damage로 마무리하는 체감 난도
- F1/F2/F3 모두 같은 원 캐릭터로 정상 인정되는지
- 모바일 toast 가독성

전체 CI는 이 콘텐츠 묶음이 끝난 뒤 한 번 통합 실행한다.
