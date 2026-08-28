# 전선소환전 — v1.0 기능 커버리지 매트릭스

기준일: 2026-08-28  
최상위 정본: `docs/CANONICAL.md`  
통합 기획: `docs/GAME_DESIGN_FULL.md`  
콘텐츠 상세: `docs/content-wiki/`

> **중요:** 이 파일은 `기획 준비도`와 `실제 구현 검증 상태`를 분리한다. 2026-08-28부터 현재 `main`의 코드/데이터/test/UI를 직접 읽는 증분 구현 감사를 진행 중이다. 직접 확인한 행만 `VERIFIED_*`로 바꾸며, 문서 존재나 과거 상태만으로 완료를 추측하지 않는다. 아직 감사하지 않은 영역은 계속 `RE-AUDIT`이다.

---

# 상태 정의

## 기획 상태

- `LOCKED_RULE`: 상위 규칙으로 확정되어 구현이 따라야 함
- `DESIGN_TARGET`: 구현 가능한 상세 목표가 있으나 밸런스/플레이테스트 전
- `PARTIAL_DESIGN`: 추가 상세 설계 필요
- `POST_V1`: 1차 완성 후 범위

## 구현 검증 상태

- `RE-AUDIT`: 현재 main을 코드/데이터/test/UI까지 다시 읽어 검증해야 함
- `VERIFIED_DONE`: 최신 감사에서 사용자 경로까지 확인
- `VERIFIED_PARTIAL`: 최신 감사에서 일부만 확인
- `VERIFIED_MISSING`: 최신 감사에서 없음 확인

2026-08-28 증분 감사에서는 도감 unknown 처리, 실제 전투 조우 기반 적 발견/저장, 스테이지 출현 적→적 도감 직접 이동, 보유 아군 편성 필터, save v10 migration을 우선 검증했다. 해당 경로는 GitHub Actions CI #606에서 typecheck/content schema/simulation/client suite/build까지 통과했다. 다른 `RE-AUDIT` 행을 이 결과만으로 완료 처리하지 않는다.

---

# A. 전투 코어

| ID | 기능 | 기획 | 구현 검증 | 완료 기준 |
| --- | --- | --- | --- | --- |
| BATTLE-01 | 30Hz 결정론 공용 sim | LOCKED_RULE | RE-AUDIT | 싱글/멀티 동일 sim |
| BATTLE-02 | standing/attack range/선딜/hit/후딜 | LOCKED_RULE | RE-AUDIT | 판정/아트 동기화 |
| BATTLE-03 | 동시 피해 일괄 처리 | LOCKED_RULE | RE-AUDIT | 순회 순서 비의존 |
| BATTLE-04 | 자연 KB/강제이동/DYING | LOCKED_RULE | RE-AUDIT | 결정론 검증 |
| BATTLE-05 | 최종 재생산 60F 하한 | LOCKED_RULE | RE-AUDIT | 모든 modifier 뒤 clamp |
| BATTLE-06 | 보급/보급소 경제 | DESIGN_TARGET | RE-AUDIT | 장별 경제/실전 검증 |
| BATTLE-07 | 솔로 일시정지 | LOCKED_RULE | RE-AUDIT | sim 전체 정지 |
| BATTLE-08 | 정상클리어 후 무료 2배속 | LOCKED_RULE | RE-AUDIT | 솔로/협동 NORMAL_CLEAR |
| BATTLE-09 | 소탕권 | DESIGN_TARGET | RE-AUDIT | 반복보상/idempotency |
| BATTLE-10 | 거점 병기 1슬롯 | LOCKED_RULE | RE-AUDIT | 직접개입 과잉 금지 |

---

# B. 속성·태그·도감

| ID | 기능 | 기획 | 구현 검증 | 완료 기준 |
| --- | --- | --- | --- | --- |
| ATTR-01 | 8속성 | LOCKED_RULE | RE-AUDIT | NEUTRAL~ANOMALY 통일 |
| ATTR-02 | 아군/적 공통 속성 | LOCKED_RULE | RE-AUDIT | PvE/PvP 동일 체계 |
| ATTR-03 | combatTags 분리 | LOCKED_RULE | RE-AUDIT | ARMORED/FLOATING/GIANT/BOSS/STRUCTURE 등 |
| ATTR-04 | `FLYING` 금지 | LOCKED_RULE | RE-AUDIT | 공식 표기 FLOATING만 |
| CODEX-01 | 미발견 적 ??? | LOCKED_RULE | VERIFIED_DONE | 발견 전 정보 숨김 |
| CODEX-02 | 미획득 아군 ??? | LOCKED_RULE | VERIFIED_DONE | 편성에는 미보유 미표시 |
| CODEX-03 | 출현 적→도감 | DESIGN_TARGET | VERIFIED_DONE | 직접 이동 |
| CODEX-04 | 게임 내부 상세 수치 | LOCKED_RULE | VERIFIED_PARTIAL | 외부 위키 강제 없음 |

