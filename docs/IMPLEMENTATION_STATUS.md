# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 이 문서는 현재 구현 진행도만 기록한다.

## 2026-08-23 — bootstrap 0.0.2

- Cloudflare Pages: `frontline-summoners` 생성 및 `main` 자동 배포 연결 완료.
- D1: `frontline-summoners-db` 생성 완료.
- D1 database id: `95327cb4-06a1-4ded-ac02-faad09ee07ac`.
- Worker 정본 이름: `frontline-summoners-api`. 첫 `wrangler deploy`에서 생성한다.
- Durable Object: `BattleRoom`, binding `BATTLE_ROOM`, SQLite storage. Wrangler의 declarative `exports`로 첫 배포 시 생성한다.
- D1 초기 migration 추가. 인증/경제 API 자체는 아직 구현하지 않았다.
- `packages/sim` 1차 전투 코어 구현: 30Hz tick, 이동, 탐지, 공격 프레임, 동시 피해, 자연 KB, DYING, 기지 승패, deterministic stateHash.
- 자동 테스트: 동시 치명타, 다중 KB 임계값 소비, 동일 입력 stateHash 재현.

## 다음 작업

1. CI/Cloudflare build 결과 확인 및 bootstrap 회귀 수정.
2. 보급/생산 쿨다운/유닛 배치 명령을 공용 sim에 추가.
3. 개발용 임시 유닛 5종과 실제 브라우저 전투 화면 연결.
4. Character/Enemy/Stage JSON validation 도입.
5. Worker `BattleRoom`에 실제 30Hz 권위 전투 루프와 명령 검증 연결.
