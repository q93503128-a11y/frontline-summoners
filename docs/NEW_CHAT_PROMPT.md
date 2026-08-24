# Frontline Summoners 새 채팅 인수인계 프롬프트

전선소환전 / Frontline Summoners 개발을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **먼저 현재 GitHub `main`을 직접 확인**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

## 1. 작업 전 권위 순서

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/STAGE_SYSTEM_DESIGN.md`
4. `docs/IMPLEMENTATION_STATUS.md`
5. `docs/DEVELOPMENT_RULES.md`
6. `docs/INDEX.md`
7. 관련 `content/*.json`
8. 실제 코드
9. 관련 테스트

스테이지 작업이면 반드시 추가 확인:
- `content/stages/chapter-01.json`
- `content/stages/special-01.json`
- `content/stage-collections.json`
- `apps/client/src/prototype.ts`
- `apps/client/src/stage-navigation.ts`
- `apps/client/src/save.ts`
- `apps/client/src/main.ts`
- `apps/client/test/stage-navigation.test.ts`
- `apps/client/test/special-stages.test.ts`
- `apps/client/test/special-baseline.ts`
- `apps/client/test/special-baseline.test.ts`

문서·content·코드·테스트가 다르면 함께 맞춘다. 테스트 때문에 폐기한 옛 경로를 되살리지 않는다.

## 2. 제품 핵심

- Web PC/모바일 횡스크롤 소환 전략.
- 30Hz 결정론적 공용 sim.
- 핵심 루프: `보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰`.
- 싱글만으로 완전한 게임. 이후 2인 협동 → 1v1 → 2v2.
- 에너지/FOMO/필수 RNG 보물작/중복 강제 성장 금지.
- 캐릭터 액티브 버튼 남발 금지. 직접 개입은 소환·보급소·거점 병기 중심.

## 3. 제1장 / 로스터

신규 계정은 징집병 1종 + ST1만 개방.

합류:
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

현재10종은 전체 캐릭터 상한이 아니라 기본 로스터.

## 4. 스테이지 정본

- `PROGRESSION` / `SPECIAL` 두 축.
- 난이도 1~12.
- `협동 권장` 태그 없음.
- 기본 동시 출격 아군50 / 적50. 10칸 편성과 별개.
- stage별 `playerUnitCap / enemyUnitCap`.
- 보물의 아군 cap 증가는 stage base cap 위에 적용.
- schema에 `formationRestrictions`, `specialRules`가 있으나 실제 evaluator/registry는 아직 미구현.
- 실제 wave runtime은 현재 `atTick`.
- 미구현 편성 제한·복합 trigger·생존전 등을 카드 설명만으로 작동하는 것처럼 만들지 않는다.

## 5. 대규모 스테이지용 출정 계층 — 매우 중요

냥코 등 대규모 스테이지 게임에서 **계층형 진입, 정보 우선순위, 복귀 맥락**만 참고한다. UI 아트/아이콘/문구/에너지·과금 구조는 복제하지 않는다.

정본 흐름:

`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

현재:
- 메인 `출정` → `stage-hub`.
- `StageHubScene`에서 Collection 선택.
- PROGRESSION/SPECIAL 모두 하나의 `StageSelectScene`.
- 옛 `SpecialStageSelectScene / special-select`는 제거됨. 되살리지 않는다.
- 결과 화면은 stage ID로 원래 Collection을 찾아 복귀.

### Collection 데이터

`content/stage-collections.json`:
- `id`
- `stageType`
- `title / shortTitle / description`
- `stageIds`
- 필요 시 **`unlockAfterStageId`**

중요: `requiredProgressionClears: 20` 같은 숫자 unlock gate를 content에 다시 저장하지 않는다.
- 현재 `special-border-01` 해금 정본 = `unlockAfterStageId: "border-20"`.
- UI용 필요 clear 수는 progression stage 순번에서 런타임 파생.
- scattered save fragment `['border-20']`만으로는 unlock되지 않는다.

현재 Collection:
- `chapter-01` = progression20.
- `special-border-01` = special5.

### 페이지 권위

`apps/client/src/stage-navigation.ts`:
- `STAGE_COLLECTIONS_PER_PAGE = 2`
- `getStageCollectionPageCount()`
- `getStageCollectionPage()`
- `STAGES_PER_COLLECTION_PAGE = 5`
- `getCollectionStagePageCount()`
- `getCollectionStagePage()`
- `getCollectionStagePageIndexForStage()`

테스트상 미래 Collection 5개는 2/2/1 페이지, 제1장20은 4페이지, SPECIAL5는 1페이지.

**아직 미완료:**
- `StageHubScene` 실제 이전/다음 버튼은 collection paging helper에 아직 연결되지 않았다.
- 현재 Collection이 2개라 화면은 정상.
- 세 번째 Collection 추가 전에 반드시 실제 hub paging을 연결하고 임시 `STAGE_COLLECTIONS.length <= 2` gate를 제거한다.
- `StageSelectScene`도 현재 내부 `5`를 직접 사용하므로 새 stage-page helper 소비로 통일해야 한다.
- 결과 복귀 시 같은 Collection뿐 아니라 해당 stage가 속한 정확한 page도 복원하는 방향으로 연결한다.

0.0.30에서 main.ts 정밀 부분수정용 일회성 push workflow를 시도했지만 Actions가 실행되지 않아 즉시 삭제했다. dead workflow를 다시 남기지 않는다.

## 6. 현재 콘텐츠

총25전투:
- progression20
- special5

SPECIAL 5는 제1장 완료 후 동시에 개방:
1. 세 자리 전선 · 난이도6 · 실효3기.
2. 광란의 짧은 길 · 난이도7 · 650m 러시.
3. 유리봉 저격선 · 난이도8 · 1500m 장거리.
4. 삼인 결사대 · 난이도9 · 실효3기 + 철문장군.
5. 가면과 철문 · 난이도10 · 황금가면 → 철문장군.

보스 타이밍:
- special-04 철문장군 50초(tick1500).
- special-05 황금가면 35초(tick1050).
- special-05 철문장군 70초(tick2100).

보스 능력치를 깎은 수정이 아니다.

### SPECIAL deterministic gate — 새로 추가

- `apps/client/test/special-baseline.ts`
- `apps/client/test/special-baseline.test.ts`

제1장 완료 계정의 10종 + 20보물을 실제 `createPrototypeBattle()`에 넣고 실제 보급/강화비/생산비/쿨다운/cap/전선포를 사용하며 `stepPlayableBattle()`을 30Hz로 돌린다.

테스트 요구:
- SPECIAL1~5 모두 PLAYER 승리.
- 적 거점 실제 파괴.
- playerUnitCap 초과 금지.
- 삼인 결사대 철문장군 실제 관측.
- 가면과 철문 황금가면 + 철문장군 실제 관측.

**아직 실제 실행 결과를 확보하지 못했다. 통과했다고 주장하지 않는다.** 실패하면 보스 HP부터 무작정 깎지 말고 경제/스폰/전열/cap/전략 원인을 분리한다.

## 7. 저장 / 보상

- save schema v3.
- `clearedStageIds` = PROGRESSION.
- `specialClearedStageIds` = SPECIAL.
- `treasureIds` = 보물/별도 reward ID.
- ST1부터 contiguous prefix가 메인 진도 권위.
- v2→v3 migration 존재.
- durable/session 개별 정규화 후 병합.
- SPECIAL 훈장은 전투 능력치 없는 완료 기록.
- 도감: 동료10 / 보물20 / 훈장5.
- 영구 저장 실패를 성공으로 거짓 표시하지 않는다.

## 8. 경제 / ST20

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

소스 충실 독립 재현 기준 ST1~20 합법 baseline 통과 기록은 있으나 최신 HEAD npm/CI green과 동일한 주장이 아니다.

## 9. PC / 모바일

- viewport 권위 `apps/client/src/viewport.ts`.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC는 PC UI 유지.
- portrait guard도 coarse pointer 필요.
- PC: 1~0 소환, Q 보급소, E 전선포, P/ESC 정지.
- 모바일: 키보드 힌트 숨김, 핵심 터치84 logical px.
- 정상 실패 입력 shake 없음.
- shake는 전선포 성공 / 강한 피격 / 거점 피격만.

## 10. 협동

- 2인 각5칸, 팀10.
- 개인 보급/보급소/생산 쿨다운.
- 공유 거점HP/승패/거점 병기.
- 협동이 더 쉬울 수 있지만 `협동 권장` UI 금지.
- 필요 시 적 HP/공격/적 거점HP만 숫자 보정.
- 속도/공격주기/사거리/KB/스폰/적 수/웨이브/패턴/AI를 협동 때문에 바꾸지 않는다.
- solo/coop stage 복제 금지.

## 11. 검증 한계

- 로컬 컨테이너는 github.com DNS 문제로 최신 main clone/npm 실행 불가.
- 현재 연결은 direct-main GitHub Actions 결과를 읽지 못하고 combined status context도 없음.
- 따라서 최신 install/typecheck/test/build green을 주장하지 않는다.
- SPECIAL5 새 deterministic baseline도 실행 결과 미확인.
- StageHub 실제 3+ Collection paging UI 미완료.
- Cloudflare Pages 실제 프로젝트/최신 배포 미확인.

## 12. 다음 우선순위

1. SPECIAL baseline 실제 실행 결과를 확보할 수 있는 경로가 생기면 5판 결과부터 확인하고 최소 조정.
2. 안전한 `main.ts` 수정 경로로 StageHub 2-Collection paging UI 연결.
3. StageSelect를 공용 5-stage helper로 전환하고 결과 복귀 시 정확한 page 복원.
4. PC/compact 모바일 실렌더 감사.
5. 실제 typecheck/test/build + Pages 배포 확인.
6. 모두 확인한 뒤에만 사용자 테스트 요청.

## 13. 개발 규칙

- GitHub `main` 직접 반영.
- hotfix/override 누적 금지.
- 대체된 Scene/함수/상수/테스트/임시 workflow 제거.
- 같은 책임은 권위 경로 하나만 유지.
- 미구현 기능을 UI 설명으로 가장하지 않는다.
- 이미지 생성은 사용자가 명시적으로 요청한 경우에만.