`CODEX-04`는 현재 동료/적 도감에서 HP·공격·사거리·재생산/처치 보급·전투 특성 등 구현된 전투 수치를 확인할 수 있는 데까지 검증했다. 성장/진화/추가 메타 정보까지 모든 v1 상세 수치가 한 화면 체계로 완결됐다는 뜻은 아니다.

---

# C. 플레이어 로스터 43종

| 영역 | 규모 | 기획 | 구현 검증 | 상세 |
| --- | ---: | --- | --- | --- |
| STORY | 10 | DESIGN_TARGET | RE-AUDIT | 개념 + F1/F2/F3 전투수치 |
| 공통 C | 5 | DESIGN_TARGET | RE-AUDIT | 공통풀 상세 |
| 공통 B | 5 | DESIGN_TARGET | RE-AUDIT | 공통풀 상세 |
| 공통 A | 5 | DESIGN_TARGET | RE-AUDIT | 공통풀 상세 |
| 성휘의 기사단 | S5+SS1 | DESIGN_TARGET | RE-AUDIT | 3형태/수치/contact 목표 |
| 태고의 거수 | S5+SS1 | DESIGN_TARGET | RE-AUDIT | 3형태/수치/contact 목표 |
| 제로 엣지 | S5+SS1 | DESIGN_TARGET | RE-AUDIT | 3형태/수치/contact 목표 |

고정 규칙:

- STORY `rarity:null`.
- C/B/A 대부분 공통.
- S/SS 시리즈 전용.
- SS 시리즈당 정확히 1명.
- 희귀도는 전투력/비용 서열이 아님.

현재 실행 로스터가 43종으로 페이지 처리되는 사실은 확인했지만, 이 표의 각 그룹별 3형태/수치/contact까지 전수감사한 것은 아니므로 그룹 행은 `RE-AUDIT`을 유지한다.

---

# D. 모집

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| GACHA-01 | 다중 시리즈 | LOCKED_RULE | RE-AUDIT |
| GACHA-02 | C/B/A 공유 + S/SS 전용 | LOCKED_RULE | RE-AUDIT |
| GACHA-03 | SS 시리즈당 1 | LOCKED_RULE | RE-AUDIT |
| GACHA-04 | 무천장/무직접선택 | LOCKED_RULE | RE-AUDIT |
| GACHA-05 | 42/32/22.7/3/0.3 후보 | DESIGN_TARGET | RE-AUDIT |
| GACHA-06 | 등급별 결과 연출 | DESIGN_TARGET | RE-AUDIT |
| GACHA-07 | 복각/비FOMO | LOCKED_RULE | RE-AUDIT |

`selectionCredits`, 10/30/60/100 보장은 신규 구현에서 금지.

---

# E. 성장/+레벨/진화

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| LEVEL-01 | Lv10→20→30→40→50 상한 | LOCKED_RULE | RE-AUDIT |
| LEVEL-02 | Lv50 ×10 앵커 | DESIGN_TARGET | RE-AUDIT |
| LEVEL-03 | 레벨업 골드 곡선 | DESIGN_TARGET | RE-AUDIT |
| PLUS-01 | +50 후보 | DESIGN_TARGET | RE-AUDIT |
| PLUS-02 | +1당 +2% HP/ATK 후보 | DESIGN_TARGET | RE-AUDIT |
| PLUS-03 | 중복 직접 +1 | LOCKED_RULE | RE-AUDIT |
| PLUS-04 | 분해→공용 +재화 | LOCKED_RULE | RE-AUDIT |
| EVO-01 | F1/F2/F3 | LOCKED_RULE | RE-AUDIT |
| EVO-02 | 이전 형태 재선택 | LOCKED_RULE | RE-AUDIT |
| EVO-03 | 형태 sidegrade 허용 | LOCKED_RULE | RE-AUDIT |
| EVO-04 | SS 재료≈C 4~5배 | DESIGN_TARGET | RE-AUDIT |

---

# F. 메인 80

