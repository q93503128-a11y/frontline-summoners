# Production Asset Pipeline 구현 기록 — 2026-09-01

상태: `DESIGN_TARGET / automated CI GREEN, human art·browser QA pending`

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `PREMIUM_CHARACTER_ART_DIRECTION.md`
- `CHARACTER_ART_MOTION_PRODUCTION_RULES.md`
- `ANIMATION_CONTACT_FRAME_TARGETS.md`
- `AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md`

이 문서는 현재 CC0 공용 sprite family + tint 기반 placeholder 런타임과 향후 정식 제작 자산을 분리하는 production 계약을 기록한다. 자동 CI 통과는 사람의 아트 승인이나 실제 브라우저 QA를 뜻하지 않는다.

## 1. 구현 목적

기존 `assets.ts`의 7개 공용 sprite family는 시스템 검증용 placeholder다. 정식 캐릭터 디자인이 시작된 뒤에도 이 거대 매핑을 직접 덮어쓰거나, 검수 전 파일이 런타임에 섞이거나, F1/F2/F3가 같은 외형으로 남는 구조를 허용하지 않는다.

파이프라인은 다음 원칙을 고정한다.

1. 정본 로스터/진화/적/스테이지 데이터에서 production 요구사항을 자동 생성한다.
2. `AWAITING_ART`, `READY_FOR_REVIEW`, `APPROVED`를 명확히 분리한다.
3. 실제 런타임은 `APPROVED` unit art만 production 자산으로 승격한다.
4. 승인 자산이 없거나 대상이 아직 미제작이면 기존 검증된 placeholder로 안전하게 fallback한다.
5. 승인 전 사용자 검수가 필요한 S/SS를 임의로 `APPROVED` 처리하지 않는다.
6. progression/simulation identity와 presentation form 선택을 분리한다.

## 2. Production 요구사항과 승인 gate

### `apps/client/src/production-assets.ts`

다음을 제공한다.

- 43명 × F1/F2/F3 = 129 player form visual requirements
- 현재 runtime enemy/boss 전체 visual requirements
- 실제 playable stage에서 사용 중인 battlefield theme requirements
- menu / chapter 1~4 / SPECIAL / PvP / battle SFX / UI SFX / ambience audio requirements
- 첫 production vertical slice reservation
- 승인된 unit art candidate validation
- production-first + placeholder-fallback resolver
- runtime sprite preload strip 집계

승인된 캐릭터 family는 최소 다음 motion을 제공해야 한다.

- Idle
- Move
- Attack
- Natural Knockback
- Death

공격 contact frame은 sprite metadata 범위 안에 있어야 하며 production URL은 `/assets/production/` 아래만 허용한다. `APPROVED`인데 Knockback/Death strip이 없거나 contact metadata가 잘못되면 manifest validation 단계에서 실패한다.

현재 `PRODUCTION_UNIT_ART_CANDIDATES`는 의도적으로 비어 있다. 따라서 현재 실제 플레이 visual은 기존 placeholder 그대로이며, production runtime 경로가 생겼다는 이유만으로 미검수 자산이 노출되지 않는다.

## 3. F1/F2/F3 presentation authority

### `apps/client/src/active-visual-forms.ts`

현재 active save의 `selectedFormId`를 presentation-only mirror로 보관한다.

- progression을 쓰지 않는다.
- simulation authority가 아니다.
- F1/F2/F3 중 어떤 production presentation을 선택할지만 전달한다.

### `apps/client/src/active-progress.ts`

`loadActiveProgress()`가 반환하는 guest / account online / account offline cache progress 모두 동일하게 visual-form mirror를 갱신한다.

### `apps/client/src/production-assets.ts`

`resolveUnitArt(unitId, selectedFormId?)`의 player form 선택 순서는 다음과 같다.

1. 호출자가 명시적으로 넘긴 `selectedFormId`
2. active visual-form mirror의 현재 선택
3. canonical F1 fallback

이 연결은 초기 pipeline 문서화 직후 실제 코드 대조에서 누락이 발견되어 수정했다. 이제 문서 설명과 실제 runtime resolver가 일치한다.

## 4. Runtime consumer integration

### Boot preload

`apps/client/src/navigation-scenes.ts`의 Boot preload는 고정 `ART_FAMILIES` 순회 대신 `getRuntimeSpriteStrips()`를 사용한다. 따라서 실제 `APPROVED` candidate가 추가되면 동일 preload 경로에서 production idle/move/attack/knockback/death strip까지 자동 포함된다.

### 공용 UI resolver

`apps/client/src/scene-ui.ts`의 `familyForUnit()`은 production resolver를 사용한다. 호출자가 form id를 생략해도 active presentation authority가 선택한 form을 따른다.

### DeckScene

`apps/client/src/deck-scene.ts`의 별도 legacy `UNIT_ART / ART_BY_ID / ART_FAMILIES` portrait resolver를 제거했다.

현재 카드 portrait는:

`resolveUnitArt(slot.definition.id, meta?.selectedFormId)`

