# 계정 인증·세션 구현 메모 — 2026-08-30

상태: `IMPLEMENTED_GOOGLE_PROOF_SESSION_AND_LOGIN_FOUNDATION`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_V2_IMPLEMENTATION_2026-08-30.md`
- `docs/content-wiki/systems/ACCOUNT_MUTATION_IDEMPOTENCY_IMPLEMENTATION_2026-08-30.md`

이 문서는 authenticated account를 실제 HTTP 요청에 묶기 위한 **provider proof, identity/session 경계, Bearer 인증 account API, client account 상태 및 Google 로그인 UI foundation**을 기록한다.

현재 Google provider proof는 실제 ID token 서명/claim 검증까지 구현했다. 다만 repository에는 production Google Cloud client ID와 authorized origin 값을 하드코딩하지 않으므로, 배포 환경의 `GOOGLE_CLIENT_ID` / `AUTH_ALLOWED_ORIGINS` 설정 없이는 Google 로그인 버튼이 활성화되지 않는다. 이메일 인증 발송/검증은 아직 구현하지 않았다.

## 1. identity 저장 구조

초기 D1 migration부터 다음이 존재한다.

- `users`
- `auth_identities`
  - `provider`
  - `provider_subject`
  - `user_id`

이메일/닉네임을 account id로 사용하지 않는다.
내부 `user_id`가 canonical accountId 역할을 맡는다.

verified identity provider 경계:

- `google`
- `email`

`resolveOrCreateUserForVerifiedIdentity`는 **외부 proof 검증이 끝난 identity만 받는 내부 함수**다.
public HTTP 요청이 임의의 provider/subject를 자기신고해 계정을 만드는 route는 없다.

Google의 `provider_subject`는 ID token의 안정적인 `sub` claim이다. 이메일 주소는 Google 계정의 canonical identity key로 사용하지 않는다.

동일 `(provider, provider_subject)` 생성 race에서는 D1 unique key를 기준으로 기존 identity를 다시 읽어 하나의 user로 수렴한다.
신규 user가 만들어지면 canonical account save v2도 초기화한다.

## 2. Google ID token provider proof

`apps/server/src/google-id-token-authority.ts`

client가 Google Identity Services에서 받은 credential은 브라우저에서 신뢰하지 않고 서버에서 다시 검증한다.

검증:

- compact JWT 3-segment 형식.
- header `alg = RS256`.
- non-empty `kid`.
- Google JWK Set: `https://www.googleapis.com/oauth2/v3/certs`.
- JWK가 RSA signature key인지 확인.
- WebCrypto `RSASSA-PKCS1-v1_5` + SHA-256 signature verify.
- `iss`는 `accounts.google.com` 또는 `https://accounts.google.com`만 허용.
- `aud`가 서버의 `GOOGLE_CLIENT_ID`와 일치해야 함.
- multi-audience token이면 `azp`도 해당 client ID와 일치해야 함.
- `exp` 만료 거부.
- optional `iat`/`nbf`의 과도한 미래 시각 거부.
- `sub`를 최종 Google provider subject로 사용.

Google public key rotation 대응:

- provider `Cache-Control: max-age`를 따라 JWK를 메모리 cache.
- 헤더가 없으면 5분 fallback.
- 비정상적으로 긴 cache는 24시간 상한.
- 현재 cache에 `kid`가 없으면 JWKS를 1회 강제 refresh한 뒤 다시 탐색.

검증 실패:

- malformed/wrong audience/wrong issuer/expired/bad signature/unknown key → credential 거부.
- Google JWKS 자체를 읽을 수 없는 provider 장애는 invalid credential과 구분해 일시적 unavailable로 처리.

## 3. Google auth HTTP exchange

`apps/server/src/auth-http.ts`

공개 auth route:

### `GET /api/auth/config`

- Google 로그인 활성 여부와 public web client ID를 반환.
- `GOOGLE_CLIENT_ID` 미설정이면 `enabled = false`.
- accountId/userId는 반환하지 않는다.
- `Cache-Control: no-store`.

### `POST /api/auth/google`

입력:

```text
credential = Google Identity Services ID token
```

서버 처리:

