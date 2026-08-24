# Frontline Summoners 문서 인덱스

이 디렉터리의 문서는 역할을 분리해서 관리한다.

## 읽는 순서

### 1. `CANONICAL.md`
가장 먼저 읽는다.

- 현재 반드시 지켜야 하는 핵심 결정
- 최근 사용자 피드백 반영
- anti-goals
- 첫 사용자 테스트 게이트

다른 문서와 충돌하면 최신 `CANONICAL.md`를 우선한다.

### 2. `GAME_DESIGN_FULL.md`
전체 상세 기획서.

- 제품 목표
- 전투 코어
- 경제
- 캐릭터 수집
- 캐릭터 시각 식별성
- 레벨/업그레이드
- 진화
- 모집
- 보물
- 캠페인/맵
- 아트/VFX
- UI
- 저장
- 멀티
- 서버
- 검증
- 개발 로드맵

새 채팅에서 방향성을 복구할 때 반드시 같이 확인한다.

### 3. `STAGE_SYSTEM_DESIGN.md`
스테이지 시스템의 복원된 정밀 기획 정본 보조 문서.

- 진도 스테이지 / 특수 스테이지 분리
- 난이도 1~12
- 아군/적 동시 출격 제한
- 스폰·페이즈 트리거 DSL
- 편성 제한 DSL
- 특수 규칙
- 대규모 스테이지용 출정 계층
- 2인 협동의 편성·경제·공유 자원
- 협동에서 적 HP/공격력/거점 HP만 보정하는 원칙
- `협동 권장` 태그 금지

스테이지/협동 세부 규칙이 `GAME_DESIGN_FULL.md`의 축약 표현과 다르면 `CANONICAL.md`에 위배되지 않는 범위에서 이 문서를 우선한다.

### 4. `GROWTH_RECRUITMENT_DESIGN.md`
모집·희귀도·중복·레벨·진화의 복원된 정밀 기획 정본 보조 문서.

- C/B/A/S/SS 희귀도와 X 변칙 태그 원칙
- 모집 확률 C30 / B28 / A24 / S13 / SS5
- 10연 A+, 30연 S+, 60연 픽업 SS, 100연 직접 선택권
- 기본 캠페인 10종을 모집 풀에 넣지 않는 원칙
- 중복 → 캐릭터 조각 + 공용 성장 재화 방향
- Lv1~50, Lv30 이후 완만 성장
- 3형태 진화와 이전 형태 재선택
- 진화를 색놀이/숫자 상승으로 처리하지 않는 원칙
- 성장/모집 저장 모델과 데이터 권위 경로

모집·성장·진화 세부가 `GAME_DESIGN_FULL.md`의 과거 축약 표현과 다르면 `CANONICAL.md`에 위배되지 않는 범위에서 이 문서를 우선한다.

### 5. `IMPLEMENTATION_STATUS.md`
현재 구현 상태.

- 이미 구현된 것
- 아직 구현되지 않은 것
- 첫 사용자 테스트 전에 남은 작업
- 현재 검증 한계

기획 문서가 아니라 작업 현황 문서다.

### 6. `DEVELOPMENT_RULES.md`
실제 수정 과정의 운영 규칙.

- 매 작업 전 정본/상세기획/구현상태 재확인
- 구식 핫픽스·override·중복 구현 동시 제거
- 새 코드를 과거 코드 위에 덧씌우는 방식 금지
- 같은 책임은 최종적으로 하나의 권위 경로만 유지
- 실패를 수치 뻥튀기나 테스트 완화로 숨기지 않음

### 7. `NEW_CHAT_PROMPT.md`
새 채팅 인수인계 프롬프트.

새 채팅을 시작할 때 이 파일의 내용을 붙여넣고, 그 채팅에서는 프롬프트만 믿지 말고 반드시 GitHub `main`을 다시 읽어 현재 정본 상태를 복원한다.

## 실제 콘텐츠 수치

구체 수치는 문서보다 `content/` JSON이 우선한다.

현재 핵심:

- `content/units/chapter-01.json`
- `content/units/recruitment-01.json`
- `content/enemies/chapter-01.json`
- `content/stages/chapter-01.json`
- `content/stages/special-01.json`
- `content/stage-collections.json`
- `content/treasures/chapter-01.json`
- `content/recruitment/banner-01.json`
- `content/growth/level-curve-01.json`
- `content/evolution/recruitment-01.json`

## 실제 동작

문서와 코드가 충돌하는 경우 조용히 한쪽을 무시하지 않는다.

1. `CANONICAL.md` 확인
2. `GAME_DESIGN_FULL.md` 확인
3. 관련 정밀 문서 확인
   - 스테이지/협동: `STAGE_SYSTEM_DESIGN.md`
   - 모집/성장/진화: `GROWTH_RECRUITMENT_DESIGN.md`
4. `IMPLEMENTATION_STATUS.md` 확인
5. `DEVELOPMENT_RULES.md` 확인
6. `content/` 수치 확인
7. 실제 코드/테스트 확인
8. 충돌 원인을 파악
9. 정본/상세기획/구현을 함께 수정

## 문서 유지 원칙

- 큰 방향이 바뀌면 `CANONICAL.md` 버전을 올린다.
- 상세 기획이 추가되면 `GAME_DESIGN_FULL.md` 또는 해당 정밀 보조 문서를 함께 갱신한다.
- 스테이지/협동 세부 규칙이 바뀌면 `STAGE_SYSTEM_DESIGN.md`를 반드시 갱신한다.
- 모집/성장/진화 세부 규칙이 바뀌면 `GROWTH_RECRUITMENT_DESIGN.md`를 반드시 갱신한다.
- 구현이 완료/실패/보류되면 `IMPLEMENTATION_STATUS.md`를 갱신한다.
- 개발 작업 방식이 바뀌면 `DEVELOPMENT_RULES.md`를 갱신한다.
- 새 채팅 종료 전 `NEW_CHAT_PROMPT.md`가 현재 상태와 어긋나지 않는지 확인한다.
- 구현용 일시 메모를 정본처럼 사용하지 않는다.
