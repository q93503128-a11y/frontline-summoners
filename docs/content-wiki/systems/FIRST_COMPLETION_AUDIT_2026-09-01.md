# 1차 완성 정본 대조 감사 — 2026-09-01

상태: **DESIGN_TARGET / code-audited, integrated CI + human product QA pending**

감사 기준 우선순위:

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/content-wiki/`
4. 실제 content/schema/code/tests
5. status 문서

`docs/IMPLEMENTATION_STATUS.md`는 2026-08-31 시점의 진행 메모이므로, 이후 실제 코드와 충돌하는 항목은 현재 사실로 사용하지 않는다.

## 결론

현재 프로젝트는 **게임 규칙·콘텐츠·온라인 시스템의 first-completion 구현은 대부분 닫힌 상태**다.

그러나 `TESTED`/`LOCKED` 또는 출시 준비 완료라고 부를 수는 없다.

가장 큰 잔여 공백은 새 게임 모드가 아니라 다음 세 축이다.

1. production character/enemy art, motion, audio의 실제 웹 배포 자산
2. guest/account/coop/PvP를 포함한 사람 멀티기기·viewport·장시간 플레이 QA
3. 일부 UI 탐색/legacy 중복 코드/문서 상태 정리

### 진척 추정

이 수치는 자동 산술 진척도가 아니라 정본 범위의 구현 상태를 코드와 대조한 engineering estimate다.

- **규칙·콘텐츠·시스템 구현 진척: 약 92%**
- **first-completion 제품 완성도 / release readiness: 약 78%**

시스템 구현률보다 제품 완성도가 낮은 이유는 production asset과 실제 사람 QA가 플레이 체감에서 차지하는 비중이 크기 때문이다.

## 정본 범위 대조

| 영역 | 현재 판정 | 근거/남은 일 |
| --- | --- | --- |
| 30Hz deterministic 1D combat | CODE-WIRED / 자동검사 축 존재 | standing/attack range 분리, batch damage, KB/displacement, 즉시 untargetable, recharge 하한 등 실제 sim에 존재. 사람 장시간 전투/밸런스 QA는 별도 |
| MAIN 4장 × 20 = 80 | IMPLEMENTED | 실제 progression stage content가 4장 80개로 조립됨 |
| 일반 SPECIAL | IMPLEMENTED | challenge/resource/permanent/event 묶음 합계 약 61개 |
| Record Endless + Boss Rush | IMPLEMENTED | 전용 hub/battle/result, trusted proof, 후반 명예 보상 구현 문서/코드 존재 |
| 초기 로스터 43 | IMPLEMENTED | STORY 10 + 공통 C/B/A 15 + 3시리즈 S5/SS1 구성 |
| F1/F2/F3 = 129 forms | IMPLEMENTED | 성장/진화 recipe와 실제 전투 definition 연결 |
| Lv1~50 / +레벨 | IMPLEMENTED | guest + account active meta authority 연결. 사람 계정 round-trip QA 남음 |
| 8속성 | IMPLEMENTED | content schema canonical enum 및 실제 전투 bonus 사용 |
| 모집 3시리즈 | IMPLEMENTED | 1/10회, 서버/게스트 RNG, 중복 +/분해. pity/direct select는 의도적으로 없음 |
| 편성 10칸 | IMPLEMENTED, 이번 감사에서 확장 | active account authority + 탭/드래그 + 조합 필터/검색/즐겨찾기 |
| SPECIAL 해금 | IMPLEMENTED | `main_01_020` NORMAL_CLEAR 기준 |
| NORMAL_CLEAR 후 2배속 | IMPLEMENTED | first-completion 범위에 실제 연결된 상태 |
| 소탕 | IMPLEMENTED | guest/account save authority 및 eligibility 경로 존재 |
| 도감 | IMPLEMENTED, 이번 감사에서 account read 수정 | 미획득/미발견 은폐, 전략 정보. 로그인 시 guest local을 읽던 단절을 active progress로 교정 |
| 메인 스토리 12장면 | IMPLEMENTED | 4장 × intro/prelude/outro, skip/auto-skip, solo/trusted/coop routing |
| PvE 2인 협동 | IMPLEMENTED / HUMAN QA PENDING | 참가코드 guest, 친구 account, 공개 account 경로와 퀵 메시지/보상 authority 존재 |
| 친구/초대/최근 사용자 | IMPLEMENTED / HUMAN QA PENDING | social graph, invite, block, presence 구현 축 존재 |
| PvP 1v1 casual/ranked/friendly | IMPLEMENTED / HUMAN QA PENDING | actual scenes/server authority/MMR/tier/leaderboard/reward 구현 |
| PvP 2v2 casual/friendly | IMPLEMENTED / HUMAN QA PENDING | actual 2v2 matchmaking/battle/friendly scene 등록. ranked 2v2는 범위 밖 |
| casual Gold 3판 allowance | IMPLEMENTED | 플레이 제한이 아니라 Gold 지급만 공유 3판 제한. 무제한 queue 원칙 유지 |
| guest/login/save/migration/delete | IMPLEMENTED / HUMAN RECOVERY QA PENDING | guest save v15, account save, GIS/auth, reversible migration/delete 경로 존재 |
| 접근성/VFX/저사양 | IMPLEMENTED / HUMAN QA PENDING | shake/flash/motion/LOW/VFX LOW/battery 정책. simulation은 독립 |
| achievement/profile cosmetics | IMPLEMENTED | 일반/숨김/전투 attribution/season/event/record 보상 연결 |
| production art/motion/audio | **MAJOR GAP** | production rules는 있으나 웹 제공 `public/assets`는 아직 실자산 패키지가 사실상 비어 있음 |

## 이번 감사에서 발견하고 수정한 실제 단절

### 1. 로그인 도감이 guest save를 읽던 문제

`CatalogScene`은 이전에 `loadGuestProgress()`를 직접 사용했다.

로그인 계정의 실제 서버 소유/발견/영구보상과 guest IndexedDB가 다르면 도감이 잘못 보일 수 있었다.

현재는 `loadActiveProgress()`로 전환했다.

- guest → guest local
- account online → server snapshot
- account offline → account cache read-only

### 2. 메인 메뉴 진행 요약이 guest 기준이던 문제

기본 `MainMenuScene`의 진행 수치도 active progress로 전환했다.

로그인 계정은 메인 화면에서 자신의 서버 진도/특수전/영구보상/보유 동료 수를 본다.

### 3. 43종 편성 탐색이 단순 페이지뿐이던 문제

기획서와 UI 위키가 요구한 로스터 탐색 기능 중 실제 편성 화면에 빠져 있던 큰 묶음을 구현했다.

- 전체/스토리/C/B/A/S/SS/즐겨찾기
- 역할
- 단일/범위
- 8속성 대항
- 비용
- 사거리
- +레벨/진화
- 검색
- 필터 조합
- local UI favorite

`최근 획득`은 실제 획득 timestamp authority가 없으므로 허위 순서를 만들지 않고 남겼다.

### 4. 이전 통합 CI의 direct TypeScript ESM import 실패

`battle-vfx-density.ts`의 직접 Node 테스트 dependency import를 `.ts` 명시 경로로 수정했다.

## 오래된 status 문서와 실제 코드의 충돌

`docs/IMPLEMENTATION_STATUS.md`에는 PvP가 아직 foundation 수준인 것처럼 남아 있는 부분이 있다.

하지만 현재 `apps/client/src/main.ts`는 이미 다음 실제 scene을 등록한다.

- PvP hub
- 1v1 matchmaking/match
- 1v1 friendly
- 2v2 matchmaking/battle
- 2v2 friendly
- season
- leaderboard

따라서 **status 문서만 보고 PvP가 미구현이라고 판정하면 잘못된 감사**다.

반대로 현재 코드에 파일이나 데이터가 존재한다는 이유만으로 `TESTED` 또는 `LOCKED`라고 올리지도 않는다.

## 현재 가장 큰 남은 first-completion 작업

우선순위는 다음과 같다.

### A. Production asset productization

가장 큰 플레이어 체감 공백이다.

- 캐릭터별 실제 production identity
- 적/보스 production identity
- F1/F2/F3 외형 차이
- 공격 contact motion/FX
- 전장 배경
- BGM/SFX
- 저사양/접근성 대체 자산

현재 시스템/콘텐츠가 충분히 닫혔으므로 이전보다 asset 제작을 시작할 근거가 커졌지만, 한 번에 43×3 전체를 만들기보다는 대표 세트로 production pipeline과 품질 기준을 먼저 검증하는 것이 안전하다.

### B. 사람 QA / balance certification

`TESTED` 승격을 위해 필수다.

- guest 전체 progression
- account 로그인/로그아웃/재로그인/cross-session
- migration/delete/recovery
- 2인 실제 네트워크 coop
- 1v1/2v2 실제 PvP
- casual Gold allowance 3판 후 queue 계속 가능 확인
- mobile/desktop viewport
- 4장 연속 difficulty/boss fatigue
- Record 장시간

### C. UI/legacy cleanup

실제 `main.ts`는 전용 `stage-hub-scene.ts`, `story-stage-select-scene.ts`를 사용하지만 `navigation-scenes.ts` 안에 오래된 StageHub/StageSelect 구현도 남아 있다.

이는 현재 플레이 경로를 막지는 않지만 `CANONICAL`의 deprecated code cleanup 원칙에 맞지 않는 기술부채다.

이번 콘텐츠 slice에서는 런타임 기능 확장을 우선했으므로 강제 삭제하지 않았다. 전용 cleanup milestone에서 tests/imports와 함께 제거하는 것이 안전하다.

## first-completion 밖이므로 추가하지 않은 것

- 2v2 ranked
- pity
- direct select
- stamina
- 매치 티켓
- casual PvP 3판 후 queue 차단
- 후반 본능형 endgame
- 난이도 9~12 억지 stage filler
- 랜덤 보물 grind

## 다음 판정 기준

이 감사 문서 자체는 `TESTED` 증거가 아니다.

다음 integrated CI green 뒤에도 사람 플레이가 없으면 각 구현 문서는 `code-wired` 또는 `HUMAN QA PENDING` 상태를 유지한다.

first-completion을 release-ready에 가깝게 올리는 다음 대형 묶음은 **production asset pipeline + 대표 캐릭터/보스/전장 실자산 적용** 또는 **실제 브라우저/멀티기기 acceptance QA에서 발견된 기능 결함 수정**이 가장 가치가 크다.