1. browser Origin gate.
2. `GOOGLE_CLIENT_ID` 존재 확인.
3. Google ID token 서명/claim 검증.
4. 검증된 `sub`를 `google` provider subject로 identity binding.
5. account save v2 load/initialize.
6. 7일 auth session 발급.
7. client에 session token과 expiry 반환.

브라우저가 `sub`, email, userId, accountId를 직접 제출해 identity를 확정하는 경로는 없다.

### auth Origin / CORS

auth proof endpoint는 기존 게임 API의 wildcard CORS에 의존하지 않는다.

허용:

- API와 same-origin.
- 또는 `AUTH_ALLOWED_ORIGINS`의 comma-separated exact origin.
- Origin header가 없는 non-browser/server request.

browser Origin이 allowlist 밖이면 `403 auth_origin_denied`.
preflight/response의 `Access-Control-Allow-Origin`도 허용된 exact origin만 돌려준다.

따라서 배포 시 Google Cloud Web client의 Authorized JavaScript origins와 서버 `AUTH_ALLOWED_ORIGINS`를 실제 프론트엔드 origin에 맞춰 설정해야 한다.

## 4. auth session 저장

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

Google proof 성공 뒤 `issueAuthSessionForVerifiedIdentity`를 호출한다.
email provider는 동일 verified identity/session 경계를 재사용할 예정이지만 proof transport는 아직 없다.

## 5. 요청의 accountId 권위

authenticated account HTTP route는 request body/query의 accountId를 받지 않는다.

모든 계정 mutation은:

1. `Authorization: Bearer <session token>` 검증.
2. `auth_sessions`에서 `user_id` resolve.
3. resolve된 `principal.userId`만 account mutation authority에 전달.

순서로 처리한다.

클라이언트가 다른 accountId를 body에 넣어도 ownership 경계에 참여하지 않는다.
내부 accountId 자체도 현재 account HTTP 응답에 노출하지 않는다.

## 6. authenticated account HTTP surface

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

## 7. 의도적으로 공개하지 않은 battle result route

아직 public route로 노출하지 않는다.

- MAIN battle result
- SPECIAL battle result
- record result

이 세 종류는 trusted battle completion registry/result proof가 연결되기 전까지 client가 결과 수치를 자기신고해서 호출할 수 없어야 한다.

기존 내부 mutation authority는 유지하지만 HTTP surface에서 import/호출하지 않는다.

## 8. client account 상태 foundation

`apps/client/src/account-network.ts`

정본의 세 상태를 실제 코드 타입으로 사용한다.

- `GUEST_LOCAL`
- `AUTHENTICATED_ONLINE`
- `AUTHENTICATED_OFFLINE_CACHE`

### session credential

- 현재 foundation은 Bearer token을 `sessionStorage`에 저장한다.
- 브라우저 영구 localStorage에는 token을 저장하지 않는다.
- session renewal/rotation 및 최종 credential transport 정책은 후속 보안 검토 대상이다.

### authenticated read cache

서버 snapshot은 localStorage에 **읽기 cache**로 둘 수 있다.

cache:

- server revision
- schemaVersion
- snapshot
- lastOnlineAtMs
- session token 자체가 아닌 SHA-256 session fingerprint

현재 token과 fingerprint가 다른 cache는 사용하지 않는다.

### server 우선

세션 복구 시:

1. 서버 `GET /api/account` 성공 → `AUTHENTICATED_ONLINE`.
2. 네트워크 실패 → 같은 session fingerprint의 읽기 cache만 사용해 `AUTHENTICATED_OFFLINE_CACHE`.
3. `401` → token/cache 제거 후 `GUEST_LOCAL`.

cache timestamp가 더 최근이라는 이유로 서버 snapshot을 덮어쓰지 않는다.

## 9. Google 로그인 Phaser UI

`apps/client/src/account-scene.ts`
`apps/client/src/google-login.ts`

메인 메뉴에서 `계 정`으로 진입한다.

계정 화면:

- 현재 `GUEST_LOCAL` / `AUTHENTICATED_ONLINE` / `AUTHENTICATED_OFFLINE_CACHE` 상태 표시.
- authenticated 상태에서 server revision 표시.
- offline cache는 읽기 전용이라는 경고 표시.
- 서버 새로고침.
- logout.

