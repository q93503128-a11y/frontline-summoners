# Production Asset Pipeline 구현 기록 — 2026-09-01

상태: `DESIGN_TARGET / integration in progress`

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `PREMIUM_CHARACTER_ART_DIRECTION.md`
- `CHARACTER_ART_MOTION_PRODUCTION_RULES.md`
- `ANIMATION_CONTACT_FRAME_TARGETS.md`
- `AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md`

이 문서는 현재 CC0 공용 sprite family + tint 기반 placeholder 런타임과 향후 정식 제작 자산을 분리하는 production 계약을 기록한다. 자동 CI 통과는 사람의 아트 승인이나 실제 브라우저 QA를 뜻하지 않는다.

## 1. 이번 구현의 목적

기존 `assets.ts`의 7개 공용 sprite family는 시스템 검증용 placeholder다. 정식 캐릭터 디자인이 시작된 뒤에도 이 거대 매핑을 직접 덮어쓰거나, 검수 전 파일이 런타임에 섞이거나, F1/F2/F3가 같은 외형으로 남는 구조를 허용하지 않는다.

새 파이프라인은 다음 원칙을 고정한다.

1. 정본 로스터/진화/적/스테이지 데이터에서 production 요구사항을 자동 생성한다.
2. `AWAITING_ART`, `READY_FOR_REVIEW`, `APPROVED`를 명확히 분리한다.
3. 실제 런타임은 `APPROVED` unit art만 production 자산으로 승격한다.
4. 승인 자산이 없거나 대상이 아직 미제작이면 기존 검증된 placeholder로 안전하게 fallback한다.
5. 승인 전 사용자 검수가 필요한 S/SS를 임의로 `APPROVED` 처리하지 않는다.

## 2. 코드 정본

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

공격 contact frame도 sprite metadata 범위 안에 있어야 하며 production URL은 `/assets/production/` 아래만 허용한다.

### `apps/client/src/active-visual-forms.ts`

현재 active save의 `selectedFormId`를 presentation-only mirror로 보관한다.

- progression을 쓰지 않는다.
- simulation authority가 아니다.
- F1/F2/F3 중 어떤 production presentation을 선택할지만 전달한다.

### `apps/client/src/active-progress.ts`

`loadActiveProgress()`가 반환하는 guest / account online / account offline cache progress 모두 동일하게 visual-form mirror를 갱신한다.

### `apps/client/src/navigation-scenes.ts`

Boot preload는 더 이상 placeholder `ART_FAMILIES`만 고정 순회하지 않고 `getRuntimeSpriteStrips()`를 사용한다. 따라서 향후 실제 `APPROVED` candidate가 추가되면 동일 preload 경로에서 production strip이 포함된다.

### `apps/client/src/scene-ui.ts`

공용 `familyForUnit()`은 production resolver를 사용하고, 호출자가 form id를 생략하면 active progress가 선택한 form을 presentation 기준으로 사용한다.

## 3. 현재 첫 vertical slice

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

## 4. 회귀 계약

`apps/client/test/production-asset-contract.test.ts`가 다음을 고정한다.

- player 43명 존재
- canonical evolution form 129개 존재
- production player requirement 129개 존재
- 캐릭터마다 정확히 3개 form reservation
- 현재 enemy 전체 requirement 존재
- 아직 production character candidate가 0개임을 명시
- vertical slice가 거짓 `APPROVED` 상태를 갖지 않음
- 승인 자산이 없는 현재 build는 기존 21개 placeholder sprite strip만 preload
- selected form identity는 placeholder fallback 중에도 보존
- active visual-form mirror가 progression을 쓰지 않고 form 선택만 추적

## 5. 아직 닫지 않은 연결

이번 계약 자체와 별개로 다음 runtime consumer는 추가 연결이 필요하다.

1. `BattleScene`이 production family의 전용 Knockback/Death strip을 실제 state rendering에 소비하는 것
2. `DeckScene`의 로컬 legacy portrait resolver를 공용 production resolver로 교체하는 것
3. 첫 실제 대표 아트/전장/BGM/SFX를 사용자 검수 후 candidate manifest에 넣는 것
4. 실기기/브라우저에서 silhouette, motion contact, mobile overlap, audio autoplay/volume을 사람 QA하는 것

1~2는 코드 integration 항목이며 최종 아트 디자인 자체를 먼저 만들 필요는 없다. 3은 사용자 승인 전 임의 진행하지 않는다.

## 6. 상태 의미

- 현재 문서 상태는 `DESIGN_TARGET / integration in progress`다.
- 자동 CI가 성공해도 `TESTED`로 올리지 않는다.
- production candidate `APPROVED`는 실제 자산 존재 + 정본 조건 검증 + 필요한 사용자 아트 검수를 거친 뒤에만 사용한다.
