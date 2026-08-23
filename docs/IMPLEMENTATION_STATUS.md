# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 이 문서는 현재 구현 진행도만 기록한다.

## 2026-08-23 — prototype 0.0.3

- Cloudflare Pages `frontline-summoners`: `main` 자동 배포 연결 완료.
- Cloudflare Worker `frontline-summoners-api`: GitHub 자동 배포 연결 및 첫 배포 성공.
- D1 `frontline-summoners-db`: 생성 및 Wrangler binding 연결 완료.
- Durable Object `BattleRoom`: binding/SQLite 선언 완료.
- `packages/sim` 전투 코어: 30Hz tick, 이동, 탐지, 공격 프레임, 동시 피해, 자연 KB, DYING, 기지 승패, deterministic stateHash.
- 플레이 가능한 전투 래퍼 추가: 보급 자동 수입, 보급소 Lv.1~8, 생산 비용, 재생산 쿨다운, 배치 한도, 적 웨이브, 적 처치 보급 보상, wrapper stateHash.
- 브라우저 프로토타입 추가: 5개 플레이어 유닛 버튼, 4개 적 아키타입, 자동 웨이브, 기지 HP, 승패/재시작, 보급소 업그레이드, 상태별 임시 모션 표현.
- 현재 화면 아트는 전투 규칙 검증용 임시 도형이다. LuizMelo 계열 실제 에셋 적용 전이며 최종 아트로 취급하지 않는다.
- 자동 테스트 추가: 30틱 보급 정산, 생산 비용/쿨다운, 보급소 업그레이드, 웨이브 스폰, playable stateHash 재현.

## 첫 수동 테스트 기준

Pages에서 다음을 한 판 동안 확인한다.

1. 보급이 초당 정확히 증가한다.
2. 5개 유닛 버튼이 비용/쿨다운에 맞게 동작한다.
3. 보급소 업그레이드가 보급을 소비하고 수입/최대치가 증가한다.
4. 적이 시간표대로 자동 출현한다.
5. 유닛이 전진하고 사거리에서 멈추며 공격한다.
6. 공격 중 자연 KB가 발생하면 공격이 취소되고 뒤로 밀린다.
7. 사망 유닛이 잠시 퇴장 상태 후 제거된다.
8. 한쪽 기지 HP가 0이 되면 승패가 확정되고 다시 시작할 수 있다.
9. PC와 모바일에서 하단 버튼 오조작/잘림이 없는지 확인한다.

## 다음 작업

1. CI/Pages 배포 결과와 실제 브라우저 첫 수동 테스트 피드백 회수.
2. Character/Enemy/Stage JSON 스키마 및 validation을 실제 콘텐츠에 적용.
3. 거점 병기 1차 구현.
4. LuizMelo CC0 기준 에셋 확보/Asset Registry 기록/실제 공격 애니메이션 적용.
5. 첫 10유닛·8적·2보스·20스테이지 테스트 빌드로 확장.
6. 이후 Worker `BattleRoom`에 동일 playable sim과 명령 검증 연결.
