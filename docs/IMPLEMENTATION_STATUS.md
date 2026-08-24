# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 전체 방향은 `docs/GAME_DESIGN_FULL.md`, 스테이지·특수·협동 세부는 `docs/STAGE_SYSTEM_DESIGN.md`, 개발 방식은 `docs/DEVELOPMENT_RULES.md`와 대조한다.

## 2026-08-24 — campaign vertical slice 0.0.29

## 1. 문서 정본

- `docs/CANONICAL.md`: v0.31, 최신 핵심 결정 정본.
- `docs/GAME_DESIGN_FULL.md`: 통합 전체 기획서.
- `docs/STAGE_SYSTEM_DESIGN.md`: 복원된 스테이지 DSL, 진도/특수 분리, 출격 제한, 협동 규칙과 **대규모 스테이지용 출정 계층**까지 기록하는 상세 정본 보조 문서.
- `docs/IMPLEMENTATION_STATUS.md`: 현재 구현/미구현만 기록.
- `docs/DEVELOPMENT_RULES.md`: 레거시 덧씌우기 금지, 중복 경로 제거, 권위 경로 단일화.
- 구체 콘텐츠 수치는 `content/` JSON이 우선한다.

## 2. 현재 전투 코어

- `packages/sim` 공유 30Hz 결정론적 코어.
- 이동, 탐지, foreswing/hitFrame/backswing, 동시 피해, 자연 KB, ForcedDisplacement, DYING, 거점 승패, stateHash 구현.
- 보급, 보급소 Lv1~8, 생산비, 재생산 쿨다운, 적 웨이브, 처치 보급, 전선포 구현.
- 기본 동시 출격 한도 아군50 / 적50.
- `stage.playerUnitCap → 보물 보정 → simulation`, `stage.enemyUnitCap → simulation` 단일 경로.
- 소환/강화/전선포의 정상 실패 입력은 화면을 흔들지 않는다.
- camera shake는 전선포 성공, 강한 유닛 피격, 거점 피격 세 실제 충격 경로만 유지.

## 3. 출정 / 스테이지 탐색 구조 — 0.0.29

스테이지가 수십~수백 개로 늘어나는 것을 전제로 기존 `메인 → 바로 제1장 목록` 구조를 폐기하고 계층형 탐색을 도입했다.

현재 실제 흐름:

`메인 → 출정 허브(StageHubScene) → Collection → 공용 StageSelectScene → 전투 → 결과 → 원래 Collection`

### 구현 완료

- 메인 `출정` 버튼은 이제 `stage-hub`로 진입한다.
- `StageHubScene`이 Collection 단위 카드로 진도/특수 콘텐츠를 먼저 보여준다.
- 기존 `SpecialStageSelectScene / special-select` 전용 경로를 제거했다.
- PROGRESSION과 SPECIAL 모두 **하나의 `StageSelectScene`**을 사용한다.
- `StageSelectScene`은 `collectionId`를 받아 해당 Collection의 stage만 표시한다.
- 진도 카드는 확정 보물/동료 보상을, 특수 카드는 출격 제한/훈장을 같은 공용 렌더 경로 안에서 분기한다.
- 한 Collection 안의 스테이지는 현재 5개씩 페이지 이동한다.
- 결과 화면은 `getStageCollectionForStage(stageId)`로 출처를 찾아 `스테이지` 버튼을 누르면 정확한 원래 Collection 목록으로 돌아간다.
- 잠긴 stage를 잘못 직접 진입하면 출정 허브로 복귀한다.
- PC/compact 모바일 정보 밀도 분리는 새 출정 구조에서도 유지한다.

### Collection 데이터 경로

