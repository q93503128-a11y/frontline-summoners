# 전선소환전 — 전체 기획 기능 커버리지 매트릭스

문서 상태: **초기 전체 기획 누락 방지용 필수 감사표**  
최상위 정본: `docs/CANONICAL.md`  
상세 기획: `docs/GAME_DESIGN_FULL.md`  
스테이지 정밀: `docs/STAGE_SYSTEM_DESIGN.md`  
모집·성장 정밀: `docs/GROWTH_RECRUITMENT_DESIGN.md`  
현재 구현: `docs/IMPLEMENTATION_STATUS.md`

> 목적: 전투 vertical slice에 집중하는 동안 초기 전체 기획의 핵심 메타 시스템이 뒤로 밀리거나 사라지는 일을 다시 허용하지 않는다. 이 문서는 새 기능을 즉흥적으로 추가하는 목록이 아니라, 초기 전체 기획과 이후 확정 결정을 기준으로 **무엇이 필수인지 / 무엇이 후순위인지 / 무엇이 후보인지**를 한눈에 고정한다.

## 상태 표기

- `DONE`: 실제 데이터·코드·저장/화면 중 해당 책임까지 연결되어 있음.
- `PARTIAL`: 기반은 있으나 사용자 루프의 일부가 빠져 있음.
- `MISSING`: 기획상 필수지만 아직 실사용 경로가 없음.
- `PLANNED`: 출시/장기 확장에 필요하지만 현재 vertical slice보다 뒤 단계.
- `CANDIDATE`: 초기 기획에서도 확정이 아니라 후보였음. 필수처럼 강제하지 않는다.

---

# A. 전투 핵심 — 필수

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| BATTLE-01 | 30Hz 결정론적 공용 전투 코어 | 필수 | DONE | 브라우저/서버가 같은 sim 사용 |
| BATTLE-02 | 보급 → 생산 → 전선 → 사거리 → 공격 frame → KB → 재생산 → 적 스폰 | 필수 | DONE | 한 경로로 실제 전투 동작 |
| BATTLE-03 | SINGLE/AREA, standingRange와 attack range 분리 | 필수 | DONE | 실제 판정에 반영 |
| BATTLE-04 | 자연 KB / ForcedDisplacement / DYING | 필수 | DONE | 결정론 테스트 포함 |
| BATTLE-05 | 보급소 Lv1~8 | 필수 | DONE | 비용/수입/지갑 실제 적용 |
| BATTLE-06 | 거점 병기 1슬롯 | 필수 | DONE | 현재 전선포 실제 사용 |
| BATTLE-07 | 솔로 완전 일시정지 | 필수 | DONE | tick/경제/쿨/스폰/렌더 진행 정지 |
| BATTLE-08 | PC/모바일 입력 분리 | 필수 | DONE | PC 1~0/Q/E, 모바일 터치 UI |
| BATTLE-09 | 정상 실패 입력에 화면 흔들림 없음 | 필수 | DONE | 쿨/돈/cap/MAX 실패 무진동 |

---

# B. 캐릭터 수집 / 덱 — 필수 메타

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| ROSTER-01 | 제1장 무료 기본 로스터 10종 | 필수 | DONE | 캠페인 확정 해금, 모집 의존 없음 |
| ROSTER-02 | 기본 10종 이후 캐릭터 풀 확장 | 필수 | DONE | 첫 모집 전용 15종 데이터/전투 정의 존재 |
| ROSTER-03 | C/B/A/S/SS 희귀도 | 필수 | DONE | 전투/도감/모집에서 같은 희귀도 정본 사용 |
| ROSTER-04 | 희귀도 ≠ 절대 성능 | 필수 | PARTIAL | 실제 15종 역할 차별 + 장기 밸런스 검증 필요 |
| ROSTER-05 | 종족/체형/장비/모션 기반 실루엣 다양성 | 필수 | PARTIAL | 현재는 임시 7 art family; 정식 고유 아트 필요 |
| DECK-01 | 솔로/1v1 수동 10칸 덱 | 필수 | MISSING | 보유 캐릭터가 10종 초과 시 직접 편성/저장/전투 반영 |
| DECK-02 | 협동/2v2 플레이어당 5칸 | 필수(멀티) | PLANNED | 멀티 준비 단계에서 구현 |
| ACQUIRE-01 | 모집 외 획득 루트 | 필수 | PARTIAL | 캠페인 해금 존재; 보스/외전/도전 캐릭터는 미구현 |

