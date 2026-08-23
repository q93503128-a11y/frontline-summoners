# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 이 문서는 현재 구현 진행도만 기록한다.

## 2026-08-23 — vertical slice 0.0.4

### 기반
- Cloudflare Pages `frontline-summoners`: GitHub `main` 자동 배포 연결 완료.
- Worker/DO/D1 골격 배포 완료. D1 `frontline-summoners-db` ID `95327cb4-06a1-4ded-ac02-faad09ee07ac`.
- `packages/sim`: 30Hz 이동/탐지/공격 프레임/동시피해/자연 KB/DYING/기지승패/stateHash 구현.
- `packages/sim/playable`: 보급, 보급소 Lv.1~8, 비용/재생산 쿨다운, 적 웨이브, 처치 보급 구현.

### 첫 브라우저 하네스 피드백
- 5개 도형 유닛만 노출된 개발자용 하네스는 사용자 테스트 빌드로 보기 부족했다.
- 거점 HP 가시성, 메인 화면, 스테이지 흐름, 실제 캐릭터, UI 선명도가 부족했다.
- 640×360 전체 캔버스 확대에서 한국어 UI가 흐릿하게 보였다.
- 이 하네스를 첫 사용자 테스트 시점으로 잡은 판단을 폐기하고 `docs/CANONICAL.md`의 수동 테스트 게이트를 상향했다.

### 이번 vertical slice
- 플레이어 10종(C3/B3/A2/S1/SS1) 로스터.
- LuizMelo CC0 계열 5개 아트 패밀리를 실제 Idle/Run/Attack 스프라이트로 연결.
- 메인 화면 → 스테이지 선택 → 10칸 현재 편성 → 전투 → 결과 화면 흐름.
- 3개 초기 스테이지.
- 양쪽 거점 HP바 + 현재/최대 HP 숫자.
- 게스트 클리어/보물 획득을 IndexedDB에 저장.
- 보물은 첫 클리어 100% 확정 획득. 보물 등급/드랍 RNG 없음.
- 내부 렌더 기준 1280×720으로 상향하고 전체 canvas pixelated CSS를 제거.

## 다음 작업

1. CI/Pages 빌드 회귀 확인 및 vertical slice 런타임 오류 수정.
2. 실제 화면에서 스프라이트 anchor/크기/공격 프레임을 수동 검수.
3. 적 8종 + 보스 2종까지 확대하고 스테이지 데이터 JSON화.
4. 거점 병기 1차 구현.
5. 20스테이지 캠페인 골격 확장.
6. 첫 사용자 수동 테스트 게이트 통과 후 테스트 요청.
