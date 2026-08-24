# Frontline Summoners

브라우저 기반 횡스크롤 소환 전략 게임.

## 현재 방향

- 싱글 플레이가 완전한 중심 게임
- 온라인 2인 협동 / 1v1 / 2v2 확장
- 30Hz 결정론적 전투 코어를 브라우저와 권위 서버가 공유
- 전투 조작: 유닛 생산, 보급소 투자, 거점 병기
- 솔로 완전 일시정지 지원
- PC 전투 단축키: `1~0` 소환, `Q` 보급소 강화, `E` 전선포, `P/ESC` 일시정지
- 쿨다운/보급 부족 같은 정상적인 실패 입력은 화면을 흔들지 않고 조용히 무시
- 10칸 덱(협동/2v2는 플레이어당 5칸)
- 진도 스테이지와 특수 스테이지를 별도 콘텐츠 축으로 운영
- 난이도 1~12, 스테이지별 동시 출격/편성 제한 확장
- 기본 무료 캠페인 로스터 10종 + 첫 모집 전용 15종
- 모집 희귀도 C/B/A/S/SS, 기본 확률 C30/B28/A24/S13/SS5
- 10연 A+, 30연 S+, 60연 픽업 SS, 100연 배너 캐릭터 직접 선택권
- 캐릭터는 종족/체형/장비/모션이 다른 강한 실루엣 식별성을 우선
- 캐릭터 Lv1~50 성장, 3형태 진화와 이전 형태 재선택을 핵심 메타로 설계
- 희귀도와 절대 성능을 분리
- 과금 없음, 후한 캐릭터 획득 방향
- 기준 프로토타입 픽셀 화풍: LuizMelo 계열 CC0 에셋

## 문서 — 반드시 이 순서로 확인

1. [`docs/CANONICAL.md`](docs/CANONICAL.md) — 최신 핵심 결정 정본
2. [`docs/GAME_DESIGN_FULL.md`](docs/GAME_DESIGN_FULL.md) — 통합 전체 상세 기획서
3. [`docs/STAGE_SYSTEM_DESIGN.md`](docs/STAGE_SYSTEM_DESIGN.md) — 진도/특수·난이도·출격/편성 제한·협동 정밀 기획
4. [`docs/GROWTH_RECRUITMENT_DESIGN.md`](docs/GROWTH_RECRUITMENT_DESIGN.md) — 모집·희귀도·중복·레벨·3형태 진화 정밀 기획
5. [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) — 현재 구현/미구현 상태
6. [`docs/DEVELOPMENT_RULES.md`](docs/DEVELOPMENT_RULES.md) — 레거시/중복 구현 정리와 작업 규칙
7. [`docs/INDEX.md`](docs/INDEX.md) — 문서 권위와 유지 규칙
8. [`docs/NEW_CHAT_PROMPT.md`](docs/NEW_CHAT_PROMPT.md) — 새 채팅 인수인계 프롬프트

구체 콘텐츠 수치는 `content/` JSON을 우선한다.

## 저장소 구조

- `apps/client`: Phaser + Vite 브라우저 클라이언트
- `apps/server`: Cloudflare Workers / Durable Objects 서버
- `packages/sim`: 싱글/멀티 공용 결정론적 전투 코어
- `packages/shared`: 공용 프로토콜/상수
- `packages/content-schema`: 캐릭터·적·스테이지 데이터 형식
- `content`: 실제 게임 콘텐츠 데이터
- `assets/raw`: 원본 에셋과 라이선스 관리
- `public/assets`: 런타임 배포 에셋
- `docs`: 정본/통합기획/정밀기획/구현상태/인수인계 문서
- `tools`: 검증 및 빌드 보조 도구

## 로컬 실행

```bash
npm install
npm run dev
```

정식 검증 목표는 install → typecheck → test → deterministic/content validation → build 순서다.
