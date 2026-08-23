# Frontline Summoners

브라우저 기반 횡스크롤 소환 전략 게임.

## 현재 방향

- 싱글 플레이가 완전한 중심 게임
- 온라인 2인 협동 / 1v1 / 2v2 확장
- 30Hz 결정론적 전투 코어를 브라우저와 권위 서버가 공유
- 전투 조작: 유닛 생산, 보급소 투자, 거점 병기
- 10칸 덱(협동/2v2는 플레이어당 5칸)
- 희귀도와 절대 성능을 분리
- 과금 없음, 후한 캐릭터 획득
- 기준 픽셀 화풍: LuizMelo 계열 CC0 에셋

정본 요약은 [`docs/CANONICAL.md`](docs/CANONICAL.md)를 따른다.

## 저장소 구조

- `apps/client`: Phaser + Vite 브라우저 클라이언트
- `apps/server`: Cloudflare Workers / Durable Objects 서버 자리
- `packages/sim`: 싱글/멀티 공용 결정론적 전투 코어
- `packages/shared`: 공용 프로토콜/상수
- `packages/content-schema`: 캐릭터·적·스테이지 데이터 형식
- `content`: 실제 게임 콘텐츠 데이터
- `assets/raw`: 원본 에셋과 라이선스 관리
- `public/assets`: 런타임 배포 에셋

## 로컬 실행

```bash
npm install
npm run dev
```

Cloudflare 리소스는 기본 골격 검증 후 연결한다.
