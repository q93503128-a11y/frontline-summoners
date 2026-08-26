# v1.0~v1.2 기획서·콘텐츠 바이블 일관성 감사

감사일: 2026-08-26  
상태: `DESIGN AUDIT`  
범위: **기획 문서/개발용 콘텐츠 위키**  
코드/CI 상태: 이 감사에서는 재판정하지 않음. `IMPLEMENTATION_STATUS.md` 참고.

---

# 1. 감사 목적

문서가 길어지면서 발생하기 쉬운 다음 오류를 방지한다.

- 같은 시스템을 두 문서가 다른 숫자로 정의
- 폐기된 설계가 오래된 문서에 활성 규칙처럼 남음
- DESIGN_TARGET이 LOCKED처럼 오해됨
- 캐릭터/스테이지 세부가 구현자의 즉흥 판단에 남음
- 기획서와 실행값의 권위가 뒤집힘
- 신규 채팅 인수인계가 과거 규칙을 다시 살림

---

# 2. 현재 권위 구조 — PASS

현재 의도 정본 순서:

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 정밀 시스템 문서
4. 해당 `docs/content-wiki/` 상세 페이지
5. 실제 content/schema/code/test는 구현 결과
6. implementation status 문서는 구현 현황 기록

`INDEX.md`, `content-wiki/README.md`, `NEW_CHAT_PROMPT.md`가 이 구조로 갱신됨.

과거 `content JSON이 항상 세부 정본`이라는 표현은 현재 문서 권위에서 제거됨.

---

# 3. 해결된 중요 충돌

## 3.1 `GAME_DESIGN_FULL` 역사 자료 오인 — RESOLVED

과거 INDEX는 `GAME_DESIGN_FULL.md`를 역사 참고자료처럼 설명했으나 현재는 v1.2 통합 상세 정본으로 갱신.

## 3.2 FLYING / FLOATING — RESOLVED

공식 태그:

`FLOATING`

다음 신규 상세 문서의 `FLYING` 잔재를 `FLOATING`으로 교체:

- 공통 C/B/A combat specs
- 초기 3시리즈 S/SS combat specs
- 통합 기획서

`content-wiki/README.md`, `INDEX.md`, `NEW_CHAT_PROMPT.md`에도 FLYING 금지 규칙 명시.

## 3.3 솔로/협동 클리어와 소탕 — RESOLVED

과거 일부 문서는 소탕을 `직접 솔로 클리어`처럼 읽을 여지가 있었음.

현재 공통 정의:

`NORMAL_CLEAR = 솔로 실제 전투 승리 OR 허용된 정상 2인 협동 실제 전투 승리`

NORMAL_CLEAR 후:

- 진행
- FIRST_CLEAR
- 영구 보상
- 2배속
- sweepEligible stage의 소탕

을 동일하게 인정.

소탕 자체는 NORMAL_CLEAR를 만들지 않음.

## 3.4 메인 협동 정책 — RESOLVED

현재:

- 메인 대부분 SOLO_OR_COOP
- SPECIAL 대부분 SOLO_OR_COOP
- 기록 SPECIAL SOLO_ONLY
- 협동 FIRST_CLEAR 정상 인정

과거 `메인=솔로만` 방향은 폐기.

## 3.5 모집 천장 — RESOLVED

현재 활성 규칙:

- C/B/A/S/SS
- C/B/A 공통
- S/SS 시리즈별
- SS 시리즈당 정확히 1
- 누적 pity 없음
- 10/30/60/100 보장 없음
- 직접 선택권 없음

과거 규칙은 폐기 설명에서만 언급 가능.

## 3.6 스토리 희귀도 — RESOLVED

스토리 캐릭터:

- acquisitionClass STORY
- rarity null

C/B/A/S/SS를 붙이지 않음.

## 3.7 성장 체감 — RESOLVED AS DESIGN_TARGET

과거 Lv50 약 ×1.595는 폐기.

현재 목표 앵커:

- Lv1 ×1
- Lv10 ×1.9
- Lv20 ×3.25
- Lv30 ×5
- Lv40 ×7.25
- Lv50 ×10

+50이면 plusMultiplier ×2 → Lv1 대비 ×20 후보.

아직 TESTED/LOCKED가 아니라 DESIGN_TARGET임을 모든 핵심 문서에서 구분.

## 3.8 난이도 9~12 억지 사용 — RESOLVED

1차:

- 대부분 1~7
- 일부 8
- 9~12는 후반 업데이트

