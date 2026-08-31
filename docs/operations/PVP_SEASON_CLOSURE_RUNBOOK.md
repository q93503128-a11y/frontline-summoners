# PvP 시즌 종료·다음 시즌 전환 운영 런북

상태: `IMPLEMENTED_OPERATIONS_FLOW`

이 문서는 현재 서버의 PvP 시즌 종료를 실제 운영에서 안전하게 수행하는 정본 절차다.

핵심 원칙:

- 클라이언트는 시즌 종료를 실행할 수 없다.
- 내부 운영 API는 `PVP_OPERATIONS_TOKEN` Bearer 토큰 없이는 동작하지 않는다.
- 시즌 종료를 시작하면 공개 PvP 1v1/2v2 신규 매칭 참가를 먼저 닫는다.
- 이미 생성된 경기는 강제 종료하지 않고 정상 종료/VOID 처리까지 기다린다.
- 최종 순위는 기존 `finalizePvpSeason` 정본 로직으로 한 번만 스냅샷한다.
- 소프트 리셋은 다음 시즌 ID가 코드에 반영된 배포 이후에만 허용한다.
- 중간 단계가 실패해도 동일 요청을 다시 수행해 복구할 수 있도록 단계별 상태를 D1에 저장한다.

---

## 1. 사전 준비

Cloudflare Worker secret에 충분히 긴 운영 토큰을 등록한다.

```bash
cd apps/server
npx wrangler secret put PVP_OPERATIONS_TOKEN
```

운영 API 기본 경로:

```text
/api/internal/pvp-season-operations
```

모든 요청:

```text
Authorization: Bearer <PVP_OPERATIONS_TOKEN>
```

토큰이 설정되지 않은 배포에서는 운영 API가 `503 pvp_operations_token_not_configured`로 닫힌다.

---

## 2. 현재 상태 확인

```http
GET /api/internal/pvp-season-operations
```

주요 필드:

- `codeSeasonId`: 현재 배포 코드의 `PVP_CURRENT_SEASON_ID`
- `seasonId`: D1 운영 래치가 추적 중인 시즌
- `state`: `OPEN | DRAINING | CLOSED_PENDING_DEPLOY`
- `queueOpen`: 공개 PvP 신규 매칭 허용 여부
- `nextSeasonId`: 예약된 다음 시즌
- `liveMatches`: 아직 종료되지 않은 공개 PvP 경기
- `liveQueueEntries`: 아직 남은 QUEUED/PAIRING 참가자
- `readyToFinalize`: 최종 순위 고정 가능 여부
- `deployNextSeasonRequired`: 다음 시즌 코드 배포가 필요한 상태인지
- `readyToRoll`: 소프트 리셋/전환 실행 가능 여부
- `closure`: 이미 생성된 시즌 종료 스냅샷

`state=OPEN`, `seasonId=codeSeasonId`, `queueOpen=true`가 정상 운영 상태다.

---

## 3. 시즌 정산 시작

예: `preseason_v1`을 닫고 `season_1`으로 넘어가는 경우

```http
POST /api/internal/pvp-season-operations/begin
Content-Type: application/json

{
  "nextSeasonId": "season_1"
}
```

성공 시:

- 상태가 `DRAINING`으로 변경된다.
- 공개 PvP 1v1/2v2 신규 참가가 즉시 차단된다.
- 아직 매칭되지 않은 `QUEUED` 행은 제거된다.
- 이미 생성/진행 중인 경기는 그대로 마무리한다.

친선전은 시즌 MMR 정산 대상이 아니므로 이 공개 큐 래치와 별도로 유지된다.

이 단계는 같은 `nextSeasonId`로 재요청해도 안전하다.

---

## 4. 드레인 확인

상태 API를 반복 확인한다.

```http
GET /api/internal/pvp-season-operations
```

다음이 모두 만족되어야 한다.

```text
state = DRAINING
liveMatches = 0
liveQueueEntries = 0
readyToFinalize = true
```

`liveMatches > 0`이면 해당 경기가 정상 종료되거나 서버 판정으로 `VOID`될 때까지 기다린다.

정산을 취소해야 하고 아직 최종 스냅샷을 생성하지 않았다면:

```http
POST /api/internal/pvp-season-operations/reopen
```

`CLOSED_PENDING_DEPLOY` 이후에는 되돌릴 수 없다.