| 장 | 테마 | 난이도 | 상세 기획 | 구현 검증 |
| --- | --- | --- | --- | --- |
| 1장 | 뒤집힌 국경 / NEUTRAL·BEAST | 1~6 | DESIGN_TARGET | RE-AUDIT |
| 2장 | 뒤틀린 숲 / NATURE·UNDEAD | 3~7 | DESIGN_TARGET | RE-AUDIT |
| 3장 | 마도도시 세라페 / ARCANE·DEMON | 4~7 | DESIGN_TARGET | RE-AUDIT |
| 4장 | 기어 제국의 균열 / MACHINE·ANOMALY | 5~8 | DESIGN_TARGET | RE-AUDIT |

각 장 20개 모두 상세 stage spec이 존재하며 spawn frame, map/base/supply, 권장 성장, coop scaling, 목표 시간이 DESIGN_TARGET으로 작성되어 있다.

---

# G. 메인 영구 보상

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| PERM-01 | 첫클리어 확정 | LOCKED_RULE | RE-AUDIT |
| PERM-02 | 반복 효과 허용 | LOCKED_RULE | RE-AUDIT |
| PERM-03 | HP/ATK/base/supply/economy/recharge 축 | DESIGN_TARGET | RE-AUDIT |
| PERM-04 | 이동속도 증가 금지 | LOCKED_RULE | RE-AUDIT |
| PERM-05 | 출격한도 영구 증가 금지 | LOCKED_RULE | RE-AUDIT |
| PERM-06 | 합연산 | DESIGN_TARGET | RE-AUDIT |

---

# H. SPECIAL

| 영역 | 설계 | 구현 검증 | 1차 범위 |
| --- | --- | --- | --- |
| 주기 재화 | DESIGN_TARGET | RE-AUDIT | 황금5/혼4/진화5/별빛4 |
| 상시 보스/도전 | DESIGN_TARGET | RE-AUDIT | 폭식룡/망자/유리성/기계성/균열/세왕 등 |
| 이벤트 | DESIGN_TARGET | RE-AUDIT | 첫 샘플 2묶음 |
| 끝없는 전선 | DESIGN_TARGET | RE-AUDIT | SOLO_ONLY |
| 보스 러시 | DESIGN_TARGET | RE-AUDIT | SOLO_ONLY |
| SPECIAL 전용 적/보스 | DESIGN_TARGET | RE-AUDIT | 기준 스탯/패턴 작성 |
| 보상 충전 | DESIGN_TARGET | RE-AUDIT | 입장 무제한 |
| 다단계 카드 UI | DESIGN_TARGET | RE-AUDIT | collection→stages |

---

# I. 협동/친구

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| COOP-01 | 같은 메인/SPECIAL 2인 | LOCKED_RULE | RE-AUDIT |
| COOP-02 | 각 5칸/개인 경제 | LOCKED_RULE | RE-AUDIT |
| COOP-03 | 공유 기지/승패/병기 | LOCKED_RULE | RE-AUDIT |
| COOP-04 | 소폭 stat scaling | DESIGN_TARGET | RE-AUDIT |
| COOP-05 | 협동 NORMAL_CLEAR 정상 진행 | LOCKED_RULE | RE-AUDIT |
| COOP-06 | 공개매칭/재접속/AI 인계 | DESIGN_TARGET | RE-AUDIT |
| FRIEND-01 | 코드/요청/목록/상태 | DESIGN_TARGET | RE-AUDIT |
| FRIEND-02 | 협동/친선 초대 | DESIGN_TARGET | RE-AUDIT |
| FRIEND-03 | 차단/최근 플레이어 | DESIGN_TARGET | RE-AUDIT |
| FRIEND-04 | 빠른 통신 | DESIGN_TARGET | RE-AUDIT |

---

# J. PvP

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| PVP-01 | 1v1 일반 | LOCKED_RULE | RE-AUDIT |
| PVP-02 | 1v1 랭킹 | LOCKED_RULE | RE-AUDIT |
| PVP-03 | 친선 | LOCKED_RULE | RE-AUDIT |
| PVP-04 | Lv50/+0/영구보너스0 표준화 | DESIGN_TARGET | RE-AUDIT |
| PVP-05 | MMR/Elo | DESIGN_TARGET | RE-AUDIT |
| PVP-06 | 티어/시즌/보상 | DESIGN_TARGET | RE-AUDIT |
| PVP-07 | 2v2 일반/친선 | LOCKED_RULE | RE-AUDIT |
| PVP-08 | 2v2 랭킹 | POST_V1 | - |

