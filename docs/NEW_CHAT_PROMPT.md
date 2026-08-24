# Frontline Summoners 새 채팅 인수인계 프롬프트

전선소환전 / Frontline Summoners 개발을 이전 채팅에서 그대로 이어서 진행한다. 새 게임을 다시 기획하지 말고 **먼저 현재 GitHub `main`을 직접 확인**한다.

저장소: `q93503128-a11y/frontline-summoners`  
브랜치: `main`  
작업 방식: 사용자 선호대로 `main` 직접 반영. 불필요한 임시 브랜치/PR/누적 hotfix 금지.

---

## 0. 매우 중요 — 초기 전체 기획을 다시 잊지 말 것

이 프로젝트는 전투 프로토타입만 만드는 게임이 아니다.

초기 전체 기획에서 다음은 **출시 전 필수 핵심 메타**였다.

- 모집/뽑기
- 다양한 희귀도 C/B/A/S/SS
- 캐릭터 수집 풀 확장
- 중복 처리/조각 교환
- Lv1~50 캐릭터 업그레이드
- 3형태 진화
- 이전 형태 재선택
- 보유 캐릭터가 10종을 넘은 뒤 수동 10칸 편성
- 성장 화면
- 모집 화면
- 도감 확장
- 소유/level/form/deck/재화 저장
- 저장된 덱/level/form이 실제 BattleScene 전투 정의에 반영되는 연결

전투 vertical slice가 잘 돌아간다는 이유로 이 메타 기능을 잊거나 무기한 뒤로 밀지 않는다.

### 역사 복구 기준점

Git 커밋:
`28e0ce134467ecea34c25115130b3c2e1ec308e2`
`docs: add complete consolidated game design`

현재 문서에서 어떤 핵심 기능이 지나치게 축약돼 있거나 “나중”처럼 보이는데 초기 기획 기억과 충돌하면, **임의 판단하지 말고 이 역사 기준점과 현재 정밀 문서/기능 매트릭스를 함께 대조한다.**

---

## 1. 작업 전 권위 순서

모든 의미 있는 작업 전에 반드시 다음을 확인한다.

1. `docs/CANONICAL.md`
2. `docs/GAME_DESIGN_FULL.md`
3. 관련 정밀 문서
   - 스테이지/특수/협동/출정: `docs/STAGE_SYSTEM_DESIGN.md`
   - 모집/희귀도/중복/레벨/진화: `docs/GROWTH_RECRUITMENT_DESIGN.md`
4. **`docs/FEATURE_COVERAGE_MATRIX.md`**
5. `docs/IMPLEMENTATION_STATUS.md`
6. `docs/DEVELOPMENT_RULES.md`
7. `docs/INDEX.md`
8. 관련 `content/*.json`
9. 실제 코드/테스트

기획과 구현이 다르면 한쪽을 조용히 무시하지 말고 같이 맞춘다.

`FEATURE_COVERAGE_MATRIX.md`에서 `MISSING/PARTIAL`인 출시 전 필수 기능을 전투가 잘 된다는 이유로 삭제/후퇴시키지 않는다.

---

## 2. 현재 정본 버전 / 상태

- `CANONICAL`: v0.32.
- `IMPLEMENTATION_STATUS`: campaign + meta vertical slice 0.0.32.
- 현재 전투 콘텐츠: PROGRESSION20 + SPECIAL5 = 25전투.
- 현재 캐릭터 전투 정의: 무료 캠페인10 + 모집15 = 25종.
- guest save: **v6**.

---

## 3. 제품 핵심

- Web PC/모바일 횡스크롤 소환 전략.
- 30Hz 결정론적 공용 sim.
- 핵심 전투 루프:
  `보급 → 생산 → 전선 → 사거리 → 공격 프레임 → KB → 재생산 → 적 스폰`.
- 싱글만으로 완전한 게임이어야 한다.
- 이후 2인 협동 → 1v1 → 2v2.
- 현재 과금 없음.
- 에너지/FOMO/필수 RNG 보물작/중복 강제 성장 금지.
- 캐릭터 액티브 버튼 남발 금지. 직접 개입은 소환·보급소·거점 병기 중심.

---

## 4. 전투 / 입력 현재 정본

