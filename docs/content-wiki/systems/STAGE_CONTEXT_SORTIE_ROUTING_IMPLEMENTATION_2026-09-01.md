# 스테이지 문맥 출정 방식 라우팅 구현 — 2026-09-01

상태: **DESIGN_TARGET / code-wired, integrated CI + human browser/multiplayer QA pending**

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/UI_UX_ENCYCLOPEDIA.md`
- `docs/content-wiki/systems/MULTIPLAYER_SOCIAL_PVP.md`

## 문제

UI/UX 정본은 `SOLO_OR_COOP` 스테이지의 입장 문맥에서 다음 선택을 제공하도록 정의한다.

- 혼자 시작
- 친구 초대
- 공개 협동
- 소탕(조건 충족 시)

기존 실제 스테이지 카드는 `전투 + 소탕`까지만 직접 제공했고, 협동은 별도 상위 허브/소셜 화면으로 이동한 뒤 전장을 다시 고르는 흐름이었다.

협동 자체의 서버 authority는 이미 구현돼 있었지만 **현재 보고 있던 스테이지 문맥이 협동 진입까지 이어지지 않는 UX 단절**이 남아 있었다.

## 구현

### 1. `StageSortieModeScene`

신규 scene `sortie-mode`를 추가했다.

`SOLO_OR_COOP` 스테이지의 전투 버튼은 이 scene으로 들어가며 다음 정보를 그대로 유지한다.

- stage id
- 스테이지 이름/난이도/길이
- `coopStatScaling`
- 현재 active progress authority
- unlock 상태
- 현재 편성 제한 충족 여부

이 scene은 전투/보상/save authority를 새로 만들지 않는다.

### 2. 솔로

`혼자 시작`은 기존 솔로 전투로 이어진다.

- pre-stage story가 있고 auto-skip 대상이 아니면 `story -> battle`
- 아니면 `battle`
- 로그인 계정의 offline cache 상태에서는 서버 전투를 시작하지 않고 account 화면으로 유도

따라서 기존 trusted battle / guest battle authority를 그대로 유지한다.

### 3. 로그인 계정 친구 협동

계정 online 상태에서는 현재 stage를 유지한 채 친구 목록을 불러온다.

선택한 친구에 대해 기존 social authority를 그대로 사용한다.

```text
createFriendCoopInvite(currentStageId, friendCode)
  -> friend-coop-lobby
```

친구 메뉴에서 다시 전장을 순환 선택할 필요가 없다.

### 4. 로그인 계정 공개 협동

현재 stage id로 기존 공개 매칭 queue에 바로 참가한다.

```text
joinPublicCoopMatchmaking(currentStageId)
  -> public-coop-matchmaking
```

매칭/방 생성/계정 좌석/보상 authority는 기존 서버 구현을 그대로 사용한다.

### 5. 게스트 코드 협동

게스트는 기존 참가코드 기반 협동을 유지한다.

`sortie-mode`에서 선택한 stage id를 `preferredStageId`로 guest coop lobby에 넘겨 기존 picker가 해당 전장 페이지를 우선 보여주도록 연결했다.

새 guest room protocol이나 별도 save path를 만들지 않았다.

### 6. SOLO_ONLY

`SOLO_ONLY` 스테이지는 불필요한 중간 화면을 추가하지 않는다.

기존처럼 스테이지 카드에서 optional pre-story를 거쳐 바로 solo battle로 들어간다.

### 7. 소탕

소탕은 기존 `StageSelectScene`의 버튼/eligibility/save authority를 그대로 유지한다.

즉 이번 변경은 이미 존재하는 소탕 경로를 복제하지 않고, 실제 전투를 누른 `SOLO_OR_COOP` 스테이지에만 출정 방식 선택을 삽입한다.

## 회귀 보호

신규 테스트:

- `apps/client/test/stage-sortie-mode-routing.test.ts`

검사 범위:

- `SOLO_OR_COOP`만 sortie picker를 경유
- scene registration
- active progress authority
- unlock/formation 재검사
- account offline read-only 방어
- solo pre-story 유지
- friend invite에 정확한 current stage id 사용
- public matchmaking에 정확한 current stage id 사용
- guest code coop에서 선택 stage 문맥 유지
- 스테이지 목록 복귀 시 정확한 collection/page 유지

## 의도적으로 하지 않은 것

- 새 협동 protocol
- 새 보상 계산
- 새 account save 필드
- 새 friend graph
- guest 공개 매칭
- 2v2 ranked
- production character art

## 남은 검증

이 문서는 `TESTED`가 아니다.

통합 CI가 GREEN이어도 다음은 사람 QA가 필요하다.

- guest: 스테이지 카드 -> 친구 코드 협동 -> 같은 전장 페이지 -> 방 생성
- account: 스테이지 카드 -> 친구 초대 -> 상대 수락 -> 정확한 전장 방
- account: 스테이지 카드 -> 공개 협동 -> 정확한 stage queue -> 매칭
- pre-stage story가 solo/coop에서 중복 또는 누락되지 않는지
- 모바일 가로에서 세 버튼과 친구 목록 터치 영역
- offline cache에서 전투/협동 mutation이 발생하지 않는지