- 새 `content/stage-collections.json`이 Collection의 ID, 종류, 제목, 설명, 포함 stage ID, 진도 해금 조건을 가진다.
- `apps/client/src/stage-navigation.ts`가 해당 JSON을 실제 `ALL_STAGES`와 연결한다.
- 모든 플레이 가능 stage가 정확히 하나의 Collection에 속해야 한다.
- 존재하지 않는 stage 참조, PROGRESSION/SPECIAL 타입 혼합, Collection ID 중복, stage 중복 배정을 런타임 검증에서 거부한다.
- 현재 Collection:
  - `chapter-01`: 제1장 진도 20개.
  - `special-border-01`: 제1장 완료 후 열리는 SPECIAL 5개.
- 새 장/외전/이벤트 묶음을 추가할 때 선택 Scene을 복제하는 방향이 아니라 Collection 데이터 확장을 기본으로 한다.

### Collection 허브 페이징

- `STAGE_COLLECTIONS_PER_PAGE = 2`.
- `getStageCollectionPageCount()` / `getStageCollectionPage()` 순수 helper 구현.
- 미래 Collection 5개를 가정한 테스트에서 2/2/1 페이지 분할 및 범위 clamp를 검사한다.
- **중요: 현재 `StageHubScene` 화면은 아직 이 helper를 소비하지 않고 현재 2개 Collection을 직접 한 화면에 렌더한다.** 현재 콘텐츠에서는 정상이나 세 번째 Collection을 추가하기 전에 반드시 허브의 이전/다음 버튼과 page indicator를 이 helper에 연결해야 한다.
- 따라서 “허브가 이미 수십 Collection을 실제 화면에서 페이지 처리한다”고 주장하지 않는다.

## 4. 냥코 분석에서 적용한 UI 원칙

- 메인에 개별 스테이지를 대량 나열하지 않고 전투 진입점 `출정`을 먼저 크게 둔다.
- 출정 후 장/맵 성격의 Collection을 고른 다음 내부 stage로 내려간다.
- 전투가 끝나면 사용자가 어느 콘텐츠 묶음에 있었는지 잃지 않고 원래 목록으로 돌아간다.
- 이 계층과 정보 우선순위만 참고하며 냥코의 UI 아트·아이콘·정확한 배치·문구·에너지/과금 구조는 복제하지 않는다.
- 전선소환전의 PROGRESSION/SPECIAL 별도 저장, 1~12 난이도, 확정 보물, 출격 제한, 향후 협동 규칙은 그대로 유지한다.

## 5. 제1장 / SPECIAL 콘텐츠

### 진도

- 제1장 PROGRESSION 20개.
- 제1장 진도 난이도 1~9, ST20=9.
- 신규 계정 징집병 1종 + ST1만 개방.
- 합류: ST1 방벽기사 → ST2 수렵창병 → ST4 결투검사 → ST6 청창대 → ST8 전투마도사 → ST10 화염술사 → ST13 왕실기사 → ST16 이단주술사 → ST20 공허현자.
- 7개 전장 계열, ST19/ST20 보스 랜드마크.

### 첫 SPECIAL 팩

`content/stages/special-01.json` 5개:

1. **세 자리 전선** · 난이도6 · 실효 아군 3기 제한.
2. **광란의 짧은 길** · 난이도7 · 650m 러시.
3. **유리봉 저격선** · 난이도8 · 1500m 장거리 방패/저격전.
4. **삼인 결사대** · 난이도9 · 실효 3기 제한 + 철문장군.
5. **가면과 철문** · 난이도10 · 황금가면 → 철문장군 연속 보스.

- 제1장 완료 시 5개 동시 개방, SPECIAL끼리 순차 잠금 없음.
- 첫 팩은 현재 구현된 `atTick`, 맵, 경제, unit cap, 기존 적/보스만 사용한다.
- 미구현 편성 제한 evaluator/복합 trigger/생존 규칙을 설명만 붙여 가짜로 사용하지 않는다.
- `세 자리 전선`/`삼인 결사대` JSON cap=2 + 제1장 확정 배치한도 보물 +1 → 실효3.
- 훈장은 전투 스탯 효과 없는 SPECIAL 완료 기록이며 도감 별도 탭.

### 0.0.29 보스 타이밍 수정