- 기본 동시 출격 한도 아군50 / 적50.
- stage별 `playerUnitCap / enemyUnitCap` 지원.
- 10칸 덱은 캐릭터 종류 수, unit cap은 살아 있는 개체 수. 별개.
- PC:
  - `1~0` 소환
  - `Q` 보급소 강화
  - `E` 전선포
  - `P/ESC` 솔로 일시정지
- 모바일과 PC UI/입력 정보밀도 분리.
- 소환 쿨/돈 부족/unit cap/보급소 실패/MAX/전선포 쿨 같은 정상 실패 입력은 화면 흔들림 없음.
- camera shake는 실제 전투 충격에만 사용.
- 솔로 pause 중 tick/보급/쿨/스폰/이동/공격/투사체/tween 모두 정지.

---

## 5. 제1장 무료 로스터 / 진행

신규 계정:
- 징집병 1종
- ST1만 개방

제1장 확정 합류:
- 시작 징집병
- ST1 방벽기사
- ST2 수렵창병
- ST4 결투검사
- ST6 청창대
- ST8 전투마도사
- ST10 화염술사
- ST13 왕실기사
- ST16 이단주술사
- ST20 공허현자

기본10은 모집 풀에 넣지 않는다.

제1장20 보물은 첫 클리어100% 확정. 반복 RNG 보물작 없음.

---

## 6. SPECIAL / 출정 구조

현재 SPECIAL5:
1. 세 자리 전선 — 난이도6 — 실효3기.
2. 광란의 짧은 길 — 난이도7 — 650m 러시.
3. 유리봉 저격선 — 난이도8 — 1500m 장거리.
4. 삼인 결사대 — 난이도9 — 실효3기 + 철문장군50초.
5. 가면과 철문 — 난이도10 — 황금가면35초 → 철문장군70초.

정본 출정 흐름:
`메인 → 출정 허브 → Collection → 공용 StageSelect → 전투 → 원래 Collection`

Collection:
- `chapter-01`
- `special-border-01`

SPECIAL collection 해금은 숫자 clear count가 아니라:
`unlockAfterStageId: border-20`

페이지 helper:
- `STAGE_COLLECTIONS_PER_PAGE=2`
- `STAGES_PER_COLLECTION_PAGE=5`

아직 미완료:
- StageHub 실제 3+ Collection 좌우 paging UI.
- StageSelect가 공용 5-stage helper를 실제 소비하도록 통일.
- 결과 복귀 시 정확한 내부 page 복원.
- `main.ts` 실제 입장 gate를 `isSortieStageUnlocked()`로 통일.

SPECIAL deterministic test:
- `apps/client/test/special-baseline.ts`
- `apps/client/test/special-baseline.test.ts`

최신 실제 실행 green은 반드시 확인해야 하며 확인 전 통과했다고 말하지 않는다.

---

## 7. 모집 / 희귀도 — 이미 백엔드 구현됨

정밀 정본:
`docs/GROWTH_RECRUITMENT_DESIGN.md`

첫 모집 전용 풀:
`content/units/recruitment-01.json`

15종:
- C4
- B4
- A3
- S2
- SS2

첫 배너:
`content/recruitment/banner-01.json`

확률:
- C 30%
- B 28%
- A 24%
- S 13%
- SS 5%

보장:
- 10연 A+
- 30연 S+
- 60연 픽업 SS
- 100연 배너 캐릭터 직접 선택권 +1

현재 픽업 SS:
`moon-eater`

`apps/client/src/recruitment.ts`:
- JSON 기반 확률/풀 검증.
- A+/S+ 보장은 그 이상 희귀도의 원래 확률비 유지.
- 60 milestone이 10/30보다 우선.
- 100은 랜덤 결과를 덮지 않고 selection credit 적립.
- 실제 RNG는 `crypto.getRandomValues()`.
- 테스트 RNG 주입 가능.
- 신규/중복 판정.

아직 미완료:
- 모집 화면.
- 모집 결과 연출.
- 모집 재화.
- 중복 조각 지급량/공용 성장재화.
- 조각 직접 교환 UI/경제.

중복을 정상 성능의 필수 조건으로 만들지 않는다.

---

## 8. Lv1~50 성장

파일:
- `content/growth/level-curve-01.json`
- `apps/client/src/character-growth.ts`