---

# C. 모집 / 뽑기 — 필수 메타

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| GACHA-01 | 데이터 기반 모집 배너/풀 | 필수 | DONE | `content/recruitment`가 확률 source of truth |
| GACHA-02 | C30/B28/A24/S13/SS5 | 필수 | DONE | 합계100%, 테스트 고정 |
| GACHA-03 | 10연 A+ / 30연 S+ / 60연 픽업 SS | 필수 | DONE | milestone 우선순위와 확률비 검증 |
| GACHA-04 | 100연 배너 캐릭터 선택권 | 필수 | DONE | 랜덤 결과와 별도 credit 적립/소비 |
| GACHA-05 | 모집 소유권/천장 저장 | 필수 | DONE | guest save에 배너별 진행 저장 |
| GACHA-06 | 모집 화면/결과 연출 | 필수 | MISSING | 메인 → 배너 → 1/10회 → 결과 → 보유/천장 표시 |
| DUP-01 | 중복 → 캐릭터 조각 + 공용 성장재화 | 필수 | PARTIAL | 중복 판정만 구현; 지급량/교환비 경제 미확정 |
| DUP-02 | 조각 교환으로 원하는 캐릭터 선택 | 필수 | MISSING | 교환 UI/경제/저장 구현 |
| DUP-03 | 중복 강제 성능 잠금 금지 | 필수 | DONE(규칙) | 기본 성능에 N돌 요구 금지 |

---

# D. 레벨 / 업그레이드 — 필수 메타

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| LEVEL-01 | Lv1~50 | 필수 | DONE | 레벨 곡선/전투 파생 존재 |
| LEVEL-02 | HP/공격 중심 완만 성장, Lv30 이후 완화 | 필수 | DONE | 현재 prototype curve 존재 |
| LEVEL-03 | 사거리/비용/KB 등 정체성 스탯 레벨 고정 | 필수 | DONE | 성장 엔진에서 유지 |
| LEVEL-04 | 캐릭터별 레벨 저장 | 필수 | DONE | save v5부터 저장/정규화 |
| LEVEL-05 | 강화 비용/골드 경제 | 필수 | MISSING | 보상 경제와 함께 비용 곡선 확정/저장/소비 |
| LEVEL-06 | 성장 화면 | 필수 | MISSING | 현재/다음 Lv, 상승량, 비용, 강화 실행 |

---

# E. 3형태 진화 — 필수 메타

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| EVO-01 | 기본/2형태/3형태 | 필수 | PARTIAL | 대표 5명 구현, 전체 캐릭터로 확장 필요 |
| EVO-02 | 이전 형태 재선택 | 필수 | DONE(엔진/저장) | 해금된 form 선택/복귀 가능 |
| EVO-03 | form 간 소유권/레벨 공유 | 필수 | DONE | 새 캐릭터 ID로 재획득하지 않음 |
| EVO-04 | 실제 전투 방식 변화/sidegrade | 필수 | DONE(대표5) | 비용/쿨/사거리/AREA/특효 등 실변화 |
| EVO-05 | form2/3 해금 조건/진화 재료 | 필수 | MISSING | 성장경제와 함께 조건 정본화 |
| EVO-06 | form별 고유 아트/모션/VFX/SFX | 필수 | MISSING | 색놀이가 아닌 실제 외형 차이 |
| EVO-07 | 진화 비교/선택 UI | 필수 | MISSING | 전/후 외형·수치·효과 비교 + 이전 form 선택 |

