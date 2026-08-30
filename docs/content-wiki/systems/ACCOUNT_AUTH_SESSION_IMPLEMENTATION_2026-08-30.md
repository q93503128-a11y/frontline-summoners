# 계정 인증·세션 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_AUTH_SESSION_AND_CLIENT_STATE_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`
- `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`

이 문서는 authenticated account를 실제 HTTP 요청에 묶기 위한 **identity/session 경계, Bearer 인증 account API, client account 상태 foundation**을 기록한다.
Google OAuth callback 또는 이메일 인증 전송까지 완료됐다는 뜻은 아니다.

## 1. 기존 identity 저장 구조 재사용

초기 D1 migration부터 다음이 존재한다.

- `users`
- `auth_identities`
  - `provider`
  - `provider_subject`
  - `user_id`

이번 구현은 이를 폐기하거나 이메일/닉네임을 account id로 바꾸지 않는다.
내부 `user_id`가 canonical accountId 역할을 계속 맡는다.

서버가 지원할 verified identity provider 경계는 현재:

- `google`
- `email`

이다.

`resolveOrCreateUserForVerifiedIdentity`는 **이미 외부 proof 검증이 끝난 identity만 받는 내부 함수**다.
현재 public HTTP 요청이 provider/subject만 자기신고해서 계정을 만드는 route는 없다.

동일 `(provider, provider_subject)` 생성 race에서는 D1 unique key를 기준으로 기존 identity를 다시 읽어 하나의 user로 수렴한다.
신규 user가 만들어지면 canonical account save v2도 초기화한다.

## 2. auth session 저장

migration:
- `apps/server/migrations/0007_auth_sessions.sql`

canonical table:
- `auth_sessions`

필드:

- `session_id`
- `user_id`
- `token_hash`
- `expires_at`
- `revoked_at`
- `created_at`
- `last_seen_at`

원문 Bearer token은 DB에 저장하지 않는다.

세션 token:

- cryptographic random 32 bytes = 256 bits.
- client 전달 형태는 64자리 hex.
- DB lookup key는 SHA-256 `token_hash`.
- `token_hash` unique.
- 만료 또는 revoke된 session은 인증 principal로 해석하지 않는다.

`issueAuthSessionForVerifiedIdentity`는 provider proof 검증 뒤 호출할 내부 exchange boundary다.
실제 Google ID token 검증 또는 이메일 인증코드 검증은 다음 단계다.

## 3. 요청의 accountId 권위

authenticated account HTTP route는 request body/query의 accountId를 받지 않는다.

모든 계정 mutation은:

1. `Authorization: Bearer <session token>` 검증.
2. `auth_sessions`에서 `user_id` resolve.
3. resolve된 `principal.userId`만 account mutation authority에 전달.

순서로 처리한다.

따라서 클라이언트가 다른 accountId를 body에 넣어도 ownership 경계에 참여하지 않는다.
내부 accountId 자체도 현재 account HTTP 응답에 노출하지 않는다.

## 4. authenticated account HTTP surface

`apps/server/src/account-http.ts`

현재 공개 account route:

### `GET /api/account`

- valid Bearer session 필요.
- canonical account save v2를 load/initialize.
- 응답:
  - `state = AUTHENTICATED_ONLINE`
  - `revision`
  - `schemaVersion`
  - canonical `snapshot`

### `POST /api/account/meta`

server-authoritative:

- Base Lv
- +Lv
- evolution unlock
- form select
- deck set
- base weapon select

`expectedRevision` + `requestId`를 사용하며 기존 `META_PROGRESSION` receipt/CAS를 그대로 탄다.

### `POST /api/account/recruitment`

- 1/10회.
- server RNG.
- server wallet.
- duplicate +Lv/분해.
- 기존 `RECRUITMENT` receipt/CAS 사용.

### `POST /api/account/sweep`

- prior clear/stage policy/현재 availability 서버 재검증.
- ticket/reward/periodic charge server transaction.
- 기존 `SWEEP` receipt/CAS 사용.

### `POST /api/account/logout`

현재 Bearer session을 revoke한다.

### conflict/error

- 인증 없음/만료/revoke: `401 authentication_required`.
- revision mismatch: `409 revision_conflict`.
- 같은 idempotency key를 다른 business input에 재사용: `409 idempotency_conflict`.
- 잘못된 mutation: `400`.