보스전이 보스 등장 전에 적 거점 파괴로 끝날 위험을 줄이기 위해 보스 능력치를 깎지 않고 등장 시점을 앞당겼다.

- `삼인 결사대`: 철문장군 tick2400(80초) → **tick1500(50초)**.
- `가면과 철문`: 황금가면 tick1350(45초) → **tick1050(35초)**.
- `가면과 철문`: 철문장군 tick2850(95초) → **tick2100(70초)**.
- 웨이브 배열은 다시 시간순으로 정렬했다.
- `special-stages.test.ts`가 이 시점을 회귀 고정한다.
- 실제 deterministic 클리어 결과는 아직 확보 전이므로 난이도6~10 수치를 최종 밸런스라고 주장하지 않는다.

## 6. 난이도 / 스테이지 DSL

- 난이도 정본 1~12.
- `협동 권장` 태그 없음.
- schema: `stageType`, `playerUnitCap`, `enemyUnitCap`, `formationRestrictions`, `specialRules`.
- 편성 제한 schema는 희귀도/역할/비용/태그/최대 종류/동일 세력 등을 표현 가능하지만 실제 UI enforcement는 아직 미구현.
- `specialRules` registry 미구현.
- 실제 wave runtime은 `atTick` 기반.
- 거점HP, 특정 적 사망, 누적 처치/사망, 페이즈, AND/OR 복합 trigger evaluator는 아직 미구현.

## 7. 저장 / 보상

- 저장 schema v3.
- `clearedStageIds` = PROGRESSION 전용.
- `specialClearedStageIds` = SPECIAL 전용.
- 제1장 20 보물은 첫 클리어 100% 확정, 반복 RNG 파밍 없음.
- SPECIAL 5 훈장은 별도 완료 기록이며 전투 능력치 없음.
- 기존 v2 저장은 v3으로 마이그레이션해 진도/보물을 보존한다.
- ST1부터 연속 clear prefix가 메인 진도 권위.
- durable/session은 각각 정규화 후 병합.
- 영구 저장 실패를 성공으로 거짓 표시하지 않는다.

## 8. 협동 정본

- 2인: 각 5칸, 팀 전체10.
- 개인 보급/보급소/생산 쿨다운.
- 공유 거점HP/승패/거점 병기.
- 협동은 싱글보다 실질적으로 수월할 수 있지만 `협동 권장` UI 금지.
- 필요 시 적 최대HP / 공격력 / 적 거점HP만 단순 보정.
- 이동속도, 공격주기, 사거리, KB, 스폰, 적 수, 웨이브, 패턴, AI는 협동 때문에 바꾸지 않는다.
- solo/coop stage 복제 금지.

## 9. PC / 모바일

- viewport 판정 권위 `apps/client/src/viewport.ts`.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC 창은 모바일로 오인하지 않는다.
- 모바일 세로 차단 = coarse pointer + width≤900 + portrait.
- PC: 1~0 소환, Q 보급소, E 전선포, P/ESC 일시정지와 상세 텍스트 유지.
- 모바일: 키보드 표기를 숨기고 84 logical px 핵심 터치 영역 사용.
- safe-area containment 유지.

## 10. 제1장 경제 / 후반 baseline

- Lv1 12/s max1000.
- Lv2 20/s max1400 cost160.
- Lv3 30/s max1900 cost260.
- Lv4 42/s max2500 cost390.
- Lv5 56/s max3200 cost560.
- Lv6 72/s max4000 cost760.
- Lv7 90/s max5000 cost1000.
- Lv8 110/s max6200 cost1300.
- ST1 시작50, ST8 160, ST19 280, ST20 300.
- ST20: 방패15초, 광전사33.3초, 황금가면50초, 저격60초, 철문장군80초.
- 소스 충실 독립 재현 기준 ST1~20 합법 baseline 통과 및 ST19/20 필수 보스 실제 등장 확인.
- 이것은 현재 HEAD 실제 `npm test` green 주장과 별개다.

