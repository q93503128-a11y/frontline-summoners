# Frontline Summoners 새 채팅 인수인계 — v1.5 콘텐츠 바이블 기준

전선소환전 / Frontline Summoners 작업을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **반드시 현재 GitHub `main`을 직접 읽은 뒤 시작**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`

중요: 이 문서는 기획 방향 인수인계용이다. **구현 완료 여부는 실제 code/content/test를 직접 확인해야 한다.** DESIGN_TARGET 문서가 존재한다고 구현됐다고 가정하지 않는다.

---

# 0. 1차 완성 목표

냥코 대전쟁의 본능에 대응하는 후반 성장 시스템 직전까지의 **완성된 게임**.

포함:

- 30Hz 결정론 전투
- 메인 4×20=80
- Lv1~50/+레벨
- 3형태
- STORY + 공통 C/B/A + 3개 시리즈 S/SS
- SPECIAL 상시/주기/이벤트/기록
- 2배속/소탕
- 2인 PvE 협동
- 친구
- PvP 일반/랭킹/친선
- 도감/편성/성장/모집
- 게스트/로그인/동기화/삭제
- UI/모바일/접근성/오디오

싱글만으로 핵심 성장 완주 가능.

본능 이후 성장/난이도 9~12/추가 대형 시스템은 1차 뒤 업데이트.

---

# 1. 문서 권위

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. `docs/STAGE_SYSTEM_DESIGN.md`
5. `docs/content-wiki/README.md`
6. 관련 content-wiki
7. `docs/FEATURE_COVERAGE_MATRIX.md`
8. `docs/IMPLEMENTATION_STATUS.md`
9. `docs/DEVELOPMENT_RULES.md`
10. `docs/INDEX.md`
11. 실제 content/code/test

정본과 실행값이 다르면 실행값을 자동으로 정답 취급하지 않는다.

상태:

`CONCEPT → DESIGN_TARGET → TESTED → LOCKED`

현재 대부분 DESIGN_TARGET.

---

# 2. 핵심 전투/성장

- 30 tick/s
- 1D X축
- standingRange / attackMin / attackMax 분리
- hit/contact 동기화
- 동일 frame 피해 동시 적용
- 자연 KB/강제이동 분리
- 재생산 최종 하한 60F=2초

레벨 cap:

- 시작 10
- 1장 20
- 2장 30
- 3장 40
- 4장 50

성장 DESIGN_TARGET:

- Lv1 ×1
- Lv10 ×1.90
- Lv20 ×3.25
- Lv30 ×5.00
- Lv40 ×7.25
- Lv50 ×10.00
- +level multiplier = `1 + 0.02 × plusLevel`
- +50 후보

스토리 캐릭터 `rarity:null`.

모집:

- C/B/A 공통
- S/SS series 전용
- SS series당 정확히 1
- 천장/보장/직접 선택 없음
- 확률 후보 42/32/22.7/3/0.3

---

# 3. 초기 로스터 43종

- STORY 10
- 공통 C/B/A 15
- 초기 3series S15+SS3

series:

1. 성휘의 기사단
2. 태고의 거수
3. 제로 엣지

각 캐릭터에 현재:

- concept
- combat specs F1/F2/F3
- contact frames
- evolution recipe
- art/motion bible

이 존재한다.

S/SS, 특히 SS3는 정식 아트 제작 전 사용자 검수 필요.

---

# 4. 메인 80

1장 뒤집힌 국경 — NEUTRAL/BEAST  
2장 뒤틀린 숲 — NATURE/UNDEAD  
3장 마도도시 세라페 — ARCANE/DEMON  
4장 기어 제국의 균열 — MACHINE/ANOMALY

80개 전체에 stage map/base/supply/spawn/trigger/boss/coop/target time DESIGN_TARGET 존재.

영구보상과 일반 첫/반복 재화도 별도 80개 표가 있다.

난이도:

- 대부분 1~7
- 일부 8
- 9~12 억지 사용 금지

---

# 5. NORMAL_CLEAR

`NORMAL_CLEAR = 솔로 실제 승리 OR 허용된 정상 협동 실제 승리`

NORMAL_CLEAR 후:

- 진행
- FIRST/PERMANENT
- 재클리어 2배속
- sweep eligible 소탕

소탕은 NORMAL_CLEAR를 새로 만들지 않는다.

---

# 6. SPECIAL — 중요

**SPECIAL 허브는 제1장 최종 `main_01_020`을 NORMAL_CLEAR한 뒤 처음 열린다.**

```text
main_01_020 NORMAL_CLEAR
→ Chapter 1 완료
→ Lv20 상한
→ SPECIAL 허브 개방
```

- 솔로/협동 동일
- ST19 미개방
- 소탕 최초해금 불가
- 허브/collection/stage 잠금 분리

기록전:

- 끝없는 전선: 제3장 완료 후보
- 보스 러시: 제4장 완료 후보
- 둘 다 SOLO_ONLY

대부분 나머지 SPECIAL SOLO_OR_COOP.

상세:
`docs/content-wiki/systems/SPECIAL_ACCESS_AND_STORY_PRESENTATION.md`

---

# 7. 스토리 — 중요

스토리는 선택형 분위기 요소.

- 장대한 story bible 불필요
- 장 시작/보스/장 종료 짧은 연출 후보
- 처음 보는 장면도 즉시 Skip
- 자동 story skip
- 스킵해도 진행/보상/튜토리얼/시스템 정보 동일
- boss gameplay telegraph는 narrative와 분리
- 협동 상대를 story 감상 때문에 기다리게 하지 않음

---

# 8. UI/모바일

일반:
`systems/UI_UX_ENCYCLOPEDIA.md`

세부:
`systems/UI_SCREEN_LAYOUT_TOUCH_SPEC.md`

핵심:

- 640×360~1920×1080
- COMPACT/MEDIUM/WIDE
- safe area
- touch 최소 44×44
- 편성 long press 220ms drag
- tap→slot fallback
- 전투 10슬롯 실제 입력 가능
- SPECIAL 잠금 이유 자연어
- story Skip 첫 frame부터
- zoom/overflow QA

---

# 9. 오디오/접근성

`systems/AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md`

- 장별 BGM family
- material SFX
- voice priority/ducking
- boss telegraph audio
- 화면 흔들림 0/50/100
- flash reduction
- reduce motion
- high contrast/color assist
- VFX density
- LOW/MEDIUM/HIGH
- render scale/battery saving

---

# 10. 초상화/도감/모집 Reveal

`systems/CHARACTER_PORTRAIT_CODEX_REVEAL_SPEC.md`

- ICON/CARD/CODEX HERO
- F1/F2/F3 portrait
- STORY rarity frame 금지
- 짧은 lore + 전략 정보 우선
- rarity별 reveal 길이
- series별 SS reveal
- 10회 모집
- Skip/accessibility

---

# 11. SPECIAL 상세

- `stages/special/INITIAL_SPECIAL_COLLECTIONS.md`
- `PERIODIC_RESOURCE_SPECIALS_DETAILED.md`
- `PERMANENT_CHALLENGE_SPECIALS_DETAILED.md`
- `EVENT_AND_RECORD_SPECIALS_DETAILED.md`
- SPECIAL enemy/boss combat specs

1차 약 45~50개 이상 실제 전투 구성 가능.

---

# 12. 거점 병기

`systems/BASE_WEAPON_SYSTEM_V1.md`

- 전선포
- 결계발진기
- 보급투하기

shared coop weapon/PvP 규칙 포함.

---

# 13. 협동/친구/PvP

협동:

- 각 5칸, 팀 10
- 개인 보급/보급소/쿨
- 공유 기지/승패/병기
- 적 HP/ATK/base만 소폭 scaling

친구:

- 요청/수락/검색/목록/상태
- 협동/친선 초대
- 최근 사용자
- 삭제/차단
- 빠른 통신

PvP:

- 1v1 일반/랭킹/친선
- 2v2 일반/친선
- 2v2 랭킹 후속 가능
- 랭킹 성장 표준화 Lv50/+0/메인 영구 전투보너스0 후보

---

# 14. 계정/저장

`systems/ACCOUNT_SAVE_SYNC_SPEC.md`

- guest/local
- login/server authority
- revision/conflict
- guest migration
- reset/delete 분리
- reward idempotency

---

# 15. 업적/프로필

`systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