Google 로그인:

1. `/api/auth/config`에서 server-configured Google client ID 확인.
2. Google 미설정이면 임의 fallback login을 만들지 않고 `아직 서버에 설정되지 않음` 표시.
3. 공식 Google Identity Services 스크립트 `https://accounts.google.com/gsi/client` 로드.
4. `google.accounts.id.initialize` + `renderButton` 사용.
5. callback credential을 `/api/auth/google`로 전송.
6. 서버 proof 성공 뒤 받은 Frontline auth session을 기존 account state machine에 연결.
7. server account snapshot을 다시 읽어 `AUTHENTICATED_ONLINE` 진입.

Google DOM button은 scene shutdown/destroy 때 제거한다.

현재 계정 화면은 basic sign-in/status/logout foundation이다. 게스트 진행 이전/충돌 선택이나 여러 로그인 계정 전환 UX까지 구현됐다는 뜻은 아니다.

## 10. offline mutation 금지

`AUTHENTICATED_OFFLINE_CACHE`는 읽기 전용이다.

- offline mutation journal 없음.
- queued economy mutation 없음.
- reconnect 시 재화 mutation 자동 재실행 없음.
- account mutation은 `AUTHENTICATED_ONLINE`에서만 실행.
- `expectedRevision`은 current online remote state에서 파생.
- `409 revision_conflict` 시 최신 account를 다시 읽지만 원래 mutation을 자동 재실행하지 않음.

## 11. 자동검증

관련 테스트:

- `apps/server/test/auth-session-authority.test.ts`
- `apps/server/test/account-http.test.ts`
- `apps/server/test/google-id-token-authority.test.ts`
- `apps/server/test/auth-http.test.ts`
- `apps/client/test/account-network.test.ts`
- `apps/client/test/google-login.test.ts`

검사:

- Bearer token fixed 256-bit surface.
- SHA-256 token hash / DB plaintext token column 부재.
- expiry/revoke/user FK.
- account route가 `principal.userId`만 사용.
- body accountId 비권위.
- proofless battle result public route 부재.
- Google RS256 valid signature acceptance.
- wrong audience / expired / tampered signature rejection.
- stable `sub` identity 사용.
- JWK Cache-Control max-age 처리.
- exact Origin auth CORS gate.
- Google client ID 미설정 시 auth route fail-closed.
- official GIS script/credential exchange wiring.
- client 3-state 타입.
- sessionStorage credential / fingerprinted read cache.
- online-only mutation.
- revision conflict refresh 후 자동 재실행 금지.

구현 기준:
- `5a45fc2d2960a3ccad19ccfc933dcadb5ced8d9e` — Google ID-token proof + auth HTTP + account login scene.
- CI #760에서 typecheck/schema/sim/server/client/build 통과 확인.

## 12. 아직 남은 인증/계정 연결

이번 단계에서 완료로 세지 않는 것:

- production Google Cloud Web client 생성/동의화면/Authorized JavaScript origins 설정.
- 배포 환경 `GOOGLE_CLIENT_ID` / `AUTH_ALLOWED_ORIGINS` 실제 값 설정.
- 이메일 magic link/인증코드 발송·검증.
- guest→빈 account 이전 transaction/UX.
- 서버 진행과 guest 진행 충돌 선택 UX.
- 다중 로그인 계정 전환 UX.
- session rotation/renewal/revoke-all-devices 정책.
- production credential transport를 Bearer/sessionStorage로 최종 확정하는 보안 검토.
- 기존 Growth/Recruitment/Deck/BaseWeapon 등 gameplay scene의 account-state authority 분기.
- trusted solo/SPECIAL/record battle completion registry/result proof.
- 협동 room의 authenticated seat binding 및 completion reward 연결.
- progression reset/account delete.
- friend/block/PvP account data.

따라서 현재 상태는 **Google provider proof + Google 로그인/account scene + verified identity/session + session-authenticated account API + client online/offline-cache foundation**까지다. 실제 배포 configuration과 나머지 account gameplay wiring/trusted battle proof까지 포함한 production 계정 시스템 완료로 세지 않는다.
