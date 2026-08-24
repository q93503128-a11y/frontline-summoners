# 구현 상태

이 문서는 `docs/CANONICAL.md`를 대체하지 않는다. 매 작업 전 정본을 먼저 읽고, 이 문서는 현재 구현 진행도와 미완료 항목을 기록한다.

## 2026-08-24 — campaign vertical slice 0.0.13

### 기반
- Cloudflare Pages `frontline-summoners`: GitHub `main` 자동 배포 연결 상태.
- Worker / Durable Object / D1 골격 구성 완료.
- `packages/sim`: 30Hz 이동·탐지·공격 프레임·동시피해·자연 KB·강제이동·DYING·기지승패·stateHash 구현.
- `packages/sim/playable`: 보급, 보급소 Lv.1~8, 생산비/재생산 쿨다운, 적 웨이브, 처치 보급, 단일 장착 거점 병기 구현.
- 정본은 `docs/CANONICAL.md` v0.26.

### 첫 사용자 테스트 기준
- 과거 5개 도형 유닛 개발 하네스는 사용자 테스트 빌드로 취급하지 않는다.
- 메인 → 스테이지 → 편성/도감 → 실제 스프라이트 전투 → 결과/보상까지 한 사이클이 게임처럼 보여야 테스트를 요청한다.
- 내부 렌더 기준 1280×720.
- 일반 플레이 화면에는 tick/hash 등 개발자 디버그 텍스트를 노출하지 않는다.
- 모바일 세로 화면은 가로 회전 안내를 표시하며, 안내 중 BattleScene의 30Hz accumulator가 진행되지 않는다.

### 진행 / 보상 / 저장
- 신규 진행은 `징집병` 1종만 보유하고 STAGE 1만 개방한다.
- 앞 스테이지를 클리어해야 다음 스테이지가 열린다.
- 확정 캐릭터 해금: ST1 방벽기사 → ST2 수렵창병 → ST4 결투검사 → ST6 청창대 → ST8 전투마도사 → ST10 화염술사 → ST13 왕실기사 → ST16 이단주술사 → ST20 공허현자.
- 각 스테이지 보물은 첫 클리어 100% 획득하며 RNG/등급/반복 보물작은 없다.
- `content/treasures/chapter-01.json`의 20개 typed modifier가 실제 시작 보급/거점 HP/유닛 스탯/처치 보급/보급소 강화비/배치 한도 등에 적용된다.
- 실제 저장/현재 탭 세션에 존재하는 보물만 전투에 적용한다. 미래 보물 선적용 금지.
- 작은 정수 스탯은 `이동속도 +1`, `재생산 -1F`, `자연 KB -1F`처럼 실제 정수 변화로 정의한다.
- IndexedDB 쓰기 성공 여부를 `persisted`로 구분한다.
- IndexedDB가 막혀도 같은 탭에서 획득한 진행은 메모리 세션에 병합해 즉시 다음 스테이지가 다시 잠기지 않게 했다.
- **남은 UI 정리:** 결과 화면 문구가 `persisted:false`를 명시적으로 보여 주도록 연결해야 한다. 저장 계층은 이미 실패 여부를 반환한다.

### 도감
- 메인 화면의 `도감 · 준비 중` 버튼을 실제 `CatalogScene`으로 교체했다.
- 동료 10종: 5개씩 2페이지. 보유/미해금, 희귀도, 역할, 비용, 속성, 특효, 설명, 주요 수치를 표시한다.
- 미해금 동료는 해금 스테이지는 보이되 상세 능력치는 합류 전 숨긴다.
- 보물 20종: 5개씩 4페이지. 획득 여부, 효과, 획득 스테이지, 첫 클리어 100% 확정 여부를 표시한다.
- 획득 보물은 `영구 적용 중`으로 표시하고 IndexedDB/세션 진행을 그대로 읽는다.

### 콘텐츠 / 맵 / 보스
- 플레이어 10종(C3/B3/A2/S1/SS1), 적 8종 + 보스 2종, 제1장 20스테이지.
- 스테이지 선택 5개씩 4페이지.
- 전장 7계열: 풀바람 평원 / 붉은 협곡 / 불붙은 곡창지대 / 안개 폐허 / 달그늘 고개 / 철문 요새권 / 황금가면 관문.
- 각 스테이지는 별도 `decorSeed`, 780~1340 전장 길이, 지역별 하늘/원경/중경/지면/장식/거점 팔레트를 사용한다.
- `mapLength`는 실제 1D 시뮬레이션 거리다.
- ST19는 황금가면 제단/의식 깃발, ST20은 황금가면 제단+철문 요새 실루엣을 사용한다.
- ST19 황금가면 대주술사 1000틱, ST20 황금가면 900틱/철문장군 1250틱 등장.
- ST19/ST20 baseline은 지정 보스가 실제 등장했는지 검사한다.
- 실제 `BOSS` 태그 유닛이 시뮬레이션에 처음 등장하면 simulationId별 1회 중앙 `우두머리 출현` 경고를 표시한다. 경고는 시각 전용이며 전투 tick/stateHash를 건드리지 않는다.

### JSON 단일 정본
- `content/units/chapter-01.json`: 플레이어 전투/역할/비용/속성/전문.
- `content/enemies/chapter-01.json`: 적 전투/처치 보급/속성.
- `content/stages/chapter-01.json`: 20스테이지 맵/웨이브/보물/해금.
- `content/treasures/chapter-01.json`: 20보물 실제 영구 modifier.
- `parseCampaignBundle()`와 추가 검증이 ID 중복, 범위, 공격 프레임, 적 참조, 해금/보물 중복, 웨이브, 맵 다양성, 속성/전문 등을 검사한다.
- 20개 스테이지 보물 ID와 20개 typed effect ID는 1:1 회귀검사한다.