난이도 슬롯을 채우기 위해 HP/ATK를 뻥튀기하지 않음.

## 3.9 SPECIAL 규모 — RESOLVED

과거 SPECIAL 5개 프로토타입을 출시 범위로 오인하지 않음.

현재:

- 주기 재화 다단계
- 상시 보스/도전 다단계
- 이벤트 캠페인
- 기록 2종

개별 상세 스펙 존재.

---

# 4. 현재 문서 세밀도

## 플레이어 캐릭터 — STRONG DESIGN_TARGET

총 43종:

- STORY 10
- 공통 C/B/A 15
- 초기 3시리즈 S15+SS3

현재 작성됨:

- 이름/ID
- 역할/속성/태그
- 외형 핵심 실루엣
- F1/F2/F3 방향
- Lv1 HP/ATK
- attack cycle
- range
- 비용/recharge
- speed/KB
- 일부 능력
- 장점/약점
- 역할 중복 검사
- 43종 contact-frame 목표

아직 부족한 세부는 §7에 기록.

## 메인 적/보스 — STRONG DESIGN_TARGET

- 일반 적 32
- 메인 보스 8
- SPECIAL 전용 적/보스 추가 사양

기준 HP/ATK/range/cycle/speed/KB/패턴/magnification 정책 작성.

## 메인 80 — STRONG DESIGN_TARGET

4장 전체:

- stageId/name
- difficulty
- recommended growth
- map length/base HP/starting supply
- spawn frame
- repeated waves
- HP trigger/boss
- coop scaling
- target clear time
- permanent reward

일반 재화 보상도 `MAIN_STAGE_CURRENCY_REWARDS_V1.md`에서 80개 전부 숫자화.

## SPECIAL — STRONG DESIGN_TARGET

- 주기 18전장
- 상시/도전 다단계
- 이벤트 샘플
- 기록 2종
- 보상 충전
- 소탕
- 전용 적/보스

까지 상세화.

---

# 5. 수치가 일치하는 핵심 항목

현재 핵심 문서 간 확인:

- 메인: 4×20=80
- 레벨 cap: 10→20→30→40→50
- 재생산 하한: 60F
- 초기 시리즈: 3
- 시리즈당 SS: 1
- 공통 C/B/A: 초기 15
- 초기 전체 player design pool: 43
- 기록 SPECIAL: 끝없는 전선/보스 러시
- NORMAL_CLEAR: solo/coop 실제 승리
- 랭킹 성장 표준화: Lv50/+0/메인 영구 전투보너스0 DESIGN_TARGET
- 모집 확률 후보: 42/32/22.7/3/0.3
- 1pull 비용 후보: 100
- 난이도 1차 상한: 주로 8

충돌 발견 없음.

---

# 6. 의도적으로 아직 LOCKED하지 않은 항목

다음은 오류가 아니라 테스트가 필요한 DESIGN_TARGET이다.

- 모집 확률 42/32/22.7/3/0.3
- 1회 모집 비용 100
- Lv 성장 앵커와 보간식
- +50 상한/+1당 2%
- 캐릭터 43종 모든 전투 수치
- 진화재료 수량
- 메인80 일반 재화 보상
- 영구 보상 누적 수치
- SPECIAL charged/depleted 보상
- 보상 충전 4stack/12h 후보
- 협동 HP/ATK/base scaling
- PvP Elo K값/MMR 티어 경계
- 6주 PvP 시즌
- 랭킹 보상 숫자
- 재접속 유예
- 이벤트 개최 주기
- 로그인 인증 방식

이 숫자들은 구현+경제 시뮬레이션+사람 플레이 뒤 TESTED로 올린다.

---

# 7. 다음 세밀화가 필요한 설계 공백

아래는 문서 오류는 아니지만 **구현 전에 더 상세히 적으면 즉흥 판단을 더 줄일 수 있는 영역**이다.

## P0 — 캐릭터 개별 제작 바이블

현재 43종은 combat spec이 충분히 세밀하지만 다음이 아직 캐릭터별 완전표로 분리되지 않음.

- 각 F2/F3의 정확한 개별 진화재료 recipe
- 형태별 animation 전체 frame count
- projectile launch frame/속도
- VFX palette/shape/lifetime
- SFX 재질/길이/레이어
- 정확한 캐릭터 화면 높이/anchor/shadow
- 초상화/도감 pose
- 소환/죽음 연출 개성
- 짧은 세계관 설명/도감 문구
- S/SS 모집 reveal storyboard

