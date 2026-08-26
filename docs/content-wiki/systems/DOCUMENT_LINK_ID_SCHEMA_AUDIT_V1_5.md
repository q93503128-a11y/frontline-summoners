# 전선소환전 v1.5 문서 링크·ID·스키마 설계 감사

감사일: 2026-08-26  
상태: `DESIGN AUDIT`  
범위: 기획서 / 콘텐츠 바이블 / 문서 간 참조 / 설계 ID namespace  
코드/CI: 이 감사 범위 아님

---

# 1. 결론

현재 1차 완성 설계 문서는 **구현 착수 가능한 수준의 DESIGN_TARGET**으로 판단한다.

현재 감사에서 문서 구조를 막는 P0 설계 공백은 발견하지 않았다.

다만 대부분 수치는 아직 실제 게임에서 검증되지 않았으므로 `LOCKED`가 아니다.

다음 단계는 새 시스템 아이디어를 계속 추가하는 것보다 실제 구현/시뮬레이션/사람 플레이를 통해 DESIGN_TARGET을 TESTED로 올리는 것이다.

---

# 2. 문서 권위 PASS

현재 순서:

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`, `docs/STAGE_SYSTEM_DESIGN.md` 등 시스템 정밀 문서
4. `docs/content-wiki/` 개별 상세 사양
5. 실제 content/schema/code/test
6. 구현 검증 문서

content/code가 현재 실행된다는 이유만으로 기획 정본을 덮지 않는다.

---

# 3. 이번 패스에서 새로 닫힌 규칙

## SPECIAL 최초 개방

```text
main_01_020 NORMAL_CLEAR
→ 제1장 완료
→ SPECIAL 허브 개방
```

- 솔로/정상 협동 동일
- ST19 미개방
- 소탕으로 최초 해금 불가
- 허브/collection/stage 단계 잠금 분리

정본:

- `STAGE_SYSTEM_DESIGN.md`
- `systems/SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`
- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`

## 스토리

- 선택형 분위기 요소
- 처음 보는 장면도 즉시 Skip
- 자동 story skip
- 스킵해도 진행/보상/튜토리얼/시스템 해금 동일
- 협동 파트너 blocking 금지
- gameplay boss telegraph와 narrative 분리

## UI

- 640×360부터 실제 검사
- COMPACT/MEDIUM/WIDE
- 44px 일반 최소 touch
- mobile deck drag long press 220ms
- drag fallback tap→slot
- SPECIAL 잠금 이유 자연어
- 스토리 Skip 첫 frame부터 노출

## 오디오/접근성

- audio bus/동시 voice/ducking
- 장별 BGM 방향
- material SFX family
- 화면 흔들림 0/50/100
- flash reduction
- reduce motion
- color/high contrast
- low spec/VFX density/render scale

## 초상화/모집 연출

- ICON/CARD/CODEX HERO crop
- STORY rarity frame 금지
- F1/F2/F3 portrait 분리
- C/B/A/S/SS reveal 목표 길이
- series-specific SS reveal
- skip/accessibility

## 업적/프로필

- 약 45~55개 초기 업적 목표
- grind/FOMO 금지
- 장식/소량 재화 중심
- 프로필 title/frame/banner/emblem/badge
- PvP 상위 장식은 성능 없음

---

# 4. 문서 파일 존재 확인

`docs/content-wiki/systems/`에서 다음 핵심 파일 존재를 확인했다.

- ACCOUNT_SAVE_SYNC_SPEC.md
- ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md
- ANIMATION_CONTACT_FRAME_TARGETS.md
- ATTRIBUTE_TAG_CATALOG.md
- AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md
- BASE_WEAPON_SYSTEM_V1.md
- CHARACTER_ART_MOTION_PRODUCTION_RULES.md
- CHARACTER_EVOLUTION_RECIPES_V1.md
- CHARACTER_PORTRAIT_CODEX_REVEAL_SPEC.md
- CHARACTER_SPEC_SCHEMA.md
- CONTENT_BIBLE_RULES.md
- DESIGN_DOCUMENT_AUDIT_V1.md
- DIFFICULTY_CALIBRATION.md
- MAIN_PERMANENT_REWARDS.md
- MAIN_STAGE_CURRENCY_REWARDS_V1.md
- MULTIPLAYER_SOCIAL_PVP.md
- PROGRESSION_NUMERICAL_TARGETS.md
- PVP_RANKING_MMR_REWARDS.md
- REWARD_ECONOMY_AND_SKIP.md
- SPECIAL_ACCESS_AND_STORY_PRESENTATION.md
- STAGE_SPEC_SCHEMA.md
- UI_SCREEN_LAYOUT_TOUCH_SPEC.md
- UI_UX_ENCYCLOPEDIA.md