## 11. 콘텐츠 / 메타

- 플레이어10, 일반 적8 + 보스2.
- 현재 전투 데이터 **진도20 + SPECIAL5 = 25개**.
- 도감: 동료10 / 보물20 / 훈장5.
- 현재 10종은 전체 캐릭터 상한이 아닌 기본 로스터.
- 레벨/강화/진화, 본격 모집, 대형 캐릭터 풀, 10칸 수동 편성은 후속.
- 진화는 색놀이/숫자만 상승이 아니라 실루엣·장비·모션·VFX·공격 방식이 실제 변화해야 한다.

## 12. 회귀 테스트

- `stage-navigation.test.ts`: Collection 분리, 연속 진도 unlock, 축별 진행도, 2개 단위 page helper를 미래 5개 Collection 가정으로 검사.
- `battle-ui-wiring.test.ts`: 메인→출정 허브→공용 stage list→battle→collection 복귀, 옛 `special-select` 부재, PC/모바일/입력/shake 회귀.
- `special-stages.test.ts`: 20/5 분리, SPECIAL unlock, 서로 다른 전장 문법, cap 적용, 보스 순서/타이밍.
- `save-progress.test.ts`: v2→v3, 진도/SPECIAL 저장 분리.
- `catalog-boss-mobile-ui.test.ts`: 동료/보물/훈장 분리, 모바일/보스 회귀.
- 기존 전투/경제/진도 테스트 유지.

## 13. 검증 상태 / 한계

- 현재 로컬 컨테이너는 `github.com` DNS가 해석되지 않아 최신 main을 clone해 실제 npm 실행할 수 없다.
- direct-main GitHub Actions 결과도 현재 연결 경로에서 확인하지 못한다.
- 따라서 현재 HEAD의 install/typecheck/test/build green을 주장하지 않는다.
- 첫 SPECIAL 5개 deterministic clearability도 실제 실행 결과 미확인.
- 신규 출정 허브의 실제 PC/가로 모바일 렌더 시각 확인도 남아 있다.

## 14. 첫 사용자 테스트 전 남은 항목

1. **StageHubScene에 이미 구현한 2개 단위 Collection page helper를 실제 이전/다음 버튼 및 page indicator로 연결.** 세 번째 Collection 추가 전 필수.
2. 현재 HEAD의 install → typecheck → test → build 실제 확인.
3. 첫 SPECIAL 5개 deterministic clearability 및 두 보스전의 필수 보스 실제 출현 확인.
4. 메인→출정 허브→Collection→스테이지→전투→결과 복귀 흐름을 PC/compact 모바일 실제 렌더에서 확인.
5. Cloudflare Pages 실제 프로젝트 URL/최신 배포 상태 확인.
6. 위 게이트를 확인한 뒤에만 사용자에게 테스트 요청.

## 15. 다음 큰 단계

- 허브 Collection paging 실제 UI 연결.
- SPECIAL 5 밸런스 검증/조정.
- 구현된 규칙만 사용하는 추가 SPECIAL 확대.
- 제2장 이상 진도 Collection 추가.
- 캐릭터 성장/진화/모집/수동 편성.
- 편성 제한 evaluator, specialRules registry, 복합 trigger DSL 이후 제한전/생존전 확장.
- 2인 협동 → 1v1 → 2v2.

## 16. 개발 원칙

- GitHub `main` 정본.
- 작업 전 `CANONICAL → GAME_DESIGN_FULL → STAGE_SYSTEM_DESIGN → IMPLEMENTATION_STATUS → 관련 content → 코드/테스트` 확인.
- 새 코드를 옛 hotfix/override 위에 덧씌우지 않는다.
- 대체한 화면/함수/테스트는 옛 경로를 남기지 않는다.
- 미구현 기능을 UI 문구만으로 구현된 것처럼 가장하지 않는다.
- 같은 책임은 하나의 권위 경로만 남긴다.
- 문서·content·코드·테스트를 함께 맞춘다.
