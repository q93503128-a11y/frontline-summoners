# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 작업 전 권위 순서:

`CANONICAL → GAME_DESIGN_FULL → 관련 정밀 문서(STAGE_SYSTEM_DESIGN / GROWTH_RECRUITMENT_DESIGN) → FEATURE_COVERAGE_MATRIX → IMPLEMENTATION_STATUS → DEVELOPMENT_RULES → content → 코드/테스트`

역사 복구 기준점:
- `28e0ce134467ecea34c25115130b3c2e1ec308e2` — `docs: add complete consolidated game design`.
- 현재 문서에서 초기 핵심 기능이 축약/누락된 것처럼 보이면 이 커밋과 `FEATURE_COVERAGE_MATRIX.md`를 함께 대조한다.

## 2026-08-24 — campaign + meta vertical slice 0.0.32

## 1. 현재 제품 뼈대

- Web PC/모바일 횡스크롤 소환 전략.
- `packages/sim` 30Hz 결정론적 전투 코어.
- 전투 핵심: 보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰.
- 현재 과금/에너지/FOMO 없음.
- 신규 계정: 징집병 1종 + ST1만 개방.
- 전투 콘텐츠: PROGRESSION20 + SPECIAL5 = 25전투.
- 캐릭터 전투 정의: 무료 캠페인10 + 첫 모집 전용15 = 25종.
- 초기 전체기획의 필수 기능 누락 방지표: `docs/FEATURE_COVERAGE_MATRIX.md`.

## 2. 전투 / 입력

- 이동, 탐지, foreswing/hitFrame/backswing, 동시 피해, 자연KB, ForcedDisplacement, DYING, 거점 승패, stateHash 구현.
- 보급소 Lv1~8, 생산비, 재생산, 처치 보급, `atTick` 웨이브, 전선포 구현.
- 기본 동시 출격 한도 아군50 / 적50. stage별 cap 지원.
- PC `1~0` 소환 / `Q` 보급소 / `E` 전선포 / `P·ESC` 솔로 일시정지.
- 쿨/보급부족/cap/MAX/보급강화실패/전선포쿨 같은 정상 실패 입력은 화면 흔들림 없음.
- shake는 전선포 성공 / 강한 유닛 피격 / 거점 피격 세 실제 충격 경로만.

## 3. PC / 모바일

- viewport 권위 `apps/client/src/viewport.ts`.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC 창은 PC UI 유지.
- 세로 모바일 가드는 coarse pointer + width≤900 + portrait.
- safe-area 적용.
- compact 핵심 터치 높이84 logical px.
- 모바일은 키보드 힌트 숨김, PC는 1~0/Q/E 표시 유지.

## 4. 제1장 / SPECIAL

### PROGRESSION

- 제1장20, 7 전장계열.
- 무료 캠페인 로스터10:
  - 시작 징집병
  - ST1 방벽기사
  - ST2 수렵창병
  - ST4 결투검사
  - ST6 청창대
  - ST8 전투마도사
  - ST10 화염술사
  - ST13 왕실기사
  - ST16 이단주술사
  - ST20 공허현자
- 제1장 보물20은 첫 클리어100%.
- ST20 보스 페이싱: 황금가면50초 / 철문장군80초.

### SPECIAL

- special-01 세 자리 전선 · 난이도6 · 실효3기.
- special-02 광란의 짧은 길 · 난이도7 · 650m 러시.
- special-03 유리봉 저격선 · 난이도8 · 1500m 저격전.
- special-04 삼인 결사대 · 난이도9 · 실효3기 + 철문장군50초.
- special-05 가면과 철문 · 난이도10 · 황금가면35초 → 철문장군70초.
- 제1장 완료 후 5개 동시 개방. SPECIAL끼리 순차 잠금 없음.
- SPECIAL clear는 메인 진도와 별도 저장.
- `special-baseline.ts/test.ts`는 5개 실제 승리/cap/필수 보스 관측을 요구하지만 최신 HEAD 실행 green은 아직 확인 전.

## 5. 대규모 출정 구조

