# 협동 진입 정본화 — 2026-09-01

상태: **DESIGN_TARGET / code-wired, final integrated CI + human browser/multiplayer QA pending**

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/MULTIPLAYER_SOCIAL_PVP.md`
- `docs/content-wiki/systems/STAGE_CONTEXT_SORTIE_ROUTING_IMPLEMENTATION_2026-09-01.md`

## 정본 원칙

`SOLO_OR_COOP` 전장의 플레이어 진입 흐름은 **전장을 먼저 선택하고 그 전장 문맥에서** 다음 중 하나를 고르는 것이다.

1. 혼자 시작
2. 친구 초대
3. 공개 협동

게스트 코드 협동은 계정 친구/공개 매칭과 별도 authority를 유지한다.

## 발견한 실제 단절

### 1. 메인 메뉴 `2인 협동`이 게스트 전용 로비로 직행

`main.ts`의 보조 메뉴 버튼이 로그인 여부와 관계없이 `coop-lobby`를 직접 열고 있었다.

`coop-lobby`는 guest IndexedDB 진행과 guest 참가코드 protocol을 사용하는 전용 경로다.

따라서 로그인 계정에서도 이 버튼을 누르면 계정 서버 진행이 아닌 guest-local 협동 흐름을 볼 수 있었다.

### 2. 출정 허브의 stage-agnostic `공개 협동` 우회

전장 선택 전에 `public-coop-matchmaking`으로 직접 들어가는 버튼이 남아 있었다.

공개 매칭 scene 자체에서 전장을 다시 고를 수 있으므로 기능은 동작하지만, 정본의 `전장 -> 출정 방식` 흐름과 중복되고 현재 전장 문맥을 잃는다.

### 3. `navigation-scenes.ts` 안의 구형 StageHub/StageSelect 중복

실제 `main.ts`는 이미 다음 dedicated scene을 사용한다.

- `stage-hub-scene.ts`
- `story-stage-select-scene.ts`

하지만 `navigation-scenes.ts` 안에도 오래된 `StageHubScene`/`StageSelectScene`이 남아 있었다.

그 구형 구현은 `loadGuestProgress()`를 직접 사용하고 전투를 바로 시작하는 과거 구조라, 향후 잘못 import될 경우 active account authority와 stage-context coop routing을 다시 우회할 수 있었다.

## 구현

### 메인 메뉴

보조 메뉴의 `2인 협동 -> coop-lobby` 직행을 제거했다.

현재는:

```text
협동 출정 -> stage-hub
```

로 들어간다.

이후 실제 협동 가능 스테이지를 고르면 `sortie-mode`에서 guest/account authority에 맞는 협동 방식이 열린다.

### 출정 허브

stage-agnostic `공개 협동` 버튼을 제거했다.

허브 설명도 협동 가능 스테이지에서 혼자/친구/공개 협동을 선택한다는 정본 흐름으로 맞췄다.

공개 매칭 runtime scene 자체는 삭제하지 않는다. `StageSortieModeScene`이 정확한 `stageId`로 기존 queue authority를 호출하는 데 계속 사용한다.

### navigation core 정리

`navigation-scenes.ts`는 이제 다음만 소유한다.

- `BootScene`
- `MainMenuScene`

구형 중복 `StageHubScene`/`StageSelectScene`과 이에 딸린 guest-only imports/전장 UI 코드를 제거했다.

실제 출정 scene의 유일한 구현은 dedicated files다.

## authority 보존

이번 변경에서 새 protocol/save/reward path를 만들지 않았다.

- guest code coop -> 기존 `coop-lobby`
- account friend coop -> 기존 social invite + friend coop lobby
- account public coop -> 기존 public matchmaking queue
- solo -> 기존 guest/trusted battle
- offline account cache -> mutation 차단

단지 **플레이어가 그 authority를 잘못 우회해 들어갈 수 있던 진입점**을 제거했다.

## 회귀 보호

신규:

- `apps/client/test/canonical-coop-entry-routing.test.ts`

갱신:

- `apps/client/test/active-progress-surfaces-wiring.test.ts`
- `apps/client/test/stage-enemy-codex-navigation.test.ts`
- `apps/client/test/coop-client-runtime.test.ts`
- `apps/client/test/coop-matchmaking.test.ts`
- `apps/client/test/battle-ui-wiring.test.ts`

검사 범위:

- main menu coop shortcut이 guest lobby로 직행하지 않음
- stage hub가 public matchmaking으로 직접 가지 않음
- `StageSortieModeScene`이 혼자/친구/공개 협동의 player-facing 선택 authority임
- guest coop runtime은 guest code-coop 구현으로 계속 등록됨
- `navigation-scenes.ts`에 legacy StageHub/StageSelect가 다시 생기지 않음
- 실제 dedicated hub/select가 active progress를 사용함
- 스테이지 적 도감/영구보상/난이도/모바일 hitbox 검사가 실제 `stage-select-scene.ts`를 검사함

## 통합 CI 1차 결과

CI #906에서 다음은 즉시 통과했다.

- typecheck: PASS
- content schema: PASS
- simulation: PASS
- server co-op protocol/tests: PASS

client diagnostics는 네 테스트 파일이 실패했다.

원인은 기능 회귀가 아니라 삭제한 구형 `navigation-scenes.ts`의 StageHub/StageSelect를 소스 검사 대상으로 계속 읽던 과거 테스트 계약이었다.

- `stage-enemy-codex-navigation.test.ts`
- `coop-client-runtime.test.ts`
- `coop-matchmaking.test.ts`
- `battle-ui-wiring.test.ts`

테스트의 검증 의미는 유지한 채 실제 runtime source로 이동했다.

- stage hub 검증 -> `stage-hub-scene.ts`
- stage card/도감/보상/난이도 검증 -> `stage-select-scene.ts`
- coop entry 검증 -> `stage-sortie-mode-scene.ts`
- registry 검증 -> `main.ts`

수정 HEAD에서 production build를 포함한 전체 CI를 다시 검증한다.

## TESTED 승격 조건

자동 CI green만으로 `TESTED`로 올리지 않는다.

사람 QA가 다음을 확인해야 한다.

- guest main -> 협동 출정 -> 전장 -> 친구 코드 협동
- account online main -> 협동 출정 -> 전장 -> 친구 초대
- account online main -> 협동 출정 -> 전장 -> 공개 협동
- account offline cache에서 전투/협동 mutation이 시작되지 않음
- 스테이지 복귀/스토리/소탕 흐름에 회귀 없음
- 모바일 가로에서 메인/출정 허브 버튼 겹침 없음