디렉터리 내 신규 핵심 문서의 파일명 충돌은 발견하지 않았다.

---

# 5. ID namespace

구현 전 아래 namespace를 유지한다.

## 캐릭터

```text
char_*
```

스토리 기존 저장 호환상 legacy ID를 유지해야 할 경우 acquisitionClass와 rarity null 규칙을 깨지 않는다.

## 적

```text
enemy_*
```

## 보스

```text
boss_*
```

## 메인 스테이지

```text
main_CC_SSS
```

예:

```text
main_01_020
```

## SPECIAL collection

```text
special_{theme}
```

## SPECIAL stage

```text
special_{theme}_{NN}
```

## 이벤트

```text
event_{eventKey}_{NN}
```

## 업적

```text
ach_{category}_{key}
```

## 프로필 장식

업적 ID와 분리:

```text
profile_frame_*
profile_banner_*
profile_emblem_*
profile_badge_*
profile_title_*
```

업적 하나가 여러 장식을 주거나 같은 장식을 여러 경로에서 지급할 수 있으므로 achievementId와 cosmeticId를 동일 namespace로 사용하지 않는다.

---

# 6. ID 금지 규칙

- 표시 이름을 ID로 직접 사용하지 않는다.
- 한글 공백 포함 ID 금지.
- rarity를 character ID에 넣지 않는다.
- 현재 form을 base character ID에 넣지 않는다.
- stage difficulty를 stageId에 넣지 않는다.
- 날짜를 영구 content ID에 넣어 복각 때 새 콘텐츠처럼 복제하지 않는다.
- `v2`, `final`, `new` 같은 임시 suffix를 정식 content ID에 쓰지 않는다.

콘텐츠 교체 시 ID를 유지할지 새 ID를 만들지는 저장/도감 의미가 실제로 같은지 판단한다.

---

# 7. Form ID 규칙

후보:

```text
{characterId}_f1
{characterId}_f2
{characterId}_f3
```

form name은 표시 이름이며 ID와 분리.

F3가 역할이 크게 바뀌어도 다른 소유 캐릭터가 되는 것이 아니라면 base characterId는 유지한다.

---

# 8. Attribute/Tag namespace

attributes:

- NEUTRAL
- BEAST
- UNDEAD
- NATURE
- ARCANE
- DEMON
- MACHINE
- ANOMALY

combatTags는 별도 enum.

공식 부유 태그:

`FLOATING`

속성과 태그를 같은 문자열 배열 하나에 섞지 않는다.

---

# 9. 폐기용어 검색 결과

2026-08-26 GitHub repository search에서 다음 문자열은 결과가 반환되지 않았다.

- `FLYING`
- `LIGHT`
- `selectionCredits`
- `pity`
- `SPECIAL5`

주의:

GitHub code search index는 갱신 지연 가능성이 있으므로 이것만으로 실제 코드 0건을 증명하지 않는다.

실제 구현 작업 시작 시 로컬/repo 전체 텍스트 검색으로 다시 확인해야 한다.

문서에서 역사적 폐기 규칙을 설명할 때 문자열이 필요하면 `legacy/폐기` 맥락을 명확히 한다.

---

# 10. 스테이지 unlock schema 요구

최소 세 단계 분리:

```text
globalFeatureRequirement
collectionRequirement
stageRequirement
```

SPECIAL 예:

```text
globalFeatureRequirement = main_01_020 NORMAL_CLEAR
collectionRequirement = chapter progression / active schedule
stageRequirement = previous stage clear + progression
```

SPECIAL 허브 열림을 모든 stage의 40개 unlock 조건에 반복 하드코딩하지 않는다.

---

# 11. Story schema 요구

스토리 scene 데이터는 전투 승리/보상 조건과 분리한다.

후보 필드:

```text
sceneId
trigger
seenFlag
skippable=true
autoSkipEligible=true
replayable
```

다음 필드를 story 안에만 저장하지 않는다.

- system unlock
- tutorial completion
- reward grant
- stage clear

스토리 Skip이 진행 state machine을 건너뛰어 버리는 구조를 금지한다.

---

# 12. Achievement schema 요구

업적:

```text
achievementId
category
progressType
requirement
rewardIds[]
visibility
repeatable=false
```

