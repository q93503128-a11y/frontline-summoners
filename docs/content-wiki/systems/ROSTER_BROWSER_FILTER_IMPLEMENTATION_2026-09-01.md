# 편성 로스터 탐색·필터 구현 — 2026-09-01

상태: **DESIGN_TARGET / code-wired, integrated CI + human viewport QA pending**

상위 정본:

- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/systems/UI_UX_ENCYCLOPEDIA.md`

## 배경

초기 43종 로스터와 129개 형태가 실제 데이터/성장/전투에 연결된 뒤에도 편성 화면의 탐색은 보유 캐릭터를 단순 페이지로 넘기는 수준에 머물러 있었다.

`GAME_DESIGN_FULL`과 `UI_UX_ENCYCLOPEDIA`는 로스터가 커진 이후 다음을 요구한다.

- 전체 / 스토리 / C / B / A / S / SS 빠른 분류
- 역할
- 공격 방식
- 속성 대항
- 비용
- 사거리
- +레벨 / 진화 상태
- 즐겨찾기
- 검색
- 여러 조건의 조합

이 묶음은 전투 규칙이나 소유권을 바꾸지 않고 **이미 보유한 캐릭터를 실제로 찾고 편성할 수 있는 탐색 계층**을 닫는다.

## 구현

추가 파일:

- `apps/client/src/roster-browser.ts`
- `apps/client/src/roster-favorites.ts`

연결 화면:

- `apps/client/src/deck-scene.ts`

### 빠른 분류

순환 필터:

- 전체
- 스토리
- C
- B
- A
- S
- SS
- 즐겨찾기

미획득 캐릭터를 편성 목록에 노출하기 위해 필터가 소유권을 다시 계산하지 않는다.

`DeckScene`이 기존 save authority의 `getOwnedCharacterIds()`로 먼저 보유 캐릭터를 확정하고, `roster-browser.ts`는 그 결과 위에서 presentation filter만 적용한다.

### 상세 조합 필터

다음 조건은 서로 대체하지 않고 동시에 적용된다.

- 역할: 전체 / 물량 / 전열 / 원거리 / 광역 / 결정타 / 변칙
- 공격: 전체 / 단일 / 범위
- 속성 대항: 전체 + 8속성
- 비용: 저 / 중 / 고
- 사거리: 근 / 중 / 장
- 성장: 전체 / +레벨 / 진화
- 검색 문자열

현재 비용/사거리 구간은 로스터 탐색을 위한 UI 분류값이며 전투 밸런스 수치를 변경하지 않는다.

### 검색

검색 대상:

- 캐릭터 이름
- 내부 ID
- 설명
- 획득 분류
- 희귀도
- 시리즈
- 역할
- 공격 방식
- 속성
- 속성 대항

현재 first-completion 구현은 브라우저의 텍스트 입력 대화상자를 사용해 실제 검색을 제공한다.

전용 인게임 IME 검색창과 키보드 포커스/모바일 키보드 UX는 사람 QA 뒤 후속 UI polish 후보다. 검색 기능 자체가 없다는 의미는 아니다.

### 즐겨찾기

카드의 `☆ / ★`로 토글한다.

즐겨찾기는 경제/진행/전투 결과와 무관한 **기기 UI 선호**다.

따라서:

- account save schema를 확장하지 않는다.
- guest/account 진행 authority에 섞지 않는다.
- localStorage best-effort preference로 저장한다.
- 알 수 없는 캐릭터 ID와 중복 ID는 로드 시 제거한다.

계정 간/기기 간 즐겨찾기 동기화는 현재 first-completion 필수 진행 데이터로 취급하지 않는다.

## 의도적으로 미구현한 항목

### 최근 획득순

현재 guest/account 정본 save에는 캐릭터별 획득 시각이 canonical하게 존재하지 않는다.

정확한 원천 없이 현재 배열 순서를 “최근 획득”으로 위장하지 않았다.

따라서 `최근 획득순`은 향후 실제 acquisition timestamp/history authority가 필요할 때 구현하는 것이 맞다.

## 회귀 계약

- `apps/client/test/roster-browser.test.ts`
  - 빠른 분류
  - 조합 필터
  - 속성 대항
  - +레벨/진화
  - 검색
  - 즐겨찾기 sanitizer
- `apps/client/test/deck-drag.test.ts`
  - 기존 탭/드래그 편성 유지
  - active save authority 유지
  - 새 필터/검색/즐겨찾기 wiring 확인

## TESTED 승격 조건

자동검사만으로 `TESTED`로 올리지 않는다.

- 통합 CI green
- 43종 전부 보유한 상태에서 각 필터 결과 사람 검수
- 필터 조합 후 드래그/탭/저장 정상 동작
- 즐겨찾기 새로고침 유지
- guest/account 모두 동일 탐색 결과
- 1280×720 / 390×844 등 대표 viewport에서 필터 행과 카드 겹침 없음
- 모바일 검색 입력/키보드 복귀 확인

위 조건 전까지 상태는 `DESIGN_TARGET / code-wired`다.
