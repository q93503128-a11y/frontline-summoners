# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 작업 전 `CANONICAL → GAME_DESIGN_FULL → STAGE_SYSTEM_DESIGN → IMPLEMENTATION_STATUS → DEVELOPMENT_RULES → content → 코드/테스트` 순서로 대조한다.

## 2026-08-24 — campaign vertical slice 0.0.30

## 1. 현재 제품 뼈대

- Web PC/모바일 횡스크롤 소환 전략 게임.
- `packages/sim` 30Hz 결정론적 전투 코어를 브라우저 전투가 사용한다.
- 핵심 루프: 보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰.
- 현재 과금/에너지/FOMO 없음.
- 신규 계정은 징집병 1종 + ST1만 개방.
- 제1장 PROGRESSION 20개 + 첫 SPECIAL 5개 = 현재 데이터 기준 총 25전투.

## 2. 전투 / 입력

- 이동, 탐지, foreswing/hitFrame/backswing, 동시 피해, 자연 KB, ForcedDisplacement, DYING, 거점 승패, stateHash 구현.
- 보급소 Lv1~8, 생산비, 재생산 쿨다운, 처치 보급, `atTick` 적 웨이브, 전선포 구현.
- 기본 동시 출격 한도: 아군50 / 적50.
- `stage.playerUnitCap → 보물 보정 → simulation`, `stage.enemyUnitCap → simulation` 단일 경로.
- PC `1~0` = 현재 activeSlots 1~10, `Q` = 보급소 강화, `E` = 전선포, `P/ESC` = 솔로 일시정지.
- 키 반복 허용. 쿨 종료 순간까지 연타/홀드 가능.
- 소환 쿨/보급 부족/unit cap/보급소 실패/MAX/전선포 쿨/잠긴 stage/결과 저장 대기 같은 정상 실패 입력은 화면을 흔들지 않는다.
- camera shake는 전선포 성공 / 강한 유닛 피격 / 거점 피격 세 실제 전투 충격 경로만 허용.

## 3. PC / 모바일 분리

- 공용 게임 데이터/전투 로직 위에 PC 상세 UI와 compact 모바일 UI를 별도 정보 밀도로 렌더한다.
- viewport 판정 권위: `apps/client/src/viewport.ts`.
- compact 모바일 = coarse primary pointer + 짧은 변 540px 이하.
- 작은 마우스 PC 창은 PC UI 유지.
- 세로 모바일 가드 = coarse pointer + width≤900 + portrait.
- safe-area inset 적용.
- compact 핵심 터치 높이는 84 logical px. 390px 높이 FIT 기준 약45.5 CSS px.
- 모바일에서 1~0/Q/E 시각 표시는 숨기고 PC에서는 유지.
- `antialias:true / pixelArt:false / roundPixels:false`.

## 4. 제1장 진도

- PROGRESSION 20개, 난이도 1~9, ST20=9.
- 합류 순서: 시작 징집병 → ST1 방벽기사 → ST2 수렵창병 → ST4 결투검사 → ST6 청창대 → ST8 전투마도사 → ST10 화염술사 → ST13 왕실기사 → ST16 이단주술사 → ST20 공허현자.
- 제1장 보물 20개는 첫 클리어 100% 확정. 반복 RNG 파밍 없음.
- 7개 전장 계열, ST19/ST20 보스 랜드마크.
- ST20 현재: 방패15초, 광전사33.3초, 황금가면50초, 저격60초, 철문장군80초.
- 소스 충실 독립 재현 기준 ST1~20 합법 baseline 통과 및 ST19/20 보스 실제 등장 확인 기록이 있다. 이것은 최신 HEAD의 실제 `npm test` green 주장과는 별개다.

## 5. 경제 정본

- Lv1 12/s · max1000.
- Lv2 20/s · max1400 · 강화160.
- Lv3 30/s · max1900 · 강화260.
- Lv4 42/s · max2500 · 강화390.
- Lv5 56/s · max3200 · 강화560.
- Lv6 72/s · max4000 · 강화760.
- Lv7 90/s · max5000 · 강화1000.
- Lv8 110/s · max6200 · 강화1300.
- ST1 시작 보급50, ST8 160, ST19 280, ST20 300.

## 6. 첫 SPECIAL 5개

`content/stages/special-01.json`:

1. `special-01` 세 자리 전선 · 난이도6 · 실효 아군3기 제한.
2. `special-02` 광란의 짧은 길 · 난이도7 · 650m 러시.
3. `special-03` 유리봉 저격선 · 난이도8 · 1500m 장거리 방패/저격전.
4. `special-04` 삼인 결사대 · 난이도9 · 실효3기 + 철문장군.
5. `special-05` 가면과 철문 · 난이도10 · 황금가면 → 철문장군 연속 보스.

- 제1장 완료 후 5개 동시 개방. SPECIAL끼리 순차 잠금 없음.
- SPECIAL clear는 `specialClearedStageIds`에 별도 저장하고 메인 20진도에 섞지 않는다.
- 훈장은 능력치 보너스 없는 도전 완료 기록이며 도감 별도 탭.
- cap3 두 스테이지의 JSON base cap=2 + 제1장 확정 `PLAYER_UNIT_CAP +1` 보물 = 실제3.
- 보스 타이밍: 삼인 결사대 철문장군50초, 가면과 철문 황금가면35초 / 철문장군70초.
- 보스 HP/공격력은 이 타이밍 조정에서 너프하지 않았다.

### 0.0.30 deterministic SPECIAL gate

- `apps/client/test/special-baseline.ts` 추가.
- ST20 완료 계정의 10종 로스터 + 제1장20 보물을 실제 `createPrototypeBattle()`에 넣는다.
- 실제 보급 수입/강화비/생산비/재생산 쿨/동시 출격 cap/전선포를 지불하며 `stepPlayableBattle()`을 30Hz로 실행하는 SPECIAL 전용 competent baseline이다.
- 저출격 cap에서 싼 유닛으로 먼저 슬롯을 채우지 않고 전열 하나 → 지갑 Lv4 → 실제 적 속성/수/보스에 맞는 후반 유닛을 선택한다.
- `special-baseline.test.ts`는 5개 모두 PLAYER 승리, 적 거점 파괴, 실제 cap 준수, 삼인 결사대 철문장군 관측, 가면과 철문의 황금가면+철문장군 모두 관측을 요구한다.
- **중요: 최신 환경에서 이 새 테스트의 실행 결과는 아직 확보하지 못했다. 따라서 SPECIAL 5개가 통과했다고 주장하지 않는다. 실패 시 콘텐츠 수치/전략 원인을 분리해서 최소 조정한다.**

## 7. 저장 / 진도

- save schema v3.
- `clearedStageIds` = PROGRESSION 전용.
- `specialClearedStageIds` = SPECIAL 전용.
- ST1부터 끊기지 않은 contiguous prefix가 메인 진도 권위.
- 뒤 stage 저장 조각이 다음 진도/동료/보물을 건너뛰어 열지 못한다.
- durable/session 각각 정규화 후 병합.
- `getStage()` strict, progression/special 번호 함수도 각 축에서 strict.
- `recordStageClear()`는 PROGRESSION + 정본 stage↔treasure만 처리.
- `recordSpecialStageClear()`는 SPECIAL만 처리.
- 영구 저장 실패는 현재 탭 진행만 유지하고 UI에서 성공으로 거짓 표시하지 않는다.

## 8. 대규모 스테이지용 출정 구조

정본 흐름:

`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

- 메인 `출정`은 `stage-hub`로 이동한다.
- 기존 `SpecialStageSelectScene / special-select` 중복 경로 제거.
- PROGRESSION/SPECIAL 모두 하나의 `StageSelectScene` 사용.
- 결과 화면은 stage ID에서 원래 Collection을 찾아 그 목록으로 복귀한다.
- Collection 데이터는 `content/stage-collections.json`.
- 현재 `chapter-01`, `special-border-01` 두 Collection.
- 모든 playable stage는 정확히 한 Collection에 속해야 하며 중복/누락/타입 혼합/미등록 stage 참조를 거부한다.

### 0.0.30 Collection 해금 정리

- Collection 데이터에 `requiredProgressionClears:20` 같은 취약한 숫자 해금 조건을 저장하지 않는다.
- SPECIAL 묶음은 `unlockAfterStageId: "border-20"`을 정본으로 사용한다.
- UI용 `requiredProgressionClears=20`은 해당 progression stage의 순번에서 런타임 파생한다.
- scattered save fragment `['border-20']`만으로는 열리지 않고 contiguous progression에 실제 `border-20`이 포함돼야 열린다.

### 페이지 계산 권위

- `STAGE_COLLECTIONS_PER_PAGE = 2`.
- `getStageCollectionPageCount()` / `getStageCollectionPage()` 구현 및 미래 5 Collection을 2/2/1로 나누는 테스트 존재.
- `STAGES_PER_COLLECTION_PAGE = 5`.
- `getCollectionStagePageCount()` / `getCollectionStagePage()` / `getCollectionStagePageIndexForStage()` 추가.
- 제1장20 = 4페이지, SPECIAL5 = 1페이지. `border-20`의 내부 page index는3.
- **현재 StageHubScene 자체는 아직 Collection paging helper를 실제 이전/다음 UI에 연결하지 않았다. 현재 Collection이 2개라 정상 표시되지만 세 번째 Collection 추가 전에 반드시 연결해야 한다.**
- 그 전까지 `STAGE_COLLECTIONS.length <= 2` 임시 회귀 gate가 세 번째 Collection을 조용히 추가하지 못하게 막는다.
- StageSelectScene도 현재 5개 page 값을 직접 사용하고 있어 다음 안전한 `main.ts` 수정에서 새 helper를 소비하도록 통일해야 한다.

## 9. 스테이지 DSL 미구현 부분

- 난이도 정본 1~12, `협동 권장` 태그 없음.
- schema에 `stageType`, `playerUnitCap`, `enemyUnitCap`, `formationRestrictions`, `specialRules` 존재.
- 편성 제한 evaluator/UI enforcement는 아직 미구현.
- `specialRules` runtime registry 미구현.
- 실제 wave runtime은 현재 `atTick`.
- 거점HP/특정 적 사망/누적 처치·사망/페이즈/AND·OR 복합 trigger evaluator는 미구현.
- 미구현 규칙을 카드 설명만으로 작동하는 것처럼 가장하지 않는다.

## 10. 협동 정본

- 2인: 각5칸, 팀 전체10.
- 개인 보급/보급소/생산 쿨다운, 공유 거점HP/승패/거점 병기.
- 협동은 싱글보다 실질적으로 수월할 수 있으나 `협동 권장` 태그/경고 금지.
- 필요 시 적 최대HP / 적 공격력 / 적 거점HP만 단순 수치 보정.
- 이동속도/공격주기/사거리/KB/스폰/적 수/웨이브/패턴/AI는 협동 때문에 바꾸지 않는다.
- solo/coop stage 복제 금지.

## 11. 검증 상태 / 현재 한계

- `.github/workflows/ci.yml`은 main push/PR에서 install → typecheck → test → build를 실행하도록 설정돼 있다.
- 그러나 현재 연결에서는 direct-main run 결과를 조회하지 못하고 combined status에도 context가 없다.
- 로컬 컨테이너는 GitHub DNS가 해석되지 않아 최신 main clone 후 npm 실행을 할 수 없다.
- 0.0.30에서 정확한 StageHub 부분 패치 + verify용 일회성 push workflow를 시도했으나 실행되지 않았고 즉시 삭제했다. 최종 `.github/workflows/`에는 다시 `ci.yml`만 남겨야 한다.
- 확인되지 않은 CI 성공을 주장하지 않는다.

## 12. 첫 사용자 테스트 전 남은 게이트

1. 최신 HEAD 실제 install → typecheck → test → build 확인.
2. 새 `special-baseline.test.ts` 실행으로 SPECIAL1~5 clearability와 필수 보스 실제 등장 확인.
3. StageHub에 실제 2 Collection/page 이전·다음 UI 연결 후 임시 `<=2` gate 제거.
4. StageSelect가 공용 5-stage page helper를 소비하고 결과 복귀 시 해당 stage page 맥락을 복원하도록 연결.
5. PC/compact 모바일 실제 렌더에서 출정 허브/스테이지/도감/결과 텍스트 겹침, 아트 잘림, 터치, safe-area 확인.
6. Cloudflare Pages 실제 프로젝트 URL/최신 배포 확인.
7. 위 게이트를 확인한 뒤에만 사용자 테스트 요청.

## 13. 개발 원칙

- GitHub `main` 정본, 사용자 요청대로 direct main 작업.
- 새 코드를 구식 hotfix/override 뒤에 덧씌우지 않는다.
- 대체된 코드·테스트·임시 워크플로는 제거한다.
- 같은 책임은 하나의 권위 경로만 유지한다.
- 냥코에서 참고하는 것은 대규모 스테이지의 계층/정보 우선순위/복귀 맥락이며 UI 아트·문구·과금·에너지 구조는 복제하지 않는다.
- 문서·content JSON·코드·테스트가 서로 다른 규칙을 가진 채 남지 않게 한다.