등록 evaluator만 사용하고 UI마다 별도 조건 코드를 만들지 않는다.

보상 idempotency 필수.

---

# 13. UI ID/상태 규칙

플레이어에게 내부 ID 노출 금지.

예:

나쁜 표시:

```text
special_gold_convoy_03 locked: chapter>=2
```

좋은 표시:

```text
무장 수송열차
제2장 진행 후 개방
```

디버그 화면에서만 내부 ID 허용.

---

# 14. 문서 링크 작성 규칙

같은 문서를 다음처럼 여러 방식으로 애매하게 참조하지 않는다.

권장:

- repo root 문서에서는 `docs/content-wiki/...`
- content-wiki 내부 요약에서는 명확한 상대경로 또는 파일명 + INDEX 연결

이름만 `상세 문서 참고`라고 쓰고 파일 경로가 없는 상태를 줄인다.

새 핵심 문서를 만들면 최소:

1. `docs/INDEX.md`
2. 필요 시 `docs/NEW_CHAT_PROMPT.md`

에 연결한다.

---

# 15. 수치 정본 중복 방지

다음 숫자는 가능하면 한 상세 문서만 실제 정본으로 가진다.

예:

- 43종 combat stat → `*_COMBAT_SPECS`
- hit frame → `ANIMATION_CONTACT_FRAME_TARGETS`
- evolution recipe → `CHARACTER_EVOLUTION_RECIPES_V1`
- 메인 일반 보상 → `MAIN_STAGE_CURRENCY_REWARDS_V1`
- 영구보상 → `MAIN_PERMANENT_REWARDS`
- PvP MMR → `PVP_RANKING_MMR_REWARDS`

상위 문서는 범위/대표값만 요약하고 상세 숫자를 복사해 독립 정본으로 만들지 않는다.

---

# 16. DESIGN_TARGET 상태 유지 항목

아직 테스트 전:

- 캐릭터 43종 전투수치
- Lv/+Lv 성장 곡선
- Gold 경제
- 모집 확률/공급량
- 진화 recipe
- 메인 영구/일반 보상
- SPECIAL 보상충전
- 협동 scaling
- PvP MMR/season
- base weapon 수치
- UI breakpoint 세부값
- Audio voice budget/mix
- 업적 초기 수/보상

이것은 문서 결함이 아니라 테스트 예정값이다.

---

# 17. 구현 전 자동 validator 권장

문서 이후 실제 data schema에 최소 다음 validator를 만든다.

- duplicate characterId
- duplicate enemyId/bossId
- duplicate stageId/collectionId
- duplicate achievementId/cosmeticId
- unknown attribute/tag
- STORY rarity non-null
- recruitment series SS count != 1
- missing F1/F2/F3
- recharge < 60F final result
- stage difficulty outside 1~12
- first-complete content difficulty 9~12 unexpected warning
- SPECIAL global unlock missing
- record SPECIAL multiplayerPolicy != SOLO_ONLY
- broken reward ID
- broken evolution material ID

문서의 수동 감사만으로 이런 오류를 계속 잡지 않는다.

---

# 18. 문서상 남은 비-P0 작업

구현 전에 반드시 새 대형 시스템을 더 설계할 필요는 없다.

후순위/운영 직전 가능:

- 장기 이벤트 캘린더
- 실제 BGM 파일/작곡
- 최종 profile cosmetic art
- 스토리 다시보기 기록실
- 2v2 랭킹
- 본능 이후 성장
- 난이도 9~12 본격 콘텐츠

---

# 19. 구현 착수 판정

## 기획 구조

**PASS**

## 콘텐츠 세밀도

**PASS — DESIGN_TARGET**

## 문서 링크/namespace

**PASS WITH IMPLEMENTATION-TIME VALIDATION REQUIRED**

## 코드/게임 실제 상태

**NOT EVALUATED**

실제 구현 작업은 반드시 현재 main의 code/content/test를 다시 감사한 뒤 시작한다.

---

# 20. 다음 단계

1. INDEX/NEW_CHAT_PROMPT에 v1.5 신규 문서 연결
2. 실제 main 구현 재감사
3. schema/data validator부터 정본에 맞춰 정리
4. coherent slice 구현
5. typecheck/test/build
6. 실제 PC/mobile 플레이테스트
7. DESIGN_TARGET → TESTED

이 시점부터는 문서만 계속 늘리기보다 실제 게임에서 수치를 검증하는 편이 우선이다.