초기 약 45~55개 후보.

- main
- growth/collection
- SPECIAL
- coop
- PvP
- record
- fun/hidden

필수 성장 gate로 사용하지 않는다.

프로필:

- representative character
- title
- frame
- banner
- emblem
- badge
- PvP tier

---

# 16. 폐기 규칙

금지/legacy:

- LIGHT
- FLYING
- story rarity
- X rarity
- pity/selectionCredits
- 10/30/60/100 guarantee
- Lv50×1.595
- movement-speed permanent treasure
- deployment-cap permanent treasure
- SPECIAL5=전체 SPECIAL
- SPECIAL 시작부터 전부 개방
- 메인 전체 solo-only
- 협동 전용 복제 stage만 지원
- 1차 난이도 9~12 억지 사용
- 스토리 필수 정보화

2026-08-26 GitHub search는 `FLYING/LIGHT/selectionCredits/pity/SPECIAL5` 결과를 반환하지 않았지만 실제 구현 시작 시 전체 검색을 다시 한다.

---

# 17. 문서 최종 감사

`systems/DOCUMENT_LINK_ID_SCHEMA_AUDIT_V1_5.md`

현재 판정:

- 기획 구조 PASS
- 콘텐츠 세밀도 PASS — DESIGN_TARGET
- 링크/ID namespace PASS, 구현 validator 필요
- 코드/게임 실제 상태 NOT EVALUATED

---

# 18. 다음 작업

**이제 새 대형 기획 문서를 계속 늘리지 않는다.**

다음은 실제 구현 패스:

1. 최신 main commit 직접 확인
2. code/content/test repo-wide 재감사
3. 문서와 runtime 차이 분류
4. schema/validator부터 정리
5. coherent slice 구현
6. 레거시 즉시 제거
7. typecheck/test/build
8. PC/mobile 실제 플레이
9. 위키 상태 TESTED로 갱신

사용자가 구현을 지시하면 계획만 세우고 끝내지 말고 실제 작업한다.