---

# F. 스테이지 / 캠페인 / 도전 — 필수

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| STAGE-01 | PROGRESSION / SPECIAL 분리 | 필수 | DONE | 저장/Collection 분리 |
| STAGE-02 | 난이도 1~12 | 필수 | DONE(스키마) | 향후 콘텐츠가 전 범위 사용 |
| STAGE-03 | 제1장20 + 7 전장계열 | 필수 | DONE | 현재 content 존재 |
| STAGE-04 | 첫 SPECIAL 5 | 필수 | PARTIAL | 데이터/테스트 존재, 최신 실행 green 미확인 |
| STAGE-05 | stage별 player/enemy unit cap | 필수 | DONE | sim까지 실제 전달 |
| STAGE-06 | 편성 제한 DSL evaluator | 필수(특수전) | MISSING | rarity/role/cost/tag/max-types 등을 실제 입장 검증 |
| STAGE-07 | 복합 spawn/phase trigger DSL | 필수(확장) | MISSING | 시간/거점HP/적사망/누적/AND/OR 실제 evaluator |
| STAGE-08 | specialRules deterministic registry | 필수(확장) | MISSING | 임의 문자열 핫픽스 없이 등록 규칙 실행 |
| HUB-01 | 출정 허브 → Collection → StageSelect | 필수 | PARTIAL | 현재 2 Collection은 작동, 3+ paging UI 미완료 |
| HUB-02 | 결과 후 정확한 Collection/page 복귀 | 필수 | PARTIAL | Collection 복귀는 있음, 내부 page 복원 미완료 |
| CONTENT-01 | 제2장 이상 | 장기 필수 | PLANNED | 첫 vertical slice 이후 확장 |
| CONTENT-02 | 외전/보스/제한전 | 장기 필수 | PARTIAL | SPECIAL 기반만 시작 |
| CONTENT-03 | 무한/도전 | 장기 확장 | PLANNED | 초기 전체기획 단계 D |
| CONTENT-04 | 샌드박스 | 장기 확장 | PLANNED | 초기 전체기획 단계 D |

---

# G. 보상 / 도감 / 메타 UI — 필수

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| REWARD-01 | 제1장 보물20 첫 클리어 100% | 필수 | DONE | RNG 파밍 없음 |
| REWARD-02 | 캐릭터 해금과 보물 보상 분리 | 필수 | DONE | 캠페인 해금 별도 |
| METAUI-01 | 메인 화면 | 필수 | DONE | 출정/편성/도감 등 진입 |
| METAUI-02 | 도감 | 필수 | PARTIAL | 현재 기본10/보물20/훈장; 모집25 기준 확장 필요 |
| METAUI-03 | 성장 화면 | 필수 | MISSING | LEVEL/EVO UI 통합 |
| METAUI-04 | 모집 화면 | 필수 | MISSING | GACHA-06과 동일 |
| METAUI-05 | 보유 캐릭터 검색/필터 | 필수(풀 확장) | MISSING | 희귀도/역할/속성/레벨/form/획득루트 |
| ECON-01 | 골드 + 모집 관련 재화 + 조각 중심의 단순 메타 경제 | 필수 방향 | MISSING | 재화 정의/획득/소비/저장 확정 |

---

# H. 저장 / 계정 — 필수

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| SAVE-01 | guest IndexedDB + session fallback | 필수 | DONE | 저장 실패 거짓 성공 금지 |
| SAVE-02 | stage/treasure/special 저장 | 필수 | DONE | 연속 진도 정규화 |
| SAVE-03 | 모집 소유권/천장 저장 | 필수 | DONE | 현재 v5 포함 |
| SAVE-04 | level/form 저장 | 필수 | DONE | 현재 v5 포함 |
| SAVE-05 | 10칸 덱 저장 | 필수 | MISSING | 수동 덱 구현과 함께 연결 |
| SAVE-06 | 성장/모집 재화/조각 저장 | 필수 | MISSING | 메타 경제 정본화 후 연결 |
| ACCOUNT-01 | Google/이메일 로그인 | 장기 필수 | PLANNED | 로그인 경제/소유권 서버 source of truth |