현재:
- Lv1~50.
- 현재 구체 곡선은 `PROTOTYPE_BALANCE`.
- Lv1~30: HP/공격 레벨당 +15‰.
- Lv31~50: HP/공격 레벨당 +8‰.
- Lv30=1435‰.
- Lv50=1595‰.
- 사거리/비용/재생산/이속/KB는 레벨로 변경하지 않음.

미완료:
- 강화 골드 비용.
- 메타 보상경제.
- 성장 화면.

과거에 정해지지 않은 비용 수치를 임의로 확정하지 않는다.

---

## 9. 3형태 진화

정본:
- 기본형 / 2형태 / 3형태.
- 이전 형태 재선택 가능.
- form 간 소유권/레벨 공유.
- 무조건 상위호환보다 sidegrade/전문화 허용.
- 색놀이 진화 금지.

현재 대표5명(C/B/A/S/SS 각각1명)에 3-form 실제 데이터:
- 순무기수
- 등불마녀
- 태엽오리기사
- 거울퇴마사
- 달먹는룡

파일:
`content/evolution/recruitment-01.json`

실제 변경 가능:
- HP/공격
- 비용/재생산
- 이동속도
- standingRange / attackMin / attackMax
- SINGLE/AREA
- 전문 damage bonus

`recordGuestEvolutionUnlock()`은 이전 form을 건너뛰어 form3부터 여는 것을 허용하지 않는다.

미완료:
- form2/3 실제 해금 조건.
- 진화 재료/비용.
- 나머지20 캐릭터 3-form.
- 정식 form별 고유 아트/애니/VFX/SFX.
- 진화 비교/선택 UI.

레벨20/40 같은 해금 숫자는 과거 정본에 없으므로 임의 추가 금지.

---

## 10. save v6

`apps/client/src/save.ts`

마이그레이션:
- v2 stage/treasure
- v3 SPECIAL
- v4 recruitment ownership/pity
- v5 character level/form
- v6 explicit deck

현재 저장:
- 메인 클리어
- SPECIAL 클리어
- 보물
- 모집 캐릭터 소유권
- 배너별 totalPulls / selectionCredits
- 캐릭터별 level
- 해금 form 목록
- 선택 form
- 명시적 `deckSlotIds`

저장 실패 시 성공으로 거짓 표시하지 않는다. 같은 탭 session fallback 유지.

---

## 11. 수동 10칸 덱 — 백엔드/저장/전투 파생까지 구현, UI는 미완료

초기 전체기획상 캐릭터 풀이 10종을 넘으면 수동10칸 편성이 핵심 메타다.
현재 캐릭터가 25종이므로 더 이상 미룰 수 없다.

save v6 규칙:
- explicit deck 최소1 / 최대10.
- 중복 캐릭터 금지.
- 보유 캐릭터만 허용.
- 순서 저장.
- 기존 저장에 explicit deck이 없으면 legacy automatic formation:
  보유 캐릭터를 정본 순서로 최대10 자동 편성.
- `resetGuestDeckToAutomatic()` 제공.

`apps/client/src/player-loadout.ts`:
- `buildGuestDeckSlots(progress)`
- `createGuestPrototypeBattle(stageId, progress)`

흐름:
`GuestProgress → deck IDs → saved level/form → BattleUnitDefinition → treasure effects → createPlayableBattle()`

즉 저장된 level/form이 UI에만 존재하지 않고 실제 전투 정의에 반영되는 경로가 있다.

`prototype.ts`:
- `createPrototypeBattleWithPlayerSlots()` 추가.
- 기존 battle 생성과 새 성장 battle 생성이 같은 공용 경로를 사용.

테스트:
- `recruitment-save.test.ts`
- `player-loadout.test.ts`

**아직 미완료:**
- FormationScene이 `recordGuestDeck()`을 사용하는 실제 수동 편성 UI.
- BattleScene이 실제로 `createGuestPrototypeBattle()`을 사용하도록 `main.ts` 연결.

따라서 `FEATURE_COVERAGE_MATRIX`의 DECK-01 상태는 아직 PARTIAL이다.

---

## 12. 전체 기능 누락 방지 매트릭스 — 반드시 확인

`docs/FEATURE_COVERAGE_MATRIX.md`

상태:
- DONE
- PARTIAL
- MISSING
- PLANNED
- CANDIDATE

