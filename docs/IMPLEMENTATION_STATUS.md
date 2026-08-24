# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 작업 전 다음 권위 순서를 대조한다.

`CANONICAL → GAME_DESIGN_FULL → 관련 정밀 문서(STAGE_SYSTEM_DESIGN / GROWTH_RECRUITMENT_DESIGN) → IMPLEMENTATION_STATUS → DEVELOPMENT_RULES → content → 코드/테스트`

## 2026-08-24 — campaign + meta vertical slice 0.0.31

## 1. 현재 제품 뼈대

- Web PC/모바일 횡스크롤 소환 전략.
- `packages/sim` 30Hz 결정론적 전투 코어.
- 전투 핵심: 보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰.
- 현재 과금/에너지/FOMO 없음.
- 신규 계정: 징집병 1종 + ST1만 개방.
- 전투 콘텐츠: PROGRESSION20 + SPECIAL5 = 25전투.
- 캐릭터 전투 정의: 무료 캠페인10 + 첫 모집 전용15 = 현재 25종.

## 2. 전투 / 입력

- 이동, 탐지, foreswing/hitFrame/backswing, 동시 피해, 자연KB, ForcedDisplacement, DYING, 거점 승패, stateHash 구현.
- 보급소 Lv1~8, 생산비, 재생산, 처치 보급, `atTick` 웨이브, 전선포 구현.
- 기본 동시 출격 한도 아군50 / 적50. stage별 cap 지원.
- PC: `1~0` 소환, `Q` 보급소 강화, `E` 전선포, `P/ESC` 솔로 일시정지.
- 정상 실패 입력(쿨/돈 부족/cap/MAX 등)은 화면 흔들림 없음.
- camera shake는 전선포 성공 / 강한 유닛 피격 / 거점 피격 세 실제 충격 경로만.

## 3. PC / 모바일

- viewport 권위 `apps/client/src/viewport.ts`.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC 창은 PC UI 유지.
- 세로 모바일 가드는 coarse pointer + width≤900 + portrait.
- safe-area 적용.
- compact 핵심 터치 높이 84 logical px.
- 모바일은 1~0/Q/E 표시를 숨기고 PC는 유지.
- `antialias:true / pixelArt:false / roundPixels:false`.

## 4. 제1장 / SPECIAL

### PROGRESSION

- 제1장20, 난이도1~9.
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
- 첫 클리어 보물20은 100% 확정.
- ST20 현재 보스 페이싱: 황금가면50초 / 철문장군80초.

### SPECIAL

- `special-01` 세 자리 전선 · 난이도6 · 실효3기.
- `special-02` 광란의 짧은 길 · 난이도7 · 650m 러시.
- `special-03` 유리봉 저격선 · 난이도8 · 1500m 저격전.
- `special-04` 삼인 결사대 · 난이도9 · 실효3기 + 철문장군50초.
- `special-05` 가면과 철문 · 난이도10 · 황금가면35초 → 철문장군70초.
- 제1장 완료 후 5개 동시 개방, SPECIAL끼리 순차 잠금 없음.
- SPECIAL 기록은 메인 진도와 별도 저장.
- SPECIAL 훈장5는 전투 스탯 효과 없는 컬렉션.
- `special-baseline.ts/test.ts`가 5개 실제 승리/cap/필수 보스 관측을 요구하지만 최신 환경에서 실행 결과는 아직 확보 전.

## 5. 대규모 출정 구조

정본 흐름:

