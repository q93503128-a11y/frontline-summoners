# Frontline Summoners 새 채팅 인수인계 프롬프트

전선소환전 / Frontline Summoners 개발을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **먼저 현재 GitHub `main`을 직접 확인**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

## 1. 작업 전 권위 순서

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 정밀 문서
   - 스테이지/특수/협동/출정: `docs/STAGE_SYSTEM_DESIGN.md`
   - 모집/희귀도/중복/레벨/진화: `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/IMPLEMENTATION_STATUS.md`
5. `docs/DEVELOPMENT_RULES.md`
6. `docs/INDEX.md`
7. 관련 `content/*.json`
8. 실제 코드/테스트

문서·content·코드·테스트가 다르면 함께 맞춘다. 테스트 때문에 폐기한 옛 경로를 되살리지 않는다.

## 2. 제품 핵심

- Web PC/모바일 횡스크롤 소환 전략.
- 30Hz 결정론적 공용 sim.
- 전투 루프: `보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰`.
- 싱글만으로 완전한 게임. 이후 2인 협동 → 1v1 → 2v2.
- 과금/에너지/FOMO/필수 RNG 보물작/중복 강제 성장 금지.
- 캐릭터 액티브 버튼 남발 금지. 직접 개입은 소환·보급소·거점 병기 중심.

## 3. 현재 콘텐츠

### 전투

- PROGRESSION20 + SPECIAL5 = 25전투.
- 신규 계정 징집병1 + ST1만 개방.
- 제1장 무료 로스터10:
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
- SPECIAL5는 제1장 완료 후 동시 개방.
- SPECIAL 보스: special-04 철문장군50초, special-05 황금가면35초/철문장군70초.

### 캐릭터

현재 전투 정의 총25종:
- 무료 캠페인10.
- 첫 모집 전용15.

모집 전용15은 `content/units/recruitment-01.json`.
구성: C4 / B4 / A3 / S2 / SS2.
기본10은 모집 풀에 넣지 않는다.

## 4. 모집 / 희귀도 — 0.0.31

정밀 정본: `docs/GROWTH_RECRUITMENT_DESIGN.md`.

희귀도:
- C / B / A / S / SS.
- X는 필요 시 변칙 태그이지 희귀도 아님.

첫 배너 `content/recruitment/banner-01.json`:
- C30%
- B28%
- A24%
- S13%
- SS5%
- 10연 A+ 최소1
- 30연 S+ 최소1
- 60연 픽업 SS 보장
- 100연 배너 캐릭터 직접 선택권 +1
- 현재 픽업 SS: `moon-eater`.

`apps/client/src/recruitment.ts`:
- JSON 확률/풀 검증.
- A+/S+ 보장은 최소 희귀도만 올리고 그 이상 희귀도끼리 원래 확률비 유지.
- 60 보장이 10/30보다 우선.
- 100은 랜덤 결과를 교체하지 않고 selection credit 적립.
- `crypto.getRandomValues()` 기반 실제 RNG + 테스트용 RNG 주입.
- 신규/중복 판정.
- `redeemBannerSelection()`.

중복 방향:
- 캐릭터 조각 + 공용 성장재화.
- 조각 교환으로 원하는 캐릭터 직접 선택 가능.
- 중복 필수 성장 금지.
- **조각 지급량/교환비는 아직 정본 수치 미확정. 임의 숫자 추가 금지.**

## 5. 모집 저장

`apps/client/src/save.ts`, guest schema v4:
- v2/v3 마이그레이션.
- `ownedRecruitmentCharacterIds`.
- `recruitmentProgressByBanner` = totalPulls + selectionCredits.
- session/durable 병합에서 pull count를 합산하지 않는다.
- 같은 pull count면 이미 소비된 선택권이 부활하지 않도록 더 낮은 credits를 보존.
- `performGuestRecruitment()` / `redeemGuestBannerSelection()`.

**모집 화면은 아직 미구현.**

## 6. 캐릭터 레벨 / 업그레이드

`content/growth/level-curve-01.json` + `apps/client/src/character-growth.ts`.

- Lv1~50.
- 현재 곡선 상태 `PROTOTYPE_BALANCE`.
- Lv1=1000‰.
- Lv1~30: 레벨당 HP/공격 +15‰.
- Lv31~50: 레벨당 HP/공격 +8‰.
- Lv30=1435‰, Lv50=1595‰.
- 레벨은 현재 HP/기본공격만 바꾼다.
- 사거리/비용/재생산/이속/KB 등 정체성 값은 레벨로 바꾸지 않는다.
- `applyCharacterLevel()` / `buildCharacterCombatSlot()` 구현.

아직 미구현:
- 강화 골드 비용.
- 레벨 저장.
- 성장 UI.
- 보상경제.

정확 강화 비용은 임의로 만들지 말고 전체 메타 경제와 함께 정본화한다.

## 7. 3-form 진화

정본:
- 기본 / 2형태 / 3형태.
- 이전 형태 재선택 가능.
- form 간 소유권/레벨 공유.
- 무조건 상위호환보다 sidegrade/전문화 허용.
- 색놀이 진화 금지.

현재 `content/evolution/recruitment-01.json`에서 대표5명(C/B/A/S/SS 각각1명) 실제 3-form 데이터 구현:
- 순무기수
- 등불마녀
- 태엽오리기사
- 거울퇴마사
- 달먹는룡