### 속성 / 전문 능력
- `LIGHT / ARMORED / ARCANE / BOSS` 4태그.
- 속성 자체에는 전역 상성이 없다.
- 명시된 전문 보너스만 특정 태그에 적용하고 여러 조건이 맞아도 가장 강한 배율 하나만 적용한다.
- 배율은 permille 정수, 거점에는 전문 배율 미적용.
- 편성/도감에 한글 속성·특효, 전투에는 적 속성 라벨을 표시한다.

### 거점 병기 / ForcedDisplacement
- 한 전투 즉시개입 병기 슬롯 1개.
- 현재 `전선포`: 적 거점 제외 적 전체 90 피해 → 사망/자연 KB → 생존 적 60 거리/10F 강제 후퇴, 900틱 재충전.
- `FORCED_DISPLACEMENT`는 자연 KB와 별도 상태, 이동 중 hurtbox 유지.
- 강제이동 중 자연 KB 임계 피해는 자연 KB가 우선하고 강제이동 취소.
- 동일 포격에서 자연 KB와 Push 이중 튕김 금지.
- 전선포 처치도 일반 처치 보급 지급.

### 공격 연출 / 원거리
- LuizMelo CC0 7개 아트 패밀리 Idle/Run/Attack을 build-time vendoring 후 로컬 `/assets/characters`에서 사용한다.
- 각 패밀리 `attackContactFrame`과 실제 first hitFrame을 동기화한다.
- `SLASH / PIERCE / BLUNT / MAGIC / FIRE / VOID` 6종 시각 언어.
- HP 감소 기반 충격 VFX, 거점 피격, 그림자, 소환 VFX 구현.
- `PIERCE / MAGIC / FIRE / VOID`는 거리별 travel tick을 역산해 hitFrame에 도달하도록 시각 투사체를 발사한다.
- 판정은 30Hz hitFrame 규칙 유지.
- 투사체 위치는 `battle.tick + accumulator / SIM_TICK_MS` 렌더 보간을 사용해 30Hz 계단감을 줄였다.

### 결정성 / stateHash
- 유닛 해시에 전투 정의, 속성/전문, 자연 KB, displacement 시작·목표·지속시간 포함.
- core hash에 mapLength, 거점 anchor/maxHP/currentHP 포함.
- playable hash에 보급소 정의, 슬롯 비용/쿨다운/전투 정의, 적 정의/처치 보급, 미래 웨이브, 배치 한도, 거점 병기 설정/런타임 포함.

### 캠페인 baseline
- ST1: 징집병만 사용, 60초 이내 승리 + 거점 50% 이상.
- ST1~5 / ST6~10 / ST11~15 / ST16~20 실제 순차 해금 캐릭터만 사용.
- 각 baseline은 그 시점까지 실제 획득한 보물만 적용한다.
- ST13 전 왕실기사 금지, ST16 전 이단주술사 금지, 공허현자는 ST20 전투 중 사용 금지.
- ST19 황금가면 대주술사, ST20 황금가면 대주술사+철문장군 실제 등장 확인.
- ST20 클리어 뒤 10종 전체 로스터 해금 검사.

### 자동 회귀검사
- 신규 저장/순차 스테이지/9회 캐릭터 해금.
- 플레이어10/적10/스테이지20/보물20 데이터 정합.
- ST1~20 순차 baseline + 미래 해금/미래 보물 금지.
- 자연 KB/ForcedDisplacement/전선포/결정성.
- contact frame/애니 phase/impact/20종 아트·FX.
- 원거리 발사/travel/포물선/렌더 보간 배선.
- 속성/특효/보물 modifier.
- 도감 Scene 등록·페이지 분할·진행 데이터 배선.
- BOSS 실제 스폰 기반 1회 경고.
- 모바일 세로 안내가 BattleScene accumulator보다 먼저 return하는지 검사.
- 게스트 진행 durable+session 병합과 `persisted` 계약 검사.

## 현재 검증 중 / 미완료

1. 최신 push의 실제 GitHub Actions/Cloudflare build 성공 여부. 현재 연결된 status 조회만으로는 성공을 단정하지 않는다.
2. 실행 환경에서 외부 npm/GitHub DNS가 차단되어 별도 로컬 `npm install → typecheck → test → build` 재현 불가.
3. 정본은 `package-lock.json` 커밋을 요구하지만 현재 루트에는 lockfile이 없다. 가짜 무결성 해시는 만들지 않는다.
4. 결과 화면에서 `persisted:false`를 사용자에게 명시적으로 표시하는 최종 배선.
5. 7개 전장 계열의 캐릭터 발 위치/그림자/거점 상대 크기 실제 브라우저 수동 시각 감사.
6. 가로 모바일에서 11~14px 내부 보조 글씨가 너무 작지 않은지 조정.
7. 대규모 웨이브의 적 속성 라벨 과밀도 감사.
8. build-time vendoring 21개 PNG의 실제 배포 결과 확인.

## 다음 작업

1. 결과 화면의 durable 저장 성공/실패 문구를 `persisted` 상태에 연결한다.
2. 가로 모바일에서 전투 핵심 텍스트 최소 크기를 올리고 비핵심 표기를 줄인다.
3. 적 속성 라벨을 밀집 웨이브에서도 전투를 가리지 않게 축약/조건부 표시한다.
4. 최신 배포의 빌드/런타임 오류가 확인되면 즉시 수정한다.
5. 첫 사용자 수동 테스트 게이트를 전부 통과한 뒤 사용자 실플레이 피드백을 받는다.
