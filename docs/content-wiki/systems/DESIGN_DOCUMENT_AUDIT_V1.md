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

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 정밀 시스템 문서
4. 해당 `docs/content-wiki/` 상세 페이지
5. 실제 content/schema/code/test는 구현 결과
6. implementation status 문서는 구현 현황 기록

`INDEX.md`, `content-wiki/README.md`, `NEW_CHAT_PROMPT.md`가 이 구조를 따른다.

---

# 3. 해결된 중요 충돌

## 3.1 GAME_DESIGN_FULL 역사 자료 오인 — RESOLVED

현재 `GAME_DESIGN_FULL.md`는 v1.2 통합 상세 정본이다.

## 3.2 FLYING / FLOATING — RESOLVED

공식 태그는 `FLOATING`. `FLYING`은 신규 데이터 금지 legacy alias.

## 3.3 솔로/협동 클리어와 소탕 — RESOLVED

`NORMAL_CLEAR = 솔로 실제 전투 승리 OR 허용된 정상 2인 협동 실제 전투 승리`.

NORMAL_CLEAR 후 진행/FIRST_CLEAR/영구보상/2배속/sweepEligible 소탕을 동일 인정. 소탕 자체는 NORMAL_CLEAR를 만들지 않는다.

## 3.4 메인 협동 정책 — RESOLVED

- 메인 대부분 SOLO_OR_COOP
- SPECIAL 대부분 SOLO_OR_COOP
- 기록 SPECIAL SOLO_ONLY
- 협동 FIRST_CLEAR 정상 인정

## 3.5 모집 천장 — RESOLVED

- C/B/A 공통
- S/SS 시리즈별
- SS 시리즈당 정확히 1
- pity/10·30·60·100 보장/직접선택 없음

## 3.6 스토리 희귀도 — RESOLVED

STORY는 `rarity:null`.

## 3.7 성장 체감 — RESOLVED AS DESIGN_TARGET

- Lv1 ×1
- Lv10 ×1.9
- Lv20 ×3.25
- Lv30 ×5
- Lv40 ×7.25
- Lv50 ×10

+50이면 plusMultiplier ×2 후보. 아직 TESTED/LOCKED 아님.

## 3.8 난이도 9~12 억지 사용 — RESOLVED

1차 대부분 1~7, 일부 8. 9~12는 후반 업데이트.

## 3.9 SPECIAL 규모 — RESOLVED

SPECIAL5 프로토타입을 출시 전체 범위로 간주하지 않는다.

---

# 4. 현재 문서 세밀도

## 플레이어 캐릭터 — VERY STRONG DESIGN_TARGET

총 43종:

- STORY 10
- 공통 C/B/A 15
- 초기 3시리즈 S15+SS3

현재 작성됨:

- 이름/ID
- 역할/속성/태그
- Lv1 HP/ATK/cycle/range/cost/recharge/speed/KB
- 능력/장점/약점
- F1/F2/F3 전투 변화
- F2/F3 캐릭터별 정확 진화 recipe DESIGN_TARGET
- 43종 contact-frame 목표
- 공통 화면 점유율/실루엣/모션/VFX/SFX 제작 규칙
- STORY 10 개별 아트·모션 바이블
- 공통 C/B/A 15 개별 아트·모션 바이블
- 초기 S/SS 18 개별 아트·모션 바이블
- F1/F2/F3 실루엣 변화
- Idle/Move/Attack/KB/Death 방향
- 캐릭터별 VFX/SFX 재질 언어
- 실루엣 충돌 위험쌍 검사

S/SS 18은 상세 초안까지 작성됐지만 실제 정식 아트 제작 전 사용자 검수 게이트를 유지한다. 특히 SS 3종은 승인 전 LOCKED 금지.

## 거점 병기 — STRONG DESIGN_TARGET

`BASE_WEAPON_SYSTEM_V1.md` 작성됨.

- 전선포
- 결계발진기
- 보급투하기
- 수치/프레임
- 해금
- 협동 shared cooldown
- PvP 표준화
- UI/서버 명령

까지 설계됨.

## 메인 적/보스 — STRONG DESIGN_TARGET

- 일반 적 32
- 메인 보스 8
- SPECIAL 전용 적/보스

기준 HP/ATK/range/cycle/speed/KB/패턴/magnification 정책 작성.

## 메인 80 — STRONG DESIGN_TARGET

4장 전체 stageId/name/difficulty/recommended growth/map/base/supply/spawn/boss/coop/target time 작성.

`MAIN_STAGE_CURRENCY_REWARDS_V1.md`에서 80개 first Gold/모집재화/repeat Gold와 milestone 보상을 숫자화.

## SPECIAL — STRONG DESIGN_TARGET

- 주기 재화 다단계
- 상시/도전
- 이벤트
- 기록 2종
- 보상 충전
- 소탕
- 전용 적/보스

상세화 완료.

---

# 5. 현재 핵심 숫자/규칙 일치 검사