정본:
`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

- PROGRESSION/SPECIAL 공용 StageSelect.
- 옛 `special-select` 중복 Scene 제거.
- Collection 데이터 `content/stage-collections.json`.
- SPECIAL 묶음 해금은 숫자20이 아니라 `unlockAfterStageId: border-20`.
- `STAGE_COLLECTIONS_PER_PAGE=2` helper 존재.
- `STAGES_PER_COLLECTION_PAGE=5` helper 존재.
- stage→내부 page 역산 helper 존재.
- `isSortieStageUnlocked()` 존재.

미완료:
- StageHub 실제 3+ Collection 좌우 paging UI.
- StageSelect가 공용 5-stage helper를 실제 Scene에서 소비하도록 통일.
- 결과 후 같은 Collection의 정확한 내부 page 복원.
- `main.ts` 실제 입장 gate를 `isSortieStageUnlocked()` 하나로 통일.

## 6. 초기 전체기획 복원 감사 — 0.0.32

- 역사 기준점 `28e0ce...`의 전체 통합 기획을 현재 정본과 재대조.
- 초기 전체기획에서 **레벨/강화·진화·모집·수동10칸덱이 출시 전 핵심 메타**였음을 다시 확인.
- 전투 vertical slice 우선 작업 중 이 기능들이 후순위처럼 보이게 축약된 문제를 문서 구조상 수정.
- `docs/FEATURE_COVERAGE_MATRIX.md` 신규 추가.
- 전투/수집/모집/중복/레벨/진화/덱/UI/스테이지/저장/멀티를 ID별 `DONE/PARTIAL/MISSING/PLANNED/CANDIDATE`로 고정.
- `apps/client/test/design-coverage.test.ts`가 핵심 메타 ID와 문서 권위 연결을 회귀 검사.

## 7. 모집 / 희귀도

정밀 정본: `docs/GROWTH_RECRUITMENT_DESIGN.md`.

### 첫 모집 전용 풀

- 기본 무료10종은 모집 풀에서 제외.
- `content/units/recruitment-01.json`: 모집 전용15종.
- C4 / B4 / A3 / S2 / SS2.
- `PLAYER_SLOTS` = 무료10.
- `RECRUITMENT_PLAYER_SLOTS` = 모집15.
- `ALL_PLAYER_SLOTS` = 25.

### 첫 배너

`content/recruitment/banner-01.json`:
- C30%
- B28%
- A24%
- S13%
- SS5%
- 10연 A+
- 30연 S+
- 60연 픽업 SS
- 100연 배너 캐릭터 직접 선택권 +1
- 현재 픽업 SS: `moon-eater`.

`apps/client/src/recruitment.ts`:
- 배너 JSON 확률/풀/픽업 검증.
- A+/S+ 보장은 최소 희귀도만 올리고 그 이상 희귀도 간 원래 확률비 유지.
- 60 milestone이 하위 10/30 보장보다 우선.
- 100은 랜덤 결과를 바꾸지 않고 selection credit 적립.
- 실제 난수 `crypto.getRandomValues()` rejection sampling.
- 테스트용 RNG 주입.
- 신규/중복 판정.

미완료:
- 모집 화면/결과 연출.
- 모집 재화와 지급 루프.
- 중복 조각 지급량/공용 성장재화 수치.
- 조각 직접 교환 UI/경제.

## 8. Lv1~50 성장

`content/growth/level-curve-01.json` + `apps/client/src/character-growth.ts`.

- Lv1~50.
- 현재 구체 곡선은 `PROTOTYPE_BALANCE`.
- Lv1~30 레벨당 HP/공격 +15‰.
- Lv31~50 레벨당 HP/공격 +8‰.
- Lv30=1435‰, Lv50=1595‰.
- 레벨은 HP/기본공격만 변화.
- 사거리/비용/재생산/이속/KB 등 정체성 값은 레벨로 바꾸지 않음.
- `applyCharacterLevel()` / `buildCharacterCombatSlot()` 구현.

미완료:
- 강화 골드 비용/전체 보상경제.
- 성장 화면.

## 9. 3형태 진화

- 기본/2형태/3형태.
- 이전 형태 재선택.
- form 간 소유권/레벨 공유.
- 무조건 상위호환보다 sidegrade/전문화 허용.
- 색놀이 진화 금지.

현재 `content/evolution/recruitment-01.json`에서 대표5명(C/B/A/S/SS 각각1명) 3-form 실제 전투 데이터:
- 순무기수
- 등불마녀
- 태엽오리기사
- 거울퇴마사
- 달먹는룡

form이 실제 바꿀 수 있는 값:
- HP/공격
- 비용/재생산
- 이동속도
- standingRange / attackMin / attackMax
- SINGLE/AREA
- 전문 damage bonus

`recordGuestEvolutionUnlock()`은 form2 없이 form3를 건너뛰어 해금하지 못하도록 이전 form 순서를 요구한다.

미완료:
- form2/3 구체 해금 조건.
- 진화 재료/비용.
- 나머지20 캐릭터 form 데이터.
- 정식 form별 고유 아트/애니/VFX/SFX.
- 진화 비교/선택 UI.

## 10. save v6 / 수동10칸덱 — 0.0.32 신규

`apps/client/src/save.ts` guest schema **v6**.

마이그레이션:
- v2 stage/treasure.
- v3 SPECIAL.
- v4 모집 소유권/천장.
- v5 character level/form.
- v6 명시적 deck.

저장 대상:
- `clearedStageIds`
- `specialClearedStageIds`
- `treasureIds`
- `ownedRecruitmentCharacterIds`
- `recruitmentProgressByBanner`
- `characterProgressById`
- `deckSlotIds`(선택적)

덱 규칙:
- 최대10, 최소1.
- 중복 캐릭터 금지.
- 보유 캐릭터만 허용.
- 기존 저장에 `deckSlotIds`가 없으면 **legacy automatic formation**: 보유 캐릭터를 정본 순서로 최대10 자동 편성.
- 사용자가 명시적 덱을 저장하면 그 1~10칸과 순서가 권위.
- `resetGuestDeckToAutomatic()`으로 자동 편성 모드 복귀 가능.
- session/durable merge에서 현재 세션의 명시적 덱 선택이 우선.

## 11. 저장된 덱 + level/form → 실제 전투 — 0.0.32 신규

`apps/client/src/player-loadout.ts`:
- `buildGuestDeckSlots(progress)`.
- `createGuestPrototypeBattle(stageId, progress)`.

흐름:
`GuestProgress → effective deck IDs → character level/form → BattleUnitDefinition → treasure effects → createPlayableBattle()`.

즉 level/form은 UI 메타에만 머물지 않고 실제 전투 슬롯 수치/사거리/특효에 반영되는 경로가 생겼다.

`prototype.ts`:
- `createPrototypeBattleWithPlayerSlots()` 추가.
- 기존 ID 기반 `createPrototypeBattle()`도 이 공용 경로를 사용하여 전투 생성 로직을 중복하지 않는다.

테스트:
- `recruitment-save.test.ts`: ownership/pity/level/form/deck 정규화와 자동/명시적 덱.
- `player-loadout.test.ts`: 저장된 덱 순서 + Lv30 + 선택 form이 실제 battle slot에 반영되는지 검사.

미완료:
- `FormationScene`이 실제 `recordGuestDeck()`을 호출하는 수동 편성 UI.
- `BattleScene`이 아직 기존 경로 대신 `createGuestPrototypeBattle()`을 사용하도록 main.ts 연결.
- 따라서 `FEATURE_COVERAGE_MATRIX`의 DECK-01은 아직 PARTIAL.

## 12. 아트

- 프로토타입 art family7개.
- 무료10/적10 기존 매핑.
- 모집15종도 명시적 `UNIT_ART` 매핑, 6개 이상 family 분산.
- 이것은 정식 모집 캐릭터 아트가 아니라 임시 식별용.
- 정식 캐릭터/진화는 고유 실루엣·종족·장비·모션·VFX 필요.

## 13. 저장 / 보상

- main progression과 SPECIAL 저장축 분리.
- 제1장 보물 첫 클리어100%.
- 모집 ownership/pity, level/form, 명시적 deck까지 v6 저장.
- 영구 저장 실패 시 same-tab session 유지 + persisted=false.
- 아직 골드/모집재화/조각/진화재료 저장은 미구현.

## 14. 협동 정본

- 2인 각5칸, 팀10.
- 개인 보급/보급소/생산 쿨다운.
- 공유 거점HP/승패/거점 병기.
- `협동 권장` 태그 금지.
- 필요 시 적 최대HP/공격력/거점HP만 단순 수치 보정.
- 이동속도/공격주기/사거리/KB/스폰/적 수/웨이브/패턴/AI를 협동 때문에 변경하지 않음.
- 합동 병기/재접속/Lv30 PvP 표준화는 현재 후보로 취급.

## 15. 현재 검증 한계

- `.github/workflows/ci.yml`: main push/PR에 install → typecheck → test → build.
- 이전 연결에서는 direct-main Actions 결과 확인이 불안정했다.
- 0.0.32 변경 후 실제 CI run을 다시 조회한다.
- 실제 green을 확인하기 전 신규 save v6/deck/player-loadout을 green이라고 단정하지 않는다.
- SPECIAL5 deterministic baseline 역시 최신 실행 결과를 확인해야 함.
- 임시 workflow를 쌓지 않는다. `.github/workflows` 최종은 `ci.yml` 하나.

## 16. 필수 메타에서 아직 큰 MISSING

`FEATURE_COVERAGE_MATRIX.md` 기준 우선:

1. FormationScene 수동10칸 편성 UI → save v6 연결.
2. BattleScene → 저장된 deck/level/form 전투 경로 연결.
3. 모집 화면/결과 연출.
4. 성장 화면.
5. 골드 + 모집재화 + 조각 경제.
6. 중복 조각 지급/직접 교환.
7. form2/3 해금 조건/진화재료.
8. 전체 캐릭터 3-form 확장.
9. 정식 고유 캐릭터/form 아트.
10. 도감25+ 확장/검색·필터.

## 17. 다음 우선순위

1. **최신 CI typecheck/test/build 실제 결과 확인.**
2. 실패가 있으면 save v6/deck/loadout 신규 경로부터 수정.
3. FormationScene 실제 수동10칸 편성 연결.
4. BattleScene이 `createGuestPrototypeBattle()`을 사용하도록 연결.
5. 모집 화면을 실제 save/recruitment engine에 연결.
6. 성장 화면 + 강화경제/진화조건 정본화.
7. StageHub/StageSelect paging UI 마무리.
8. SPECIAL5 deterministic 실행 검증.
9. PC/가로 모바일 실렌더 + Pages 배포 확인.

첫 사용자 테스트 요청은 최신 실행검증과 필요한 실렌더 감사가 끝난 뒤에만 한다. 전체 게임 메타 완성 여부는 별도로 `FEATURE_COVERAGE_MATRIX.md`의 필수 묶음으로 판단한다.
