# Frontline Summoners 새 채팅 인수인계 프롬프트

아래 내용을 새 채팅 첫 메시지로 사용한다.

---

전선소환전 / Frontline Summoners 개발을 이전 채팅에서 그대로 이어서 진행한다.

이 채팅은 새 게임을 처음부터 다시 기획하는 채팅이 아니다. 기억이나 이 문서만 믿지 말고 **가장 먼저 현재 GitHub `main`을 직접 확인**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

## 1. 작업 전 권위 순서

반드시 다음 순서로 확인한다.

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/STAGE_SYSTEM_DESIGN.md`
4. `docs/IMPLEMENTATION_STATUS.md`
5. `docs/DEVELOPMENT_RULES.md`
6. `docs/INDEX.md`
7. 관련 `content/*.json`
8. 실제 코드
9. 관련 테스트

특히 스테이지 작업이면 추가로 읽는다.

- `content/stages/chapter-01.json`
- `content/stages/special-01.json`
- `content/stage-collections.json`
- `apps/client/src/prototype.ts`
- `apps/client/src/stage-navigation.ts`
- `apps/client/src/save.ts`
- `apps/client/src/main.ts`
- `apps/client/test/stage-navigation.test.ts`
- `apps/client/test/special-stages.test.ts`
- `apps/client/test/battle-ui-wiring.test.ts`

문서·content·코드·테스트가 다르면 한쪽을 조용히 무시하지 말고 원인을 감사하여 함께 맞춘다.

## 2. 제품 핵심

- Web PC/모바일 횡스크롤 소환 전략.
- 30Hz 결정론적 공용 전투 코어.
- 핵심 루프: `보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰`.
- 싱글만으로 완전한 게임이어야 한다.
- 이후 2인 협동 → 1v1 → 2v2.
- 현재 과금 없음.
- 에너지/FOMO/필수 RNG 보물작/중복 강제 성장 금지.
- 판타지 약40 + 개그/괴상함 약60.
- 캐릭터 액티브 버튼 남발 금지. 직접 개입은 소환, 보급소, 장착 거점 병기 중심.

## 3. 제1장 / 기본 로스터

신규 계정:
- 징집병 1종.
- ST1만 개방.

제1장 합류:
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

현재 10종은 전체 캐릭터 상한이 아니라 기본/핵심 로스터다.

## 4. 스테이지 정본

두 축:
- `PROGRESSION` = 진도.
- `SPECIAL` = 특수.

난이도:
- 1~12.
- `협동 권장` 태그를 만들지 않는다.

동시 출격:
- 기본 아군50 / 적50.
- 10칸 편성과 별개.
- stage별 `playerUnitCap / enemyUnitCap` 지원.
- 보물의 아군 배치 한도 보정은 stage 기본값 위에 적용.

스키마:
- `stageType`
- `playerUnitCap`
- `enemyUnitCap`
- `formationRestrictions`
- `specialRules`

편성 제한 schema는 있으나 실제 enforcement는 아직 미구현. `specialRules` registry와 복합 trigger evaluator도 미구현. 구현되지 않은 규칙을 카드 문구만 붙여 작동하는 것처럼 만들지 않는다.

## 5. 대규모 스테이지용 출정 흐름 — 매우 중요

냥코 등 대규모 스테이지 게임에서 **계층형 진입과 정보 우선순위**를 참고하지만 UI/아트/문구/에너지 시스템은 복제하지 않는다.

정본 흐름:

`메인 → 출정 허브 → Collection → 공용 스테이지 목록 → 전투 → 원래 Collection 복귀`

### 현재 실제 구현

- 메인 `출정` → `StageHubScene(stage-hub)`.
- `StageHubScene`에서 Collection을 먼저 선택.
- `StageSelectScene` 하나가 PROGRESSION/SPECIAL 모두 처리.
- 옛 `SpecialStageSelectScene / special-select`는 제거됨. 되살리지 않는다.
- `StageSelectScene`은 `collectionId`로 데이터를 받는다.
- 진도 카드는 보물/동료, 특수 카드는 출격 제한/훈장을 분기 표시.
- 한 Collection 내부 stage는 현재 5개씩 페이지.
- 결과 화면은 stage ID로 원래 Collection을 찾아 그 목록으로 복귀.

### Collection 데이터

`content/stage-collections.json`이 다음을 가진다.
- id
- stageType
- title / shortTitle / description
- stageIds
- requiredProgressionClears

`apps/client/src/stage-navigation.ts`가 모든 stage를 Collection에 연결한다.

검증 원칙:
- 모든 playable stage는 정확히 하나의 Collection에 속해야 한다.
- 존재하지 않는 stage ID 금지.
- PROGRESSION/SPECIAL 혼합 금지.
- Collection ID 중복 금지.
- stage 중복 배정 금지.

현재 Collection:
- `chapter-01` = 진도20.
- `special-border-01` = SPECIAL5.

### 허브 페이지 — 다음 최우선 미완료

- 정본 목표: **Collection 2개씩 페이지**.
- `STAGE_COLLECTIONS_PER_PAGE = 2`.
- `getStageCollectionPageCount()` / `getStageCollectionPage()` 구현 완료.
- 미래 Collection 5개를 가정한 2/2/1 페이지 테스트 구현 완료.
- 하지만 **현재 `StageHubScene`은 아직 helper를 실제 이전/다음 UI에 연결하지 않고 현 2개 Collection을 한 화면에 직접 렌더한다.**
- 제2장/세 번째 Collection 추가 전에 반드시:
  - hub `page` 상태,
  - 이전/다음 버튼,
  - page indicator,
  - `getStageCollectionPage()` 기반 2개 bounded render
  로 교체한다.
- `main.ts`는 약64KB 대형 파일이므로 현재 연결이 전체 파일 교체만 지원하는 상황에서 섣불리 통째로 재작성하여 전투 코드를 유실하지 않는다. 정확한 수정 경로를 확보해 처리한다.

## 6. 현재 콘텐츠

총 25전투:
- PROGRESSION 20.
- SPECIAL 5.

첫 SPECIAL 팩은 제1장 완료 시 5개 동시 개방. 서로 순차 잠금하지 않는다.

1. 세 자리 전선 · 난이도6 · 실효3기 제한.
2. 광란의 짧은 길 · 난이도7 · 650m 러시.
3. 유리봉 저격선 · 난이도8 · 1500m 장거리 방패/저격.
4. 삼인 결사대 · 난이도9 · 실효3기 + 철문장군.
5. 가면과 철문 · 난이도10 · 황금가면→철문장군.

SPECIAL은 현재 구현된 atTick, 경제, 맵, unit cap, 기존 적/보스만 사용한다.

0.0.29 보스 타이밍:
- 삼인 결사대 철문장군 50초(tick1500).
- 가면과 철문 황금가면 35초(tick1050).
- 가면과 철문 철문장군 70초(tick2100).

보스 능력치를 깎은 수정이 아니다. 늦게 등장해 거점만 먼저 깨는 보스전이 되지 않게 스폰을 당겼다.

첫 SPECIAL 5개 deterministic clearability는 아직 실제 실행 검증 전이다. 난이도6~10 수치를 최종이라고 주장하지 않는다.

## 7. 보상 / 저장

제1장:
- 첫 클리어 보물 100% 확정.
- 반복 RNG 파밍 없음.
- typed modifier 실제 적용.

SPECIAL:
- `specialClearedStageIds` 별도 저장 축.
- 첫 팩 훈장은 전투 능력치 없는 도전 완료 기록.
- 도감에 동료10 / 보물20 / 훈장5.

저장 schema v3:
- `clearedStageIds` = PROGRESSION.
- `specialClearedStageIds` = SPECIAL.
- `treasureIds` = 보물/별도 reward ID.
- v2→v3 마이그레이션 존재.
- ST1부터 연속 clear prefix가 메인 진도 권위.
- 영구 저장 실패를 성공으로 거짓 표시하지 않는다.

## 8. 경제 / ST20

보급소:
- Lv1 12/s max1000
- Lv2 20/s max1400 cost160
- Lv3 30/s max1900 cost260
- Lv4 42/s max2500 cost390
- Lv5 56/s max3200 cost560
- Lv6 72/s max4000 cost760
- Lv7 90/s max5000 cost1000
- Lv8 110/s max6200 cost1300

ST1 시작50. ST8 160. ST19 280. ST20 300.

ST20:
- 방패15초
- 광전사33.3초
- 황금가면50초
- 저격60초
- 철문장군80초
- 거점4000/7200
- map1280

소스 충실 독립 결정론 재현 기준 ST1~20 합법 baseline 통과 및 ST19/ST20 보스 등장 확인. 이것을 최신 실제 npm/CI green이라고 주장하지 않는다.

## 9. PC / 모바일

- viewport 권위 `apps/client/src/viewport.ts` 하나.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC를 모바일로 오인하지 않는다.
- 모바일 portrait guard도 coarse pointer가 있어야 활성화.
- PC: 1~0 소환, Q 보급소, E 전선포, P/ESC 일시정지.
- 모바일: 키보드 표기 숨김, 핵심 터치 84 logical px.
- 정상 실패 입력은 camera shake 없음.
- camera shake는 전선포 성공 / 강한 유닛 피격 / 거점 피격만.

## 10. 협동

- 2인 각5칸, 팀10.
- 개인 보급/보급소/쿨다운.
- 공유 거점HP/승패/거점 병기.
- 협동이 실제 수월할 수 있으나 `협동 권장` UI 금지.
- 필요 시 적 HP/공격/적 거점HP만 보정.
- 이동속도/주기/사거리/KB/스폰/적 수/웨이브/패턴/AI는 협동 때문에 변경하지 않는다.
- solo/coop stage 복제 금지.

## 11. 개발 규칙

- GitHub `main` 직접 반영.
- 새 기능을 옛 hotfix/override 위에 덧씌우지 않는다.
- 대체한 Scene/함수/상수/테스트는 구식 경로를 제거한다.
- 같은 책임은 권위 경로 하나만 유지.
- 미구현 기능을 UI 설명으로 가장하지 않는다.
- 이미지 생성은 사용자가 명시적으로 요청한 경우에만.

## 12. 현재 검증 한계

- 로컬 컨테이너는 github.com DNS 해석 실패로 최신 main clone/npm 실행 불가.
- direct-main GitHub Actions green/red를 현재 연결에서 확인하지 못함.
- 따라서 최신 install/typecheck/test/build 성공을 주장하지 않는다.
- SPECIAL 5 실제 deterministic baseline 미확인.
- 새 출정 허브 실제 PC/가로 모바일 렌더 확인 미완료.

## 13. 다음 작업 우선순위

1. StageHubScene에 Collection 2개 단위 실제 paging UI 연결.
2. 최신 HEAD typecheck/test/build를 확인할 실행 경로 확보.
3. SPECIAL5 deterministic clearability + 보스 실제 출현 검증.
4. 메인→출정→Collection→스테이지→전투→원래 Collection 복귀의 PC/모바일 실렌더 확인.
5. Cloudflare Pages 최신 배포 확인.
6. 첫 사용자 테스트 게이트 통과 뒤에만 사용자에게 테스트 요청.
7. 이후 추가 SPECIAL/제2장, 성장·진화·모집·수동 편성, 제한 DSL/복합 trigger, 협동 순으로 확장.