---

# I. 멀티 — 장기 필수

| ID | 기능 | 중요도 | 현재 상태 | 완료 기준 |
| --- | --- | --- | --- | --- |
| COOP-01 | 2인 협동, 각5칸/팀10 | 장기 필수 | PLANNED | 공용 sim 사용 |
| COOP-02 | 개인 보급/보급소/생산쿨 + 공유 거점/승패/병기 | 장기 필수 | PLANNED | 서버 권위 |
| COOP-03 | 필요 시 적 HP/공격/거점HP만 단순 배율 | 장기 필수 | PLANNED | AI/웨이브 이중화 금지 |
| COOP-04 | `협동 권장` 태그 금지 | 필수 규칙 | DONE(규칙) | 싱글을 틀린 선택처럼 보이지 않음 |
| COOP-05 | 팀 덱 전체 콤보 계산 | CANDIDATE | CANDIDATE | 확정 전 강제 구현 금지 |
| COOP-06 | 합동 병기 1.5초 연계 | CANDIDATE | CANDIDATE | 초기 전체기획 후보 |
| NET-01 | 약30초 재접속 유예 후 AI 인계 | CANDIDATE | CANDIDATE | 멀티 구현 시 재검토 |
| PVP-01 | 1v1 / 2v2 | 장기 필수 | PLANNED | 동일 sim |
| PVP-02 | 랭크 Lv30 표준화 | CANDIDATE | CANDIDATE | 실제 PvP 경제와 함께 확정 |

---

# J. 절대 누락 금지 핵심 메타 묶음

다음 항목은 **전투 vertical slice 뒤로 영구 미뤄서는 안 되는 출시 전 필수 묶음**이다.

1. 모집 전용 캐릭터 풀 + 희귀도.
2. 데이터 기반 모집/천장/선택권.
3. 모집 결과 소유권 저장.
4. 중복 조각/교환 경제.
5. Lv1~50 캐릭터 업그레이드.
6. 강화 비용/골드 경제.
7. 3형태 진화 + 이전 형태 재선택.
8. form별 실제 전투 변화 + 고유 아트/애니/VFX.
9. **보유 캐릭터가 10종을 넘으면 수동 10칸 덱.**
10. 성장 화면.
11. 모집 화면.
12. 도감의 전체 캐릭터/희귀도/역할/레벨/form/획득루트 확장.
13. level/form/deck/재화/조각 저장.
14. 모집/성장 캐릭터가 실제 BattleScene에서 저장된 덱/level/form으로 싸우는 연결.

이 14개 중 하나라도 `MISSING/PARTIAL`이면 “메타 시스템 완성”이라고 부르지 않는다.

---

# K. 작업 전/후 감사 규칙

모집·성장만이 아니라 **모든 의미 있는 작업** 전에 다음을 수행한다.

1. `CANONICAL.md` 확인.
2. `GAME_DESIGN_FULL.md` 확인.
3. 관련 정밀 문서 확인.
4. **이 `FEATURE_COVERAGE_MATRIX.md`에서 변경 대상과 인접 필수 기능 상태 확인.**
5. `IMPLEMENTATION_STATUS.md`에서 실제 구현 여부 확인.
6. 관련 `content/` + 코드 + 테스트 확인.

작업 후:

- 새 기능 때문에 기존 필수 기능이 `DONE → PARTIAL/MISSING`으로 후퇴하지 않았는지 검사.
- 구현했지만 UI/저장/전투 연결이 빠졌으면 `DONE`으로 올리지 않는다.
- 후보 기능을 초기 기획에 있었다는 이유만으로 필수로 승격하지 않는다.
- 확인되지 않은 과거 세부 수치는 임의 복원하지 않는다.