form이 실제 변경 가능한 값:
- HP/공격
- 비용/재생산
- 이동속도
- standingRange / attack min/max
- SINGLE/AREA
- 전문 damage bonus

`character-growth.ts`의 `applyEvolutionForm()` / `buildCharacterCombatSlot()`이 실제 전투 슬롯을 파생한다.

아직 미구현:
- form2/3 해금 조건.
- 진화 재료/비용.
- form 해금/선택 저장.
- 성장/진화 UI.
- 나머지20 캐릭터 form 데이터.
- 정식 form별 전용 아트/애니/VFX.

해금 레벨/재료 숫자는 과거 정본에 없었으므로 임의로 20/40 같은 숫자를 넣지 않는다.

## 8. 전투 어댑터 / 아트

`prototype.ts`:
- `PLAYER_SLOTS` = 무료 캠페인10 유지.
- `RECRUITMENT_PLAYER_SLOTS` = 모집15.
- `ALL_PLAYER_SLOTS` = 25.
- `getUnlockedSlotIds()`는 모집 캐릭터를 자동 해금하지 않는다.
- `createPrototypeBattle()`는 소유/편성 ID를 넘기면 모집 캐릭터도 전투 슬롯으로 사용 가능.

`assets.ts`:
- 모집15 모두 명시적 prototype `UNIT_ART` 매핑.
- 6개 이상 기존 art family에 분산.
- 이것은 최종 캐릭터 아트가 아니며 정식 수집 캐릭터는 고유 실루엣/종족/장비/모션/VFX 필요.

## 9. 대규모 출정 계층

정본:
`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

- PROGRESSION/SPECIAL 공용 StageSelect.
- 옛 `special-select` 제거.
- Collection content는 `content/stage-collections.json`.
- SPECIAL collection unlock은 `unlockAfterStageId: "border-20"`.
- 숫자 `requiredProgressionClears:20`을 content 정본으로 되살리지 않는다.
- `STAGE_COLLECTIONS_PER_PAGE=2` helper 있음.
- `STAGES_PER_COLLECTION_PAGE=5` helper 있음.
- stage→collection page 역산 helper 있음.

아직 미완료:
- StageHub 실제 3+ Collection 좌우 paging UI.
- StageSelect가 공용 stage-page helper를 직접 소비하도록 통일.
- 결과 복귀 시 정확한 내부 page 복원.
- `isSortieStageUnlocked()`를 실제 main.ts 입장 경로에 연결.

## 10. 저장 / 진행

- 제1장 progression과 SPECIAL 저장축 분리.
- 메인 진도는 ST1부터 contiguous prefix가 권위.
- 제1장 보물20 첫 클리어100%.
- SPECIAL 훈장5는 능력치 없는 완료 기록.
- 모집 ownership/pity는 v4 저장.
- 영구 저장 실패를 성공으로 거짓 표시하지 않는다.

## 11. 입력 / 모바일

- PC `1~0` 소환, `Q` 보급소, `E` 전선포, `P/ESC` 일시정지.
- 정상 실패 입력 shake 없음.
- shake는 전선포 성공/강한 피격/거점 피격만.
- viewport 권위 `viewport.ts`.
- compact = coarse pointer + 짧은 변≤540.
- 모바일 핵심 터치84 logical px.
- safe-area 유지.

## 12. 협동

- 2인 각5칸, 팀10.
- 개인 보급/보급소/쿨다운.
- 공유 거점HP/승패/거점 병기.
- `협동 권장` 태그 금지.
- 필요 시 적 HP/공격/적 거점HP만 보정.
- 속도/주기/사거리/KB/스폰/적 수/웨이브/패턴/AI를 협동 때문에 바꾸지 않는다.

## 13. 검증 한계

- 로컬 컨테이너는 github.com DNS 문제로 최신 main clone/npm 실행 불가.
- direct-main Actions 결과를 현재 연결에서 확인하지 못하고 combined status도 비어 있음.
- 따라서 최신 recruitment/growth/save 테스트와 SPECIAL baseline의 실제 green을 아직 주장하지 않는다.
- 임시 Actions workflow를 쌓지 않는다. `.github/workflows`에는 `ci.yml`만 유지.

## 14. 다음 우선순위

1. 최신 recruitment/growth/save + SPECIAL tests 실제 typecheck/test/build 실행 확인.
2. 메인에 실제 `모집` 화면 연결: 배너 → 1회/10회 → 결과 → 소유/천장/선택권.
3. 성장 화면: 보유 캐릭터 → Lv/현재 form → 강화/진화 비교.
4. 레벨/form 저장 + 강화 재화/비용/진화 재료 정본화.
5. 무료+모집 보유 캐릭터 기반 수동10칸 덱.
6. BattleScene이 저장된 덱/레벨/form을 실제 사용하도록 연결.
7. StageHub/StageSelect paging UI 마무리.
8. SPECIAL5 deterministic 실행 검증.
9. 모집/진화 정식 고유 아트 파이프라인.
10. PC/가로 모바일 실렌더 + Pages 배포 확인.

첫 사용자 테스트 요청은 최신 실행검증과 실렌더 감사가 끝난 뒤에만 한다.