를 직접 사용한다. 따라서 편성 화면은 현재 저장된 form 선택을 명시적으로 따라가며, 향후 그 form의 production candidate가 `APPROVED`되면 별도 UI 패치 없이 정식 portrait로 승격된다.

### BattleScene

`apps/client/src/production-motion.ts`를 presentation motion authority로 추가했다.

- `NaturalKnockback` + production `knockback` strip → 전용 Knockback motion
- `Dying` + production `death` strip → 전용 Death motion
- Foreswing/Backswing → Attack
- Moving → Move
- 그 외 → Idle

Attack은 기존 deterministic attack timing/contact frame mapping을 그대로 사용한다. Production Death는 simulation의 `deathFrames`를 authored sprite frame 구간에 결정적으로 매핑하고 마지막 frame에서 clamp한다.

`BattleScene`은 이제 이 resolver를 사용한다. Production Death가 존재할 때에는 기존 placeholder용 generic 회전/페이드가 authored death motion을 덮어쓰지 않는다. Production Death가 없는 placeholder에서는 기존 generic 회전/페이드가 그대로 유지된다.

활성 strip마다 frame height가 다를 수 있으므로 전투 sprite scale도 현재 strip의 `frameHeight` 기준으로 다시 계산한다.

## 5. 첫 production vertical slice

아직 실제 최종 그림/음원을 생성하거나 승인하지 않았다.

예약된 첫 검수 묶음:

- 징집병 F1
- 징집병 F2
- 징집병 F3
- 일반 적 대표 1종
- 보스 대표 1종
- 첫 battlefield theme
- Chapter 1 BGM
- battle core SFX

모든 항목은 현재 `AWAITING_ART`다.

이 상태는 의도적이다. 정본의 캐릭터 아트 규칙상 특히 시리즈 S/SS는 최종 제작 전 사용자 검수가 필요하며, placeholder를 정식 아트로 승격해서는 안 된다.

## 6. 회귀 계약

### `apps/client/test/production-asset-contract.test.ts`

다음을 고정한다.

- player 43명 존재
- canonical evolution form 129개 존재
- production player requirement 129개 존재
- 캐릭터마다 정확히 3개 form reservation
- 현재 enemy 전체 requirement 존재
- 아직 production character candidate가 0개임
- vertical slice가 거짓 `APPROVED` 상태를 갖지 않음
- 승인 자산이 없는 현재 build는 기존 21개 placeholder sprite strip만 preload
- explicit selected form identity가 placeholder fallback에서도 보존됨
- active visual-form mirror의 선택도 form 인자를 생략한 공용 resolver에 실제 반영됨
- mirror가 비워지면 canonical F1로 fallback함

### `apps/client/test/production-motion-integration.test.ts`

다음을 고정한다.

- authored Knockback/Death strip 선택
- placeholder family의 기존 Idle fallback
- authored Death frame progression과 마지막 frame clamp
- `BattleScene`이 production motion resolver를 실제 소비함
- `DeckScene`에 legacy `UNIT_ART / ART_BY_ID / ART_FAMILIES` resolver가 다시 생기지 않음

## 7. 자동 검증 결과

초기 production contract는 CI #908 / run `33517401836`에서 전체 PASS했다.

Runtime consumer integration까지 닫은 최종 코드 HEAD `b8c2770ba2ca86ab871f755513df277b4f6566ac`는 CI #914 / run `33564942315`에서 아래 전 단계가 PASS했다.

- Install dependencies
- Typecheck
- Content schema
- Simulation
- Server co-op protocol/tests
- Core verification diagnostics upload
- Client diagnostics
- Client diagnostics artifact upload
- Client full suite
- Production build

자동 CI 성공은 코드 계약과 회귀 검증을 뜻하며 사람의 아트 승인 또는 브라우저 실기기 QA를 대신하지 않는다.

## 8. 현재 남은 production 작업

코드 consumer 연결은 이번 milestone에서 닫았다. 이제 남은 핵심은 실제 자산과 사람 검수다.

1. 첫 대표 아트/전장/BGM/SFX를 실제로 제작하고 `READY_FOR_REVIEW` 상태로 준비
2. silhouette, F1/F2/F3 차이, attack contact, KB/Death readability를 사람 검수
3. 승인된 항목만 candidate manifest에 `APPROVED`로 등록
4. 실제 모바일/데스크톱 브라우저에서 motion, overlap, audio autoplay/volume, 저사양/접근성 동작 QA
5. 대표 vertical slice가 품질 기준을 통과한 뒤 나머지 roster/enemy/battlefield/audio로 확장

특히 S/SS는 사용자 검수 없이 임의 승인하지 않는다.

## 9. 상태 의미

- 현재 문서 상태는 `DESIGN_TARGET / automated CI GREEN, human art·browser QA pending`이다.
- 자동 CI가 성공해도 `TESTED`로 올리지 않는다.
- production candidate `APPROVED`는 실제 자산 존재 + 정본 조건 검증 + 필요한 사용자 아트 검수를 거친 뒤에만 사용한다.
