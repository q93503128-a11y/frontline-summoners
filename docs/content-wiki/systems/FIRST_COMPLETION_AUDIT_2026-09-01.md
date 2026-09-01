# 1차 완성 정본 대조 감사 — 2026-09-01

상태: **DESIGN_TARGET / code-audited, integrated CI GREEN + human product QA pending**

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
3. 일부 UI productization과 오래된 status 문서 정리

### 진척 추정

이 수치는 자동 산술 진척도가 아니라 정본 범위의 구현 상태를 코드와 대조한 engineering estimate다.

- **규칙·콘텐츠·시스템 구현 진척: 약 92%**
- **first-completion 제품 완성도 / release readiness: 약 78%**

production runtime pipeline까지 연결되었지만 실제 최종 아트/음원과 사람 QA 비중이 크므로 이번 engineering integration만으로 수치를 임의 상향하지 않는다.

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
| 편성 10칸 | IMPLEMENTED | active account authority + 탭/드래그 + 조합 필터/검색/즐겨찾기 |
| SPECIAL 해금 | IMPLEMENTED | `main_01_020` NORMAL_CLEAR 기준 |
| NORMAL_CLEAR 후 2배속 | IMPLEMENTED | first-completion 범위에 실제 연결된 상태 |
| 소탕 | IMPLEMENTED | guest/account save authority 및 eligibility 경로 존재 |
| 도감 | IMPLEMENTED | 미획득/미발견 은폐, 전략 정보, account active progress read authority 연결 |
| 메인 스토리 12장면 | IMPLEMENTED | 4장 × intro/prelude/outro, skip/auto-skip, solo/trusted/coop routing |
| PvE 2인 협동 | IMPLEMENTED / HUMAN QA PENDING | 스테이지 문맥에서 solo/friend/public 선택, 참가코드 guest, 친구 account, 공개 account 경로와 퀵 메시지/보상 authority 존재 |
| 친구/초대/최근 사용자 | IMPLEMENTED / HUMAN QA PENDING | social graph, invite, block, presence 구현 축 존재 |
| PvP 1v1 casual/ranked/friendly | IMPLEMENTED / HUMAN QA PENDING | actual scenes/server authority/MMR/tier/leaderboard/reward 구현 |
| PvP 2v2 casual/friendly | IMPLEMENTED / HUMAN QA PENDING | actual 2v2 matchmaking/battle/friendly scene 등록. ranked 2v2는 범위 밖 |
| casual Gold 3판 allowance | IMPLEMENTED | 플레이 제한이 아니라 Gold 지급만 공유 3판 제한. 무제한 queue 원칙 유지 |
| guest/login/save/migration/delete | IMPLEMENTED / HUMAN RECOVERY QA PENDING | guest save v15, account save, GIS/auth, reversible migration/delete 경로 존재 |
| 접근성/VFX/저사양 | IMPLEMENTED / HUMAN QA PENDING | shake/flash/motion/LOW/VFX LOW/battery 정책. simulation은 독립 |
| achievement/profile cosmetics | IMPLEMENTED | 일반/숨김/전투 attribution/season/event/record 보상 연결 |
| production asset runtime pipeline | CODE-WIRED / CI GREEN | 129 form + enemy/boss + battlefield/audio 계약, APPROVED gate, active F1/F2/F3 resolver, Deck portrait, Battle KB/Death consumer 연결 |
| production art/motion/audio 실자산 | **MAJOR GAP** | production candidate는 아직 0개이며 대표 vertical slice도 `AWAITING_ART`. 실제 최종 자산 제작·검수·웹 제공이 남음 |

## 이번 감사 이후 발견하고 수정한 실제 단절

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

### 4. direct TypeScript ESM import 실패

`battle-vfx-density.ts`의 직접 Node 테스트 dependency import를 `.ts` 명시 경로로 수정했다.

### 5. 스테이지 문맥 협동 진입 단절

정본은 `SOLO_OR_COOP` 스테이지에서 혼자/친구/공개 협동을 선택하도록 되어 있었지만, 실제 카드에서는 전투와 소탕만 직접 제공하고 협동은 별도 상위 화면에서 전장을 다시 골랐다.

`StageSortieModeScene`을 추가해 현재 stage id를 유지한 채 다음을 선택하도록 연결했다.

- solo
- guest code coop
- account friend coop
- account public coop

소탕은 기존 stage card authority를 유지한다.

CI #905 전체 GREEN.

### 6. 메인/허브의 협동 authority 우회와 legacy navigation 중복

스테이지 문맥 출정이 생긴 뒤에도 다음 과거 진입점이 남아 있었다.

- 메인 메뉴 `2인 협동 -> coop-lobby` 직접 진입
- 출정 허브 `공개 협동 -> public-coop-matchmaking` stage-agnostic 직접 진입
- `navigation-scenes.ts`의 사용되지 않는 guest-only `StageHubScene`/`StageSelectScene`

