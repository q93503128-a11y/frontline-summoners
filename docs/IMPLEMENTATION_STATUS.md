# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 전체 방향은 `docs/GAME_DESIGN_FULL.md`, 스테이지·특수·협동 세부는 `docs/STAGE_SYSTEM_DESIGN.md`, 개발 방식은 `docs/DEVELOPMENT_RULES.md`와 대조한다.

## 2026-08-24 — campaign vertical slice 0.0.28

## 1. 문서 정본

- `docs/CANONICAL.md`: v0.31, 최신 핵심 결정 정본.
- `docs/GAME_DESIGN_FULL.md`: 통합 전체 기획서.
- `docs/STAGE_SYSTEM_DESIGN.md`: 스테이지 DSL, 진도/특수 분리, 출격 제한, 편성 제한, 특수 규칙, 협동 세부 정본 보조 문서. 첫 SPECIAL 팩의 역할도 기록됨.
- `docs/IMPLEMENTATION_STATUS.md`: 현재 구현/미구현만 기록하는 상태 문서.
- `docs/DEVELOPMENT_RULES.md`: 레거시 덧씌우기 금지, 중복 구현 제거, 권위 경로 단일화 원칙. 작업 전 읽기에 `STAGE_SYSTEM_DESIGN.md`까지 포함.
- `docs/INDEX.md`: 문서 권위/읽는 순서.
- `docs/NEW_CHAT_PROMPT.md`: 새 채팅 인수인계용. 새 채팅에서는 반드시 GitHub `main`을 다시 확인한다.
- 구체 콘텐츠 수치는 `content/` JSON이 우선한다.

## 2. 전투 코어

- `packages/sim` 공유 30Hz 결정론적 전투 코어.
- 이동, 탐지, foreswing/hitFrame/backswing, 동시 피해, 자연 KB, ForcedDisplacement, DYING, 거점 승패, stateHash 구현.
- 보급, 보급소 Lv1~8, 생산비, 재생산 쿨다운, 적 웨이브, 처치 보급, 거점 병기 구현.
- 전선포: 적 전체 90 피해 후 자연 KB/사망 판정, 남은 적 60거리/10F 강제 후퇴, 900F 재충전.
- `playerUnitCap / enemyUnitCap` 기본값은 각각 50.
- `stage.playerUnitCap → 보물 보정 → simulation`, `stage.enemyUnitCap → simulation` 한 경로를 사용한다.

## 3. 스테이지 / 콘텐츠 현황

### 진도

- `PROGRESSION` 진도 / `SPECIAL` 특수 두 축을 정본화.
- 제1장 진도는 20개이며 모두 싱글 클리어 가능해야 한다.
- 난이도는 1~12. 현재 제1장 진도는 1~9, ST20=9.
- 제1장 7개 전장 계열 + stage별 `decorSeed`/`mapLength` 차등.
- ST19 황금가면 제단, ST20 황금가면+철문 요새 랜드마크.

### 첫 SPECIAL 팩 — 실제 구현

`content/stages/special-01.json`에 **5개 선택형 특수전**을 추가했다. 제1장 ST20 클리어 후 다섯 개가 동시에 열린다. 특수전끼리는 순차 잠금하지 않는다.

1. `special-01` **세 자리 전선** · 난이도6 · 실효 아군 3기 제한 정예전.
2. `special-02` **광란의 짧은 길** · 난이도7 · 650m 초단거리 돌격 러시.
3. `special-03` **유리봉 저격선** · 난이도8 · 1500m 장거리 방패/저격전.
4. `special-04` **삼인 결사대** · 난이도9 · 실효 3기 제한 + 철문장군 보스전.
5. `special-05` **가면과 철문** · 난이도10 · 황금가면 대주술사 → 철문장군 연속 보스전.

- `STAGES`는 20개 진도만 유지하고, `SPECIAL_STAGES` 5개와 `ALL_STAGES`를 별도 제공한다.
- special JSON은 기존 스키마 파서로 실제 검증되며 모든 항목이 `stageType=SPECIAL`인지, 제1장 핵심 동료를 해금하지 않는지 검사한다.
- 특수전은 제1장 완료 계정의 10종 로스터와 이미 획득한 제1장 보물 효과를 그대로 사용한다.
- `세 자리 전선`/`삼인 결사대`의 JSON 기본 cap은 2. 제1장 확정 보물의 `아군 최대 배치 +1`이 적용되어 실제 전투 cap=3이 된다. 특수전만 성장 효과를 무시하는 예외는 만들지 않았다.
- 첫 팩은 아직 미구현인 편성 제한 evaluator, 복합 trigger, 시간제한/생존 승리, 특수 rule registry를 사용하지 않는다.
- 현재 구현된 `atTick` 웨이브, 맵 길이, 경제, 동시 출격 제한, 기존 적/보스만 조합한다.
- SPECIAL 선택 화면, 전투 입장 검증, 결과 화면, 재도전/목록 이동까지 실제 연결됨.

