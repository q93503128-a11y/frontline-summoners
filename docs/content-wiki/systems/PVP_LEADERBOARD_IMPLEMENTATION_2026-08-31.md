# PvP 랭킹 순위표 구현 기록 — 2026-08-31

상태: `IMPLEMENTED_UNVERIFIED_BATCH`

현재 정규 랭킹 순위표 경로는 기획서의 다음 3개 조회 축을 실제 서버/클라이언트에 연결한다.

- 전체 서버 Top 1000
- 내 정확한 순위 기준 ±5
- 현재 친구 중 배치 완료 참가자 순위

표시 정보:

- 닉네임
- 표시 티어
- 현재 MMR
- 시즌 랭킹 승수
- 정확한 전체 순위

순위 산정은 시즌 종료 스냅샷과 같은 정렬 기준을 사용한다.

```text
MMR DESC
→ ranked wins DESC
→ rating updated_at ASC
→ user_id ASC
```

서버 내부 계정 ID는 정렬과 self 판정에만 사용하며 HTTP 응답에서는 제거한다. 전체 덱, 계정 UUID, 저장 데이터는 순위표에 노출하지 않는다.

서버:

- `apps/server/src/pvp-leaderboard-authority.ts`
- `apps/server/src/pvp-leaderboard-http.ts`
- `GET /api/pvp/leaderboard/view?scope=top|around|friends`

클라이언트:

- `apps/client/src/pvp-leaderboard-network.ts`
- `apps/client/src/pvp-leaderboard-scene.ts`
- PvP 허브의 `랭킹 순위표` 버튼

주의:

- 이 배치는 사용자 요청에 따라 전체 CI/build를 매 커밋마다 실행하지 않고 콘텐츠 확장을 우선했다.
- 회귀 테스트 소스 `apps/server/test/pvp-leaderboard-authority.test.ts`는 추가했으나 아직 통합 실행 전이다.
- 따라서 `IMPLEMENTED_UNVERIFIED_BATCH`이며 다음 통합 검증 시 서버 TypeScript, 클라이언트 TypeScript, D1 쿼리 호환성을 함께 확인한다.