---

# K. 재클리어 편의

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| QOL-01 | NORMAL_CLEAR 후 2배속 | LOCKED_RULE | RE-AUDIT |
| QOL-02 | NORMAL_CLEAR 후 sweep 가능 | LOCKED_RULE | RE-AUDIT |
| QOL-03 | 소탕권은 에너지 아님 | LOCKED_RULE | RE-AUDIT |
| QOL-04 | 기록/PvP 소탕 금지 | LOCKED_RULE | RE-AUDIT |
| QOL-05 | 충전형 SPECIAL 소탕 | DESIGN_TARGET | RE-AUDIT |

NORMAL_CLEAR는 솔로 또는 허용된 협동 실제 승리다.

---

# L. UI/UX

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| UI-01 | 지휘소형 시각 언어 | DESIGN_TARGET | RE-AUDIT |
| UI-02 | PC/모바일 반응형 | LOCKED_RULE | RE-AUDIT |
| UI-03 | drag&drop 편성 | LOCKED_RULE | RE-AUDIT |
| UI-04 | 상세 도감 | DESIGN_TARGET | VERIFIED_PARTIAL |
| UI-05 | S/SS 모집 연출 | DESIGN_TARGET | RE-AUDIT |
| UI-06 | 입력/보급/쿨 피드백 | LOCKED_RULE | RE-AUDIT |
| UI-07 | 개발자 문구 0 | LOCKED_RULE | RE-AUDIT |

`UI-04`는 현재 동료/적/영구 보상/SPECIAL 기록 탭과 unknown 처리, 적 직접 포커스 이동까지 확인했다. v1 성장/진화 정보 전체와 최종 아트/UX까지 완성 판정한 것은 아니다.

---

# M. 계정/저장

| ID | 기능 | 기획 | 구현 검증 |
| --- | --- | --- | --- |
| SAVE-01 | 게스트 로컬 | LOCKED_RULE | RE-AUDIT |
| SAVE-02 | 로그인 서버 정본 | LOCKED_RULE | RE-AUDIT |
| SAVE-03 | schemaVersion migration | DESIGN_TARGET | VERIFIED_DONE |
| SAVE-04 | revision 충돌방지 | DESIGN_TARGET | RE-AUDIT |
| SAVE-05 | battle/recruit idempotency | DESIGN_TARGET | RE-AUDIT |
| ACCOUNT-01 | Google/이메일 후보 | DESIGN_TARGET | RE-AUDIT |
| ACCOUNT-02 | 게스트→계정 이전 | DESIGN_TARGET | RE-AUDIT |
| ACCOUNT-03 | 서버/게스트 충돌 선택 UI | DESIGN_TARGET | RE-AUDIT |
| ACCOUNT-04 | 진행 초기화 | LOCKED_RULE | RE-AUDIT |
| ACCOUNT-05 | 계정 삭제 | LOCKED_RULE | RE-AUDIT |
| ACCOUNT-06 | 게스트 데이터 삭제 | LOCKED_RULE | RE-AUDIT |

`SAVE-03`은 현재 schema v10과 v2~v9 migration 계약, 적 발견 필드의 이전 버전 기본값을 회귀 테스트에서 확인했다. 이는 서버 revision/idempotency까지 검증했다는 뜻이 아니다.

---

# N. 1차 이후

| 기능 | 상태 |
| --- | --- |
| 본능 대응 고유 후반 성장 | POST_V1 |
| 난이도 9~12 본격 사용 | POST_V1 |
| 메인 5장 이후 | POST_V1 |
| 추가 모집 시리즈 | POST_V1 |
| 2v2 랭킹 | POST_V1 후보 |

---

# 1차 완성 판정

문서/JSON 숫자만 존재한다고 완료가 아니다.

**메인80 + SPECIAL + 43종 초기 플레이어 설계군의 실제 수집/성장/3형태 + 편성/도감/모집/성장 UI + NORMAL_CLEAR 재클리어 편의 + 계정 + 협동/친구 + 1v1 PvP + 2v2 일반/친선 + 플레이 감각 QA**가 실제 사용자 루프로 연결되어야 한다.

증분 감사에서 `VERIFIED_*`가 된 행은 직접 확인된 사실로 유지한다. 나머지 `RE-AUDIT`은 관련 coherent slice를 작업하기 전에 현재 main에서 다시 검증하고, 구현과 회귀 테스트를 함께 갱신한다.