절대 누락 금지 메타 묶음:
1. 모집 전용 캐릭터 풀 + 희귀도.
2. 데이터 기반 모집/천장/선택권.
3. 모집 소유권 저장.
4. 중복 조각/교환 경제.
5. Lv1~50 업그레이드.
6. 강화 비용/골드 경제.
7. 3형태 진화 + 이전 형태 재선택.
8. form별 실제 전투 변화 + 고유 아트/애니/VFX.
9. 수동10칸덱.
10. 성장 화면.
11. 모집 화면.
12. 도감25+ / 검색·필터.
13. level/form/deck/재화/조각 저장.
14. 모집/성장 캐릭터의 실제 BattleScene 연결.

이 중 MISSING/PARTIAL이 있으면 “메타 완성”이라고 부르지 않는다.

---

## 13. PC / 모바일

- viewport 권위: `apps/client/src/viewport.ts`.
- compact = coarse primary pointer + 짧은 변≤540.
- 작은 마우스 PC는 PC UI 유지.
- portrait guard도 coarse pointer 필요.
- 모바일 핵심 터치 높이84 logical px.
- safe-area 유지.
- 모집/성장/편성 UI를 추가할 때도 PC와 모바일 정보밀도를 분리한다. PC UI를 단순 축소해서 모바일에 우겨넣지 않는다.

---

## 14. 협동

- 2인 각5칸, 팀10.
- 개인 보급/보급소/생산 쿨다운.
- 공유 거점HP/승패/거점 병기.
- 협동이 더 쉬울 수 있음.
- `협동 권장` 태그/경고 금지.
- 필요 시 적 HP/공격/적 거점HP만 수치 보정.
- 이동속도/공격주기/사거리/KB/스폰/적 수/웨이브/AI는 협동 때문에 변경 금지.
- solo/coop stage 복제 금지.
- 합동 병기1.5초 / 재접속30초 / 랭크Lv30 표준화는 현재 후보. 확정 기능처럼 구현하지 않는다.

---

## 15. 개발 규칙

- 새 코드로 old hotfix/override를 덮어 가리지 않는다.
- 같은 책임은 권위 경로 하나만.
- 기능 교체 시 구식 구현/테스트/상수 같이 청소.
- JSON과 코드에 같은 확률/수치 이중 하드코딩 금지.
- 미구현 기능을 설명만 넣어 작동하는 것처럼 가장하지 않는다.
- 테스트 실패를 수치 뻥튀기/timeout 증가로 숨기지 않는다.
- 일회성 진단 workflow를 남기지 않는다.
- `.github/workflows` 최종은 `ci.yml` 하나 유지.

---

## 16. 검증 한계

반드시 최신 main에서 실제:
1. install
2. typecheck
3. test
4. build

결과를 확인한다.

확인하지 못한 green을 주장하지 않는다.

SPECIAL5 deterministic baseline도 실제 실행 결과 확인 전 통과했다고 말하지 않는다.

---

## 17. 다음 작업 우선순위 — 여기서 바로 이어라

1. **최신 main CI/typecheck/test/build 실제 결과 확인.**
2. 실패가 있으면 save v6 / deck / player-loadout 신규 경로부터 원인 수정.
3. **FormationScene을 save v6 수동10칸덱에 실제 연결.**
4. **BattleScene을 `createGuestPrototypeBattle()` 경로에 연결하여 저장된 deck/level/form 실제 사용.**
5. 모집 화면:
   `메인 → 모집 → 배너 → 1회/10회 → 결과 → 신규/중복 → 천장/선택권`.
6. 성장 화면:
   `보유 캐릭터 → Lv → 현재 form → 강화/진화 비교 → 이전 form 재선택`.
7. 골드/모집재화/조각/진화재료 경제 정본화.
8. 도감25+ 확장 및 희귀도/역할/level/form/획득루트 필터.
9. StageHub/StageSelect paging UI 마무리.
10. SPECIAL5 deterministic 실행 검증.
11. 정식 모집/진화 고유 아트 파이프라인.
12. PC/가로 모바일 실렌더 + Pages 배포 확인.

**스테이지 콘텐츠를 더 늘리기 전에 3~6번 핵심 메타 연결을 우선한다.**

첫 사용자 테스트 요청은 최신 실행검증과 필요한 실렌더 감사가 끝난 뒤에만 한다.