---

## 5. 최종 순위 고정

```http
POST /api/internal/pvp-season-operations/finalize
```

이 단계에서 정본 `finalizePvpSeason`이 실행되어:

- 시즌 종료 시각 고정
- 전체 참가자 수 고정
- 배치 완료 참가자 수 고정
- 최종 MMR/최고 MMR/최종 티어 고정
- 승/패/무 기록 고정
- `ROW_NUMBER()` 기반 최종 순위 고정
- 시즌 명예 보상 판정의 입력값 고정

이후 상태는:

```text
CLOSED_PENDING_DEPLOY
```

이다.

동일 시즌/동일 다음 시즌으로 `finalize`를 다시 호출해도 기존 closure를 재사용한다.

---

## 6. 종료 스냅샷 검증

상태 API에서 `closure`가 존재하는지 확인한다.

반드시 확인할 값:

- `closure.seasonId` = 종료한 시즌
- `closure.nextSeasonId` = 의도한 다음 시즌
- `closure.rolledAtMs` = `null`
- `closure.playerCount`
- `closure.placementPlayerCount`

이 시점부터 시즌 결과는 `pvp_season_results`에 보존되며, 기존 시즌 명예 수령/장식 복구 경로가 이 결과를 사용한다.

---

## 7. 다음 시즌 코드 배포

`apps/server/src/pvp-authority.ts`의:

```ts
export const PVP_CURRENT_SEASON_ID = '...';
```

을 `nextSeasonId`와 정확히 동일하게 변경한 뒤 정상 배포한다.

예:

```ts
export const PVP_CURRENT_SEASON_ID = 'season_1';
```

중요:

- closure 생성 전에 이 값을 먼저 변경하지 않는다.
- `CLOSED_PENDING_DEPLOY` 동안 공개 PvP 큐는 닫혀 있으므로 배포 중 새 시즌/구 시즌 참가자가 섞이지 않는다.
- 배포 후에도 아직 소프트 리셋을 실행하기 전까지 큐는 계속 닫혀 있다.

배포 후 상태 API에서:

```text
codeSeasonId = nextSeasonId
readyToRoll = true
```

인지 확인한다.

---

## 8. 소프트 리셋 및 다음 시즌 활성화

```http
POST /api/internal/pvp-season-operations/roll
```

정본 리셋 공식:

```text
nextSeasonMMR = 1000 + (previousMMR - 1000) × 0.60
clamp = 800..1750
```

이 단계에서:

- `pvp_ratings.season_id`를 새 시즌으로 이동
- MMR 60% 압축
- `best_mmr`를 새 시작 MMR로 재설정
- 표시 티어 재계산
- 배치전 진행도 0
- 시즌 랭킹 승/패/무 0
- 일반전 승/패/무 0
- 구 시즌 매칭 큐 제거
- closure의 `rolled_at` 기록
- 운영 래치 `OPEN` 복귀
- 공개 PvP 매칭 재개

가 수행된다.

`roll` 도중 closure 쪽 처리는 성공하고 래치 갱신만 실패한 경우에도 재요청하면 복구하도록 구현되어 있다.

---

## 9. 최종 검증

다시 상태 확인:

```http
GET /api/internal/pvp-season-operations
```

정상 종료 상태:

```text
state = OPEN
queueOpen = true
seasonId = codeSeasonId = 새 시즌 ID
nextSeasonId = null
liveMatches = 0
liveQueueEntries = 0
```

그리고 일반 사용자 API에서:

- `/api/pvp/me`
- `/api/pvp/leaderboard`
- `/api/pvp/season`
- 공개 1v1 매칭
- 공개 2v2 매칭

을 확인한다.

---

## 10. 절대 금지 순서

다음은 하지 않는다.

1. 공개 큐를 연 채 `finalize` 시도
2. 진행 중 경기 존재 상태에서 강제로 시즌 스냅샷 변경
3. closure 생성 전에 새 `PVP_CURRENT_SEASON_ID` 배포
4. 새 시즌 코드가 배포되지 않은 상태에서 `roll` 우회
5. D1에서 `pvp_ratings`를 수동 UPDATE하여 시즌 이동
6. `pvp_season_results`를 수동 덮어써 최종 순위 수정

운영 API가 이 순서 대부분을 서버에서 거부하도록 되어 있다.