### SPECIAL 훈장

- 첫 특수전 팩 보상은 **훈장형 도전 완료 기록**.
- 제1장 20개 능력치 보물과 분리하며 전투 능력치 보너스가 없다.
- 결과 화면에서 첫 클리어 훈장을 표시한다.
- 도감에 `동료 10종 / 보물 20종 / 훈장 5종` 세 탭을 제공하고 SPECIAL 클리어 여부를 별도 확인할 수 있다.

## 4. 아직 설계만 있고 미구현인 스테이지 기능

- 편성 제한 스키마는 희귀도 허용/상한, 역할, 비용 상한, 필요/금지 태그, 최대 편성 종류, 동일 세력 제한까지 표현하지만 실제 편성 UI enforcement는 미구현.
- `specialRules`는 등록된 deterministic rule ID만 사용하도록 설계했지만 런타임 registry는 미구현.
- 실제 웨이브 런타임은 현재 `atTick` 기반.
- 거점 HP, 특정 적 사망, 누적 처치/사망, 페이즈, AND/OR 복합 trigger evaluator는 아직 미구현.
- 시간제한/생존전 등은 위 evaluator/승리 규칙이 구현된 뒤 실제 콘텐츠로 추가한다.

## 5. 협동 정본

- 2인 협동: 플레이어당 5칸, 팀 전체 10칸.
- 공유: 거점 HP, 승패, 거점 병기.
- 개인: 보급, 보급소, 생산 쿨다운.
- 협동은 동일 스테이지를 싱글보다 실질적으로 수월하게 공략할 수 있는 선택지.
- `협동 권장` 태그/경고는 사용하지 않는다.
- 필요 시 협동 보정은 적 최대 HP / 적 공격력 / 적 거점 최대 HP만 단순 배율 조정한다.
- 협동 때문에 적 이동속도, 공격주기, 사거리, KB, 스폰 시간, 적 수, 웨이브, 패턴, AI를 바꾸지 않는다.
- solo/coop 스테이지를 두 벌로 복제하지 않는다.
- 정확한 협동 배율과 실제 멀티 런타임은 아직 미구현.

## 6. 솔로 일시정지 / PC 입력

- 솔로 일시정지 버튼 + PC `P`/`ESC`.
- 정지 중 simulation tick, 보급, 쿨다운, 적 스폰, 이동/공격, 투사체, Phaser tween 정지.
- PC `1~0` = 현재 `activeSlots` 1~10, `Q` = 보급소 강화, `E` = 전선포.
- 키 반복을 막지 않아 연타/키 홀드 가능.
- 마우스/터치와 키보드는 같은 action 함수 사용.
- 소환 쿨/보급 부족/unit cap/보급소 실패/MAX/전선포 쿨/잠긴 스테이지/저장 대기 같은 정상 실패 입력은 조용히 무시한다.
- camera shake는 전선포 성공 / 강한 유닛 피격 / 거점 피격 세 전투 충격 경로만 허용.

## 7. PC / 모바일 UI 분리

- 공용 게임 데이터/전투 로직 위에서 PC 상세 UI와 compact 모바일 UI를 별도 정보 밀도로 렌더.
- viewport 판정 권위는 `apps/client/src/viewport.ts` 하나.
- compact 모바일 = **coarse primary pointer + 짧은 변 540px 이하**.
- `1280×500` 같은 작은 마우스 PC 창은 PC UI 유지.
- 세로 모바일 차단 = coarse pointer + width≤900 + portrait. HTML CSS도 `(pointer: coarse)`를 같이 요구.
- safe-area inset 적용.
- compact 핵심 터치 버튼은 84 logical px. 390px 높이 FIT 기준 약45.5 CSS px.
- 모바일에서 1~0/Q/E 시각 표시는 숨기고 PC에서는 유지.
- 전투 하단 두 줄 중심 y=582/666, 높이84.
- 스테이지/특수전/편성/도감/메인/결과에 compact 정보 축약과 PC 상세정보 보존 분기 존재.
- `antialias:true / pixelArt:false / roundPixels:false`.