`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

- PROGRESSION/SPECIAL이 공용 StageSelect 사용.
- 옛 `special-select` 중복 Scene 제거.
- Collection 데이터: `content/stage-collections.json`.
- 모든 playable stage는 정확히 하나의 Collection에 속해야 함.
- Collection 해금은 숫자 clear count가 아니라 의미 있는 `unlockAfterStageId` 사용.
- 첫 SPECIAL 묶음은 `border-20` 클리어가 해금 앵커.
- `STAGE_COLLECTIONS_PER_PAGE=2`, Collection page helper 구현.
- `STAGES_PER_COLLECTION_PAGE=5`, 내부 stage page helper 및 stage→page 역산 helper 구현.
- **현재 StageHubScene은 아직 3+ Collection 실제 좌우 paging UI에 helper를 연결하지 않음.** 현재 Collection2개라 표시 문제는 없으며 세 번째 추가 전 연결 필요.
- `isSortieStageUnlocked()`를 추가해 SPECIAL 입장 해금을 자기 Collection 조건에서 계산할 수 있게 했지만 `main.ts` 실제 입장 경로는 아직 옛 helper 사용. 다음 안전한 `main.ts` 수정에서 통일 필요.

## 6. 모집 / 희귀도 — 0.0.31 신규

정밀 정본: `docs/GROWTH_RECRUITMENT_DESIGN.md`.

### 희귀도

- C / B / A / S / SS.
- X는 필요 시 희귀도가 아니라 변칙 태그.
- 희귀도는 절대 성능 순위가 아니며 낮은 희귀도도 비용/재생산/사거리/전문화로 사용 가치를 유지해야 함.

### 첫 모집 풀

- 기본 무료10종은 모집 풀에서 제외.
- `content/units/recruitment-01.json`에 **모집 전용15종** 추가.
- 구성: C4 / B4 / A3 / S2 / SS2.
- `prototype.ts`:
  - `PLAYER_SLOTS` = 무료 캠페인10 유지.
  - `RECRUITMENT_PLAYER_SLOTS` = 모집15.
  - `ALL_PLAYER_SLOTS` = 총25.
- `createPrototypeBattle()`는 소유/편성 ID를 넘기면 모집 캐릭터도 실제 전투 슬롯으로 사용 가능.
- 캠페인 `getUnlockedSlotIds()`는 모집 캐릭터를 자동 해금하지 않음.

### 첫 배너

`content/recruitment/banner-01.json`:

- C 30%
- B 28%
- A 24%
- S 13%
- SS 5%
- 10연 A+ 보장
- 30연 S+ 보장
- 60연 픽업 SS 보장
- 100연 배너 캐릭터 직접 선택권 +1
- 현재 픽업 SS: `moon-eater`.

`apps/client/src/recruitment.ts`:

- 확률/풀/보장을 JSON에서 파싱하고 합계100% 검증.
- 일반 roll은 rarity 확률 → 해당 rarity pool 순서.
- A+/S+ 보장은 최소 희귀도를 올리되 그 이상 희귀도 간 원래 비율을 유지.
- 60회 milestone은 하위 10/30 보장보다 우선해 픽업 SS 지급.
- 100회 milestone은 랜덤 결과를 바꾸지 않고 별도 선택권 적립.
- 실제 플레이용 난수는 `crypto.getRandomValues()` 기반 rejection sampling.
- 테스트는 결정론적 RNG 주입 가능.
- 신규/중복 판정 구현.
- **중복 조각 지급량/교환비는 아직 정본 수치 미확정이라 임의 숫자를 넣지 않음.**

### 모집 저장

- guest save schema **v4**.
- v2/v3 → v4 마이그레이션.
- `ownedRecruitmentCharacterIds` 저장.
- `recruitmentProgressByBanner`에 배너별 totalPulls / selectionCredits 저장.
- durable/session 병합에서 pull count를 합산하지 않고 더 진행된 쪽 사용.
- 같은 pull count일 때 소비한 100연 선택권이 부활하지 않도록 더 낮은 selectionCredits를 보존.
- `performGuestRecruitment()` / `redeemGuestBannerSelection()`이 session 즉시 반영 후 IndexedDB 지속 여부를 별도 보고.
- **모집 UI는 아직 미구현.**

## 7. 캐릭터 레벨 / 업그레이드 — 0.0.31 신규

`content/growth/level-curve-01.json` + `apps/client/src/character-growth.ts`.

- Lv1~50.
- 현재 곡선은 명시적으로 `PROTOTYPE_BALANCE` 상태.
- Lv1 배율1000‰.
- Lv1~30: 레벨당 HP/공격 +15‰.
- Lv31~50: 레벨당 HP/공격 +8‰.
- Lv30 = 1435‰, Lv50 = 1595‰.
- 레벨로 변하는 것은 현재 HP/기본공격력만.
- 사거리/공격범위/비용/재생산/이동/KB 등 정체성 값은 레벨로 변경하지 않음.
- `applyCharacterLevel()` / `buildCharacterCombatSlot()` 실제 전투 슬롯 파생 구현.
- **강화 골드 비용/보상경제/성장 UI/레벨 저장은 아직 미구현.** 정확 비용은 전체 메타 경제와 함께 확정해야 함.

## 8. 3-form 진화 — 0.0.31 신규

정본 철학:

- 기본/2형태/3형태.
- 이전 형태 재선택 가능.
- form 간 소유권/레벨 공유.
- 무조건 상위호환보다 sidegrade/전문화 허용.
- 색놀이 진화 금지.

현재 `content/evolution/recruitment-01.json`에서 C/B/A/S/SS 대표 5명에 실제 3-form 데이터 추가:

- C 순무기수
- B 등불마녀
- A 태엽오리기사
- S 거울퇴마사
- SS 달먹는룡

`character-growth.ts`에서 form이 실제로 다음 전투값을 바꿀 수 있음:

- HP/공격
- 비용/재생산
- 이동속도
- standingRange / 공격 min/max
- SINGLE/AREA
- 전문 damage bonus

예시:

- 순무기수: 값싼 물량형 ↔ 고비용 AREA 돌격형.
- 태엽오리기사: 느린 방벽형 ↔ 빠른 고화력 돌격형.
- 거울퇴마사: 초장거리 ARCANE 특효 ↔ 사거리 감소 BOSS 견제형.
- 달먹는룡: 극장거리 보스저격 ↔ 근접한 고화력 보스압박.

테스트는 form1 복귀, 3형태 순서, sidegrade 차이, 레벨+form 결정론적 합성을 검사.

**아직 미구현:**

- form2/3 실제 해금 조건.
- 진화 재료/비용.
- form 해금/선택 저장.
- 성장 UI.
- form별 정식 전용 아트/애니/VFX.
- 나머지20 캐릭터의 3-form 데이터.

## 9. 아트

- 현재 프로토타입 아트 패밀리7개.
- 무료10/적10 기존 매핑 유지.
- 모집15종도 모두 명시적 `UNIT_ART` 매핑을 가지며 6개 이상 패밀리에 분산.
- 이것은 **정식 모집 캐릭터 아트가 아니라 프로토타입 식별용 임시 매핑**이다.
- 정식 수집/진화 캐릭터는 장기적으로 고유 실루엣·종족·장비·모션·VFX가 필요.

## 10. 저장 / 보상

- main progression과 SPECIAL 저장축 분리.
- 제1장 보물은 첫 클리어100%.
- 모집 소유권/천장은 v4 저장.
- 영구 저장 실패 시 same-tab session은 유지하되 persisted=false를 UI에 전달.
- 아직 레벨/form/조각/재화/수동 덱 저장은 미구현.

## 11. 협동 정본

- 2인 각5칸, 팀 전체10.
- 개인 보급/보급소/생산 쿨다운.
- 공유 거점HP/승패/거점 병기.
- `협동 권장` 태그 금지.
- 필요 시 적 최대HP/공격력/거점HP만 보정.
- 이동속도/주기/사거리/KB/스폰/적 수/웨이브/패턴/AI는 협동 때문에 변경하지 않음.

## 12. 현재 검증 한계

- `.github/workflows/ci.yml`은 main push/PR에 install → typecheck → test → build 설정.
- 현재 연결에서는 direct-main Actions run 결과를 조회하지 못하고 combined status도 비어 있음.
- 로컬 컨테이너는 GitHub DNS가 해석되지 않아 최신 main clone/npm 실행 불가.
- 따라서 0.0.31 신규 모집/성장 테스트와 SPECIAL baseline의 **실제 실행 green을 아직 주장하지 않는다.**
- 일회성 workflow 우회는 실행되지 않아 즉시 제거했으며 `.github/workflows/`에는 `ci.yml`만 유지.

## 13. 다음 우선순위

1. 0.0.31 신규 recruitment/growth/save 테스트 실제 실행 경로 확보 후 typecheck/test/build 확인.
2. 모집 화면: 메인 `모집` → 배너 → 1회/10회 → 결과 → 소유권/천장 표시.
3. 성장 화면: 보유 캐릭터 → Lv/현재 form → 강화/진화 비교.
4. 레벨/진화 저장 + 메타 재화/강화 비용/진화 재료 정본화.
5. 보유 무료+모집 캐릭터를 사용하는 수동 10칸 덱.
6. 실제 BattleScene이 저장된 레벨/form/덱을 사용하도록 연결.
7. StageHub 실제 2 Collection/page UI와 StageSelect 공용 paging helper 연결.
8. SPECIAL5 deterministic clearability 실행 검증.
9. 정식 모집/진화 아트 파이프라인.
10. PC/가로 모바일 실렌더 및 Cloudflare Pages 배포 확인.

첫 사용자 테스트 게이트는 최신 실행 검증과 실제 렌더 감사를 통과하기 전까지 열지 않는다.