CORS는 `Authorization` header를 허용하도록 확장했다.

## 5. 의도적으로 공개하지 않은 battle result route

아직 public route로 노출하지 않는다.

- MAIN battle result
- SPECIAL battle result
- record result

이 세 종류는 trusted battle completion registry/result proof가 연결되기 전까지 client가 결과 수치를 자기신고해서 호출할 수 없어야 한다.

기존 내부 mutation authority는 유지하지만 HTTP surface에서 import/호출하지 않는다.

## 6. client account 상태 foundation

`apps/client/src/account-network.ts`

정본의 세 상태를 실제 코드 타입으로 추가했다.

- `GUEST_LOCAL`
- `AUTHENTICATED_ONLINE`
- `AUTHENTICATED_OFFLINE_CACHE`

### session credential

- 현재 foundation은 Bearer token을 `sessionStorage`에 저장한다.
- 브라우저 영구 localStorage에는 token을 저장하지 않는다.
- 최종 Google/email 로그인 UX와 session rotation 정책이 정해지면 보안/수명 정책을 다시 검토한다.

### authenticated read cache

서버 snapshot은 localStorage에 **읽기 cache**로 둘 수 있다.

cache에는:

- server revision
- schemaVersion
- snapshot
- lastOnlineAtMs
- session token 자체가 아닌 SHA-256 session fingerprint

를 둔다.

현재 token과 fingerprint가 다른 cache는 offline account cache로 사용하지 않는다.
내부 accountId를 cache key로 노출할 필요가 없다.

### server 우선

세션 복구 시:

1. 서버 `GET /api/account` 성공 → `AUTHENTICATED_ONLINE`.
2. 네트워크 실패 → 같은 session fingerprint의 읽기 cache만 사용해 `AUTHENTICATED_OFFLINE_CACHE`.
3. `401` → token/cache 제거 후 `GUEST_LOCAL`.

cache timestamp가 더 최근이라는 이유로 서버 snapshot을 덮어쓰지 않는다.

## 7. offline mutation 금지

`AUTHENTICATED_OFFLINE_CACHE`는 읽기 전용이다.

현재 구현은:

- offline mutation journal 없음.
- queued economy mutation 없음.
- reconnect 시 재화 mutation 자동 재실행 없음.

account mutation은 반드시 `AUTHENTICATED_ONLINE`에서만 실행된다.

mutation의 `expectedRevision`은 caller가 임의로 넘기는 대신 현재 online remote state에서 파생한다.

`409 revision_conflict`가 오면 최신 account를 다시 읽지만 **원래 mutation을 자동 재실행하지 않고 오류를 caller에 다시 전달**한다.
따라서 모집/재화 소비를 조용히 두 번 실행하지 않는다.

## 8. 자동검증

추가 테스트:

- `apps/server/test/auth-session-authority.test.ts`
- `apps/server/test/account-http.test.ts`
- `apps/client/test/account-network.test.ts`

검사:

- Bearer token fixed 256-bit surface.
- SHA-256 token hash.
- DB plaintext token column 부재.
- expiry/revoke/user FK.
- google/email verified identity boundary.
- account route가 `principal.userId`만 사용.
- body accountId 비권위.
- proofless battle result public route 부재.
- client 3-state 타입.
- sessionStorage credential / fingerprinted read cache.
- online-only mutation.
- revision conflict refresh 후 자동 재실행 금지.
- offline mutation queue/journal 부재.

## 9. 아직 남은 인증/계정 연결

이번 단계에서 완료로 세지 않는 것:

- Google OAuth/OIDC proof 실제 검증 및 callback.
- 이메일 magic link/인증코드 발송·검증.
- 로그인/로그아웃/계정 전환 실제 Phaser UI.
- session rotation/renewal/revoke-all-devices 정책.
- production credential transport를 Bearer/sessionStorage로 확정하는 보안 검토.
- 게스트→빈 계정 이전 transaction/UX.
- 서버 진행과 게스트 진행 충돌 선택 UX.
- trusted solo/SPECIAL/record battle completion registry/result proof.
- 협동 room의 authenticated seat binding 및 completion reward 연결.
- progression reset/account delete.
- friend/block/PvP account data.

따라서 현재 상태는 **검증된 identity를 account에 묶고 session을 발급할 내부 경계 + session-authenticated account read/meta/recruitment/sweep API + client online/offline-cache 상태 foundation**까지다.