## 8. 제1장 경제 / 후반 baseline

기본 보급소:
- Lv1 12/s · 최대1000
- Lv2 20/s · 최대1400 · 강화160
- Lv3 30/s · 최대1900 · 강화260
- Lv4 42/s · 최대2500 · 강화390
- Lv5 56/s · 최대3200 · 강화560
- Lv6 72/s · 최대4000 · 강화760
- Lv7 90/s · 최대5000 · 강화1000
- Lv8 110/s · 최대6200 · 강화1300

- 시작 보급: ST1~7 50→110, ST8 160, ST19 280, ST20 300.
- ST1 거점 900/800, ST20 거점 4000/7200.
- ST20 현재: 방패15초, 광전사33.3초, 황금가면50초, 저격60초, 철문장군80초.
- 후반 deterministic baseline은 ST16~20에 실제 해금 로스터·경제 투자·속성/특효/광역/사거리/내구/보급 대기시간을 고려.
- 소스 충실 독립 재현 기준 ST1~20 합법 baseline 통과, ST19/20 필수 보스 등장 확인.
- 이것은 현재 HEAD의 실제 `npm test` green 주장과는 별개다.

## 9. 캐릭터 / 메타

- 신규 계정: 징집병 1종 + ST1만 개방.
- 제1장 합류: ST1 방벽기사 → ST2 수렵창병 → ST4 결투검사 → ST6 청창대 → ST8 전투마도사 → ST10 화염술사 → ST13 왕실기사 → ST16 이단주술사 → ST20 공허현자.
- 현재 10종은 전체 캐릭터 풀 상한이 아니라 기본 로스터.
- 이후 모집, 보스/특수 스테이지, 외전, 이벤트, 도전 콘텐츠 등으로 확장.
- 현재는 보유 캐릭터 자동 편성. 풀 확장 후 10칸 수동 편성 메타 예정.
- 레벨/강화/진화는 핵심 메타지만 아직 본격 미구현.
- 진화는 색놀이/숫자만 상승이 아니라 실루엣, 장비, 모션, VFX, 공격 방식/효과가 실제로 달라져야 한다.

## 10. 진도 / 보물 / 저장

- 제1장 20스테이지 보물은 첫 클리어 100% 확정, 등급/드랍 RNG 없음.
- typed modifier가 시작 보급, 거점HP, 유닛 스탯, 재생산, 처치보급, 강화비, 배치한도 등에 실제 적용.
- 저장 schema **v3**.
- `clearedStageIds` = PROGRESSION 전용.
- `specialClearedStageIds` = SPECIAL 전용.
- `treasureIds` = 제1장 능력치 보물 + 향후 별도 reward ID.
- 기존 v2 저장은 v3으로 읽어 제1장 진도/보물을 보존하며 special clear는 빈 배열로 시작한다.
- `getContiguousClearedStageIds()`가 ST1부터 끊기지 않은 prefix를 진도 권위로 사용.
- 뒤 스테이지만 비정상 저장돼도 다음 진도, 동료, 보물을 건너뛰어 얻지 못한다.
- `getStage()` strict. progression `getStageNumber()`와 special `getSpecialStageNumber()`도 각 축에서 strict.
- durable/session은 각자 정규화 후 병합.
- 제1장 보물 ID는 실제 progression clear에서 재파생해 누락을 복구하고 조기 보물을 제거.
- `recordStageClear()`는 PROGRESSION만 처리하고 정본 stage↔treasure를 검증.
- `recordSpecialStageClear()`는 SPECIAL만 처리하고 별도 clear 축만 갱신한다.
- IndexedDB 영구 저장 실패 시 현재 탭 진행은 유지하되 UI에서 영구 저장 성공으로 거짓 표시하지 않는다.

## 11. 콘텐츠 / 아트

- 플레이어 10종.
- 일반 적 8종 + 보스2종.
- **진도 20 + 첫 SPECIAL 5 = 현재 데이터 기준 총 25개 전투**.
- 7개 전장 계열을 재조합.
- 공격 VFX: `SLASH / PIERCE / BLUNT / MAGIC / FIRE / VOID`.
- 원거리 투사체는 foreswing 후반 발사 → hitFrame 도달, 판정은 30Hz hitFrame 정본.
- LuizMelo CC0 계열 7개 아트 패밀리는 프로토타입 개발 에셋이며 장기 캐릭터 다양성 상한이 아니다.