아트 제작 직전에 캐릭터별 개별 페이지로 내리는 것을 권장.

## P0 — 거점 병기

통합 규칙은 있으나 현재 전용 상세 시스템 바이블이 부족함.

필요:

- 초기 병기 종류 수
- 기본 병기 정확 스탯
- 발사 animation/hit
- 업그레이드/해금
- 협동 공동 사용
- PvP 처리
- 병기별 역할 중복

## P1 — 메인 내러티브/연출

전투/성장 구조는 상세하지만:

- 장 시작/종료 story beat
- 각 장 보스 등장 이유
- STORY 10종의 관계
- 4장 엔딩
- 이벤트 세계관 연결

은 전투 구현 사양보다 덜 세밀함.

## P1 — UI 화면별 픽셀/레이아웃 사양

현재 흐름/원칙은 상세하나 실제 제작 전:

- 화면별 hierarchy
- desktop/mobile breakpoint
- 최소 touch target
- typography scale
- modal/tooltip 규칙
- card/grid 숫자
- 전투 HUD safe areas

를 별도 화면별 spec으로 내릴 수 있음.

## P1 — 사운드/BGM 바이블

현재 SFX 원칙은 있으나:

- 장별 BGM 방향
- 전투/보스 전환
- 메뉴/모집/결과 음악
- 공격 재질별 SFX family
- 최대 동시 음원/ducking

등은 별도 상세 문서 필요.

## P1 — 접근성/옵션

- 색각 대응
- 화면 흔들림 감소
- flash 감소
- 자막/효과음 시각화 후보
- 텍스트 크기
- 저사양 옵션

세밀화 필요.

## P2 — 업적/프로필 장식

랭킹/이벤트에서 장식을 지급한다는 규칙은 있으나 전체 catalog와 해금 조건은 미작성.

## P2 — 운영/복각 캘린더

주기 SPECIAL의 기본 cycle은 있으나 장기 live calendar는 출시 운영 직전 상세화 가능.

---

# 8. 구현 상태 문서 감사

과거 `FEATURE_COVERAGE_MATRIX.md`와 `IMPLEMENTATION_STATUS.md`는 이전 코드 스냅샷이 현재처럼 읽힐 위험이 있었음.

조치:

- 기능 매트릭스에서 `기획 상태`와 `구현 검증 상태`를 분리.
- 최신 코드 재감사 전 구현값을 `RE-AUDIT`으로 표시.
- 구현상태 문서도 `v1.0 재감사 대기`로 변경.

따라서 문서만 보고 `2초 하한이 구현됐다`, `CI가 green이다` 등을 주장할 수 없음.

다음 코드 작업 첫 단계에서 실제 main을 감사해 VERIFIED_* 상태를 다시 기록해야 함.

---

# 9. 폐기 용어 검사표

신규 설계에서 금지:

- LIGHT 속성
- FLYING
- story rarity
- X rarity
- pity
- selectionCredits
- 10/30/60/100 guarantee
- Lv50×1.595
- permanent move speed treasure
- permanent allied deployment-cap treasure
- `SPECIAL5 = 출시 전체 SPECIAL`
- `메인은 무조건 솔로`

역사/레거시 설명에서만 명시적 `폐기/REWORK/legacy`와 함께 사용 가능.

---

# 10. 현재 판단

## 기획 구조

**PASS**

큰 시스템 간 충돌은 현재 감사 범위에서 해결됨.

## 세부 콘텐츠

**PASS — DESIGN_TARGET**

구현 가능한 수준까지 상당 부분 내려갔으나 아직 플레이테스트 전이므로 LOCKED 아님.

## 코드/실제 게임

**NOT EVALUATED IN THIS AUDIT**

문서 작업과 구현 상태를 혼동하지 않는다.

---

# 11. 다음 문서 작업 권장 순서

1. 거점 병기 상세 바이블
2. 43종 개별 진화 recipe + 아트/VFX/SFX spec
3. 메인 4장 narrative/story bible
4. UI 화면별 layout/touch/breakpoint spec
5. BGM/SFX/accessibility spec
6. 업적/프로필 장식 catalog
7. 최종 문서 링크/ID schema 검증

위 작업 뒤에는 새 기능 아이디어를 더 늘리기보다 실제 구현/플레이테스트로 DESIGN_TARGET을 TESTED로 올리는 단계가 적절하다.