이를 정리했다.

현재 player-facing 협동 흐름은:

```text
main / 출정
  -> stage-hub
  -> stage-select
  -> SOLO_OR_COOP stage
  -> sortie-mode
     -> solo / friend / public
```

게스트 코드 협동 runtime은 `sortie-mode`가 선택 stage를 넘기는 전용 guest 경로로만 유지한다.

`navigation-scenes.ts`는 Boot/MainMenu만 남겼고, 스테이지 UI 테스트들도 실제 dedicated runtime source를 검사한다.

CI #907 전체 GREEN.

### 7. Production asset 계약과 실제 runtime consumer 단절

placeholder를 최종 자산으로 직접 덧칠하지 않기 위한 production pipeline을 추가했다.

- 43명 × F1/F2/F3 = 129 form 요구사항
- enemy/boss 전체 요구사항
- battlefield/audio 요구사항
- `AWAITING_ART -> READY_FOR_REVIEW -> APPROVED` lifecycle
- `APPROVED`만 runtime 사용
- 미승인 대상은 기존 placeholder fallback
- Boot runtime strip preload

추가 코드 대조에서 문서상 active form mirror가 연결된 것으로 적혀 있었지만 실제 `resolveUnitArt()`가 F1 fallback만 보던 누락도 발견했다. 현재는 explicit form → active visual-form mirror → canonical F1 순서로 고쳤다.

또한:

- `DeckScene`의 별도 `UNIT_ART / ART_BY_ID / ART_FAMILIES` portrait resolver 제거
- 선택된 form을 production resolver에 명시 전달
- `BattleScene`이 production Knockback/Death strip을 실제 state rendering에서 소비
- authored Death가 있을 때 placeholder용 generic 회전/페이드가 덮어쓰지 않도록 분리
- strip별 frameHeight 기준 sprite scale 갱신
- motion/frame mapping을 `production-motion.ts`로 분리해 회귀 테스트 고정

초기 계약 CI #908 및 runtime integration CI #914 전체 GREEN.

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

### A. 실제 Production asset vertical slice

runtime pipeline과 승인 gate는 연결됐다. 이제 가장 큰 플레이어 체감 공백은 실제 자산이다.

첫 대표 묶음은 다음을 대상으로 한다.

- 징집병 F1/F2/F3
- 일반 적 대표 1종
- 보스 대표 1종
- 첫 전장 배경
- Chapter 1 BGM
- battle core SFX

대표 세트에서 먼저 검증할 항목:

- 캐릭터별 production identity
- F1/F2/F3 실루엣 차이
- attack contact frame
- Knockback/Death readability
- 전장과 유닛 명도 대비
- BGM/SFX bus 및 autoplay 정책
- 저사양/접근성 대체 동작

현재 모든 예약은 `AWAITING_ART`이며, 실제 자산을 만들었다는 허위 상태는 없다. 특히 S/SS는 사용자 검수 없이 임의 승인하지 않는다.

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

### C. 남은 UI productization / 문서 정리

legacy StageHub/StageSelect 중복은 제거됐다.

현재 남은 대표 항목은 다음이다.

- 편성 `최근 획득`을 만들려면 실제 acquisition timestamp/history authority 필요
- 검색은 현재 브라우저 prompt 기반이므로 dedicated in-game text input은 polish 후보
- `docs/IMPLEMENTATION_STATUS.md`의 오래된 PvP/status 서술 갱신
- 실제 모바일/데스크톱 viewport에서 버튼/텍스트 배치 사람 검수

이 항목들은 production 실자산과 실제 사람 QA보다 우선도가 낮다.

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

## 통합 검증 메모

최근 자동 gate:

- CI #903: roster/browser + active progress surface 묶음 전체 GREEN
- CI #905: stage-context sortie routing 전체 GREEN
- CI #907: canonical coop entry + legacy navigation cleanup 전체 GREEN
- CI #908 / run `33517401836`: initial production asset contract 전체 GREEN
- CI #914 / run `33564942315`: active form + Deck resolver + Battle production KB/Death runtime integration 전체 GREEN

각 GREEN은 typecheck, content schema, simulation, server protocol/tests, client diagnostics/full suite, production build를 포함한다.

CI가 green이어도 사람 플레이가 없으면 각 구현 문서는 `code-wired`, `automated CI GREEN`, 또는 `HUMAN QA PENDING` 상태를 유지한다.

first-completion을 release-ready에 가깝게 올리는 다음 대형 묶음은 **대표 production 실자산을 검수 가능한 vertical slice로 준비·승인하는 작업** 또는 **실제 브라우저/멀티기기 acceptance QA에서 발견된 기능 결함 수정**이 가장 가치가 크다.