## 12. 회귀 테스트 추가/변경

- `special-stages.test.ts`: 진도20/특수5 분리, SPECIAL 타입, 동시 개방, 서로 다른 전장 문법, cap 보물 실제 적용, 연속 보스 데이터 검사.
- `save-progress.test.ts`: v2→v3 마이그레이션, special clear 별도 축, progression/special writer 분리, 저장 정규화 검사.
- `battle-ui-wiring.test.ts`: 특수전 선택 화면/입장/결과 저장/목록 이동/씬 등록, 기존 camera shake 3경로, PC/모바일 회귀.
- `catalog-boss-mobile-ui.test.ts`: 동료/보물/훈장 세 컬렉션 분리와 기존 모바일/보스 회귀.
- `viewport-classification.test.ts`: 터치폰/작은 PC/태블릿 분류.
- `progression.test.ts`: 신규 계정, 연속 진도, 미등록 stage, 비연속 clear reward 차단.

## 13. 검증 상태 / 한계

- 첫 SPECIAL 팩은 데이터 파서·UI/저장 정적 회귀 구조까지 연결했다.
- 아직 **5개 SPECIAL의 실제 deterministic 클리어 baseline 결과는 확보하지 않았다.** 따라서 현재 난이도6~10과 웨이브 수치를 최종 밸런스라고 주장하지 않는다.
- 보스 특수전은 보스 스폰을 실제로 보고 이기는지 실행 가능한 환경에서 반드시 확인한다. 필요하면 보스 HP를 먼저 깎는 대신 스폰/경제/거점/AI baseline 원인을 분리한다.
- 로컬 컨테이너는 GitHub DNS가 해석되지 않아 최신 main clone 후 실제 npm 실행을 하지 못했다.
- `.github/workflows/ci.yml`은 main push/PR에서 install → typecheck → test → build를 실행하도록 설정되어 있으나 현재 연결에서는 direct-main run 결과를 읽지 못한다.
- 최신 combined-status에도 status context가 없어 현재 HEAD의 CI green/red는 미확인.
- 확인되지 않은 CI 성공을 주장하지 않는다.

## 14. 첫 사용자 테스트 전 남은 항목

1. 현재 HEAD의 실제 install → typecheck → test → build 확인.
2. 제1장 ST1~20뿐 아니라 첫 SPECIAL 5개의 deterministic clearability와 보스 실제 출현 확인.
3. PC/compact 모바일 실제 렌더에서 진도/특수전/도감 훈장 탭을 포함한 텍스트 겹침, 터치감, 카드/아트 잘림, safe-area 확인.
4. Cloudflare Pages 실제 프로젝트 URL/최신 배포 상태 확인.
5. 위 게이트를 확인한 뒤에만 사용자에게 테스트 요청.

## 15. 다음 큰 콘텐츠 단계

- 첫 SPECIAL 5개 밸런스 검증/조정.
- 구현된 규칙만 사용하는 추가 SPECIAL 팩 확대.
- 캐릭터 레벨/강화/성장 UI.
- 진화 form 데이터/외형/애니/VFX/전투 효과/저장.
- 기본 10종 이후 캐릭터 풀과 모집/다양한 획득 경로.
- 10칸 수동 편성.
- 편성 제한 evaluator, `specialRules` registry, 복합 trigger DSL이 실제 구현된 뒤 이를 사용하는 제한전/생존전/시간전 콘텐츠 추가.
- 제2장 이상 진도 캠페인.
- 2인 협동 → 1v1 → 2v2.

## 16. 개발 원칙 재확인

- GitHub `main` 정본.
- 작업 전 `CANONICAL → GAME_DESIGN_FULL → STAGE_SYSTEM_DESIGN → IMPLEMENTATION_STATUS → 관련 content → 코드/테스트` 순서로 확인.
- 새 코드를 옛 hotfix/override 위에 덧씌우지 않는다.
- 미구현 기능을 카드 설명만으로 구현된 것처럼 가장하지 않는다.
- 대체된 상수/함수/워크플로/진단 결과는 결론을 정본으로 옮긴 뒤 제거한다.
- 같은 책임은 하나의 권위 경로만 남긴다.
- 문서·content JSON·코드·테스트가 서로 다른 규칙을 가진 채 방치되지 않게 한다.