- 메인 4×20=80
- cap 10→20→30→40→50
- 재생산 하한 60F
- 초기 시리즈 3
- 시리즈당 SS 1
- 공통 C/B/A 15
- player design pool 43
- 기록 SPECIAL 2종
- NORMAL_CLEAR solo/coop 실제 승리
- 랭킹 표준화 Lv50/+0/메인 영구 전투보너스0 DESIGN_TARGET
- 모집 확률 후보 42/32/22.7/3/0.3
- 1pull 비용 후보 100
- 1차 난이도 대부분 최대 8

현재 감사 범위에서 핵심 규칙 충돌 발견 없음.

---

# 6. 의도적으로 아직 LOCKED하지 않은 항목

- 모집 확률/비용
- Lv 성장 앵커/보간식
- +50/+1당 2%
- 43종 전투수치
- 개별 진화 recipe
- 메인80 재화/영구보상
- SPECIAL charged/depleted 보상
- 보상 충전 stack/회복
- 협동 scaling
- PvP Elo/MMR/티어/시즌/보상
- 재접속 유예
- 이벤트 주기
- 로그인 인증 방식
- 거점 병기 수치
- 캐릭터 화면 scale/VFX/SFX 상세값

구현+경제 시뮬레이션+사람 플레이 후 TESTED로 올린다.

---

# 7. 다음 세밀화가 필요한 설계 공백

P0로 남아 있던 `거점 병기`와 `43종 개별 진화 recipe + 아트/모션 바이블`은 이번 문서 패스에서 대부분 해결됐다.

## P1 — 캐릭터 제작의 마지막 세부

현재 제작 방향은 충분하지만 실제 스프라이트/리깅 직전에 더 내려갈 수 있는 값:

- 형태별 전체 animation length
- projectile launch frame/visual speed
- 정확 anchor/shadow footprint
- portrait/도감 pose
- 짧은 세계관 설명/도감 문구
- S/SS 모집 reveal storyboard
- 실제 VFX palette/lifetime 수치
- SFX 파일별 길이/동시재생 우선순위

이 항목은 아트 제작 직전 또는 제작과 병행해 LOCKED한다.

## P1 — 메인 내러티브/연출

전투/성장은 상세하지만 다음이 상대적으로 얕다.

- 장 시작/종료 story beat
- 보스 등장 이유
- STORY 10종 관계/합류 맥락
- 4장 엔딩
- 세계관의 초기 갈등
- 이벤트 세계관 연결

다음 문서 패스 1순위.

## P1 — UI 화면별 레이아웃 사양

- hierarchy
- desktop/mobile breakpoint
- touch target
- typography scale
- modal/tooltip
- card/grid 숫자
- battle HUD safe area

별도 화면별 spec 필요.

## P1 — BGM/SFX 바이블

- 장별 BGM
- 일반전→보스 전환
- 메뉴/모집/결과
- 재질별 SFX family
- 최대 동시 음원/ducking

필요.

## P1 — 접근성/옵션

- 색각 대응
- shake/flash 감소
- 텍스트 크기
- 효과음 시각화 후보
- 저사양 옵션

필요.

## P2 — 업적/프로필 장식

전체 catalog/해금 조건 미작성.

## P2 — 운영/복각 캘린더

출시 운영 직전 상세화 가능.

---

# 8. 구현 상태 문서 감사

`FEATURE_COVERAGE_MATRIX.md`와 `IMPLEMENTATION_STATUS.md`는 실제 코드 재감사 전 구현 상태를 `RE-AUDIT` 관점으로 읽는다.

문서가 상세하다는 이유로 구현 완료라고 주장하지 않는다.

다음 코드 작업 첫 단계에서 실제 main을 감사해 VERIFIED 상태를 다시 기록해야 한다.

---

# 9. 폐기 용어 검사표

신규 설계에서 금지:

- LIGHT
- FLYING
- story rarity
- X rarity
- pity
- selectionCredits
- 10/30/60/100 guarantee
- Lv50×1.595
- permanent move-speed treasure
- permanent allied deployment-cap treasure
- SPECIAL5 = 출시 전체 SPECIAL
- 메인은 무조건 솔로

legacy 설명에서만 명시적 폐기/REWORK 문맥과 함께 사용 가능.

---

# 10. 현재 판단

## 기획 구조

**PASS**

## 세부 콘텐츠

**PASS — STRONG DESIGN_TARGET**

구현 가능한 수준까지 내려갔으나 아직 플레이테스트 전이므로 LOCKED 아님.

## 코드/실제 게임

**NOT EVALUATED IN THIS AUDIT**

---

# 11. 다음 문서 작업 권장 순서

1. 메인 4장 narrative/story bible
2. UI 화면별 layout/touch/breakpoint spec
3. BGM/SFX/accessibility spec
4. 캐릭터 portrait/도감 문구 + S/SS reveal storyboard
5. 업적/프로필 장식 catalog
6. 최종 문서 링크/ID schema 검증

이후 새 기능을 더 늘리기보다 실제 구현/플레이테스트로 DESIGN_TARGET을 TESTED로 올리는 단계가 적절하다.
