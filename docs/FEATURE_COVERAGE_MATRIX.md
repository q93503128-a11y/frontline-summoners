# 전선소환전 — v1.0 기능 커버리지 매트릭스

최상위 정본: `docs/CANONICAL.md`  
성장/모집: `docs/GROWTH_RECRUITMENT_DESIGN.md`  
스테이지/온라인: `docs/STAGE_SYSTEM_DESIGN.md`  
콘텐츠 상세: `docs/content-wiki/`  
구현 현황: `docs/IMPLEMENTATION_STATUS.md`

## 상태

- `DONE`: 현재 v1.0 정본 기준으로 실제 사용자 경로까지 연결됨.
- `PARTIAL`: 기반은 있으나 v1.0 기능 일부가 빠짐.
- `MISSING`: v1.0 필수지만 아직 없음.
- `REWORK`: 구현은 있으나 v1.0 정본과 충돌하여 교체 필요.
- `PLANNED`: 1차 완성 이후 업데이트 범위.

---

## A. 전투 코어

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| BATTLE-01 | 30Hz 결정론 공용 sim | DONE | 싱글/서버 동일 코어 |
| BATTLE-02 | 사거리/선딜/hit frame/후딜/KB | DONE | 실제 판정과 시각 일치 |
| BATTLE-03 | 동시 피해 일괄 처리 | DONE | 순회 순서 비의존 |
| BATTLE-04 | 자연 KB/강제이동/DYING | DONE | 결정론 테스트 유지 |
| BATTLE-05 | 재생산 최종 2초 하한 | MISSING | 모든 보정 후 공용 함수에서 clamp |
| BATTLE-06 | 전투 경제/보급소 | PARTIAL | 현재 저속 경제 유지 + 4장 곡선 확장 |
| BATTLE-07 | 솔로 완전 일시정지 | DONE | tick/경제/스폰 모두 정지 |
| BATTLE-08 | 무료 재클리어 2배속 | MISSING | 1회 클리어 후 1×/2× |
| BATTLE-09 | 소탕권 | MISSING | 재클리어 반복보상 즉시 처리 |

---

## B. 속성/태그/도감

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| ATTR-01 | NEUTRAL/BEAST/UNDEAD/NATURE/ARCANE/DEMON/MACHINE/ANOMALY | REWORK | 옛 LIGHT/ARMORED/ARCANE 분류 교체 |
| ATTR-02 | 아군도 속성 보유 | REWORK | PvE/PvP 동일 규칙 |
| ATTR-03 | 전투 태그 분리 | REWORK | ARMORED/FLOATING/GIANT/BOSS/STRUCTURE 등 |
| CODEX-01 | 미발견 적 실루엣+??? | MISSING | 첫 발견 전 정보 숨김 |
| CODEX-02 | 미획득 아군 실루엣+??? | MISSING | 도감에만 실루엣, 편성에는 미표시 |
| CODEX-03 | 출현 적 → 도감 바로가기 | MISSING | 발견 적 클릭 시 상세 이동 |
| CODEX-04 | 게임 내부 고급 전투 정보 | PARTIAL | 외부 위키 없이 속성/사거리/능력 확인 |

---

## C. 스토리 로스터

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| STORY-01 | 기본/스토리 10종 | REWORK | 희귀도 제거 + 새 속성/3형태/외형/수치 |
| STORY-02 | 스토리 캐릭터 확정 획득 | DONE | 모집 의존 없음 |
| STORY-03 | 후반까지 사용 가치 | PARTIAL | Lv50/3형태 기준 역할 유지 검증 |

상세: `content-wiki/characters/STORY_ROSTER_V1.md`

---

## D. 모집 로스터/희귀도

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| ROSTER-01 | C/B/A 공통 풀 | REWORK | 초기 공통 15종 새 설계/데이터/아트 |
| ROSTER-02 | 성휘의 기사단 S5+SS1 | MISSING | 검수 후 3형태/전투/연출 |
| ROSTER-03 | 태고의 거수 S5+SS1 | MISSING | 검수 후 3형태/전투/연출 |
| ROSTER-04 | 제로 엣지 S5+SS1 | MISSING | 검수 후 3형태/전투/연출 |
| ROSTER-05 | SS 시리즈당 1명 | MISSING | schema/검증기로 위반 방지 |
| ROSTER-06 | 비인간/괴수/기계 실루엣 다양성 | PARTIAL | 실제 정식 아트에서 검증 |

상세: `content-wiki/recruitment/COMMON_POOL_V1.md`, `INITIAL_SERIES_01_03.md`

---

## E. 모집 시스템

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| GACHA-01 | 여러 시리즈 배너 | PARTIAL | C/B/A 공유 + 시리즈별 S/SS |
| GACHA-02 | v1.0 확률 데이터 | REWORK | 현재 후보 42/32/22.7/3/0.3 검증 |
| GACHA-03 | 천장/직접선택 제거 | REWORK | 옛 10/30/60/100 보장 코드/저장/UI 제거 |
| GACHA-04 | S 고유 연출 | MISSING | 스킵 가능 |
| GACHA-05 | SS 시리즈 전용 최고 연출 | MISSING | 시리즈당 1명과 연결 |
| GACHA-06 | 후한 모집재화 공급 | MISSING | 메인/SPECIAL/이벤트 경제 완성 |

---

## F. 레벨/+레벨/진화

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| LEVEL-01 | 메인 진행식 Lv10→20→30→40→50 | MISSING | 1~4장 최종 보상과 연결 |
| LEVEL-02 | 강한 Lv1~50 곡선 | REWORK | 과거 Lv50 1.595× 폐기, 목표 8~10× 검증 |
| LEVEL-03 | 골드 강화 비용 | MISSING | 80메인/SPECIAL 경제와 연결 |
| PLUS-01 | 캐릭터별 +레벨 | MISSING | +50 후보 상한/전투 적용 |
| PLUS-02 | 중복 직접 +1 | MISSING | 가장 높은 효율 |
| PLUS-03 | 중복 분해 → 공용 +재화 | MISSING | 교차 효율 약 20~30% 후보 검증 |
| EVO-01 | 모든 정식 캐릭터 3형태 | PARTIAL | 현재 대표 일부만 존재, 전체 확장 |
| EVO-02 | 이전 형태 재선택 | PARTIAL | UI까지 완성 |
| EVO-03 | 형태별 역할/비용/사거리 대변화 | PARTIAL | 단순 상위호환/색놀이 금지 |
| EVO-04 | 희귀도별 진화재료 차등 | MISSING | SS≈C 4~5배 목표 |

---

## G. 덱/편성 UI

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| DECK-01 | 솔로/1v1 10칸 저장 | PARTIAL | 실제 편성 UI/전투 연결 완성 |
| DECK-02 | 협동/2v2 플레이어당 5칸 | MISSING | 팀 10종 |
| DECK-03 | 드래그 앤 드롭 | MISSING | PC/모바일 슬롯 직접 배치/교환 |
| DECK-04 | 희귀도/속성/역할 필터 | MISSING | 상세 필터 + 빠른 칩 |
| DECK-05 | 미획득 캐릭터 편성 미표시 | MISSING | 보유 목록만 렌더 |

---

## H. 메인 캠페인/영구 보상

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| MAIN-01 | 제1장 20스테이지 | REWORK | 새 속성/적/영구보상/난이도 기준 적용 |
| MAIN-02 | 제2장 20 | MISSING | NATURE/UNDEAD |
| MAIN-03 | 제3장 20 | MISSING | ARCANE/DEMON |
| MAIN-04 | 제4장 20 | MISSING | MACHINE/ANOMALY |
| TREASURE-01 | 같은 영구 효과 반복 허용 | REWORK | 20개를 억지로 다르게 만들지 않음 |
| TREASURE-02 | 이속/배치한도 보너스 제거 | REWORK | 옛 보상 삭제 |
| TREASURE-03 | 체감 가능한 보상 수치 | REWORK | HP/공격/경제/재생산 중심 테스트 |
| MAIN-05 | 장 최종 Lv상한+추가보상 | MISSING | 1~4장 20/30/40/50 |

상세: `content-wiki/stages/main/INITIAL_MAIN_4_CHAPTERS.md`

---

## I. SPECIAL

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| SPECIAL-01 | 상시 묶음 | REWORK | 다단계 보스/속성/외전 |
| SPECIAL-02 | 주기 재화 묶음 | MISSING | 황금/혼/진화/별빛 |
| SPECIAL-03 | 기간 이벤트 | MISSING | 복각 가능 소형 캠페인 |
| SPECIAL-04 | 끝없는 전선 | MISSING | 솔로 신기록 1분 최초 보상 |
| SPECIAL-05 | 보스 러시 | MISSING | 솔로 기록/구간 보상 |
| SPECIAL-06 | 대부분 솔로+협동 | MISSING | 기록전만 솔로 기본 |
| SPECIAL-07 | 보상 충전 | MISSING | 플레이 입장 제한 없이 고효율 반복 통제 |
| SPECIAL-08 | 다단계 SPECIAL 카드 UI | MISSING | 카드 → 내부 단계 목록 |

상세: `content-wiki/stages/special/INITIAL_SPECIAL_COLLECTIONS.md`

---

## J. 협동/친구

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| COOP-01 | 같은 메인/SPECIAL 2인 협동 | MISSING | 별도 복사맵 없이 같은 Stage + scaling |
| COOP-02 | 개인 5칸/보급/보급소/쿨 | MISSING | 공유 기지/승패/병기 |
| COOP-03 | 적 소폭 스탯 보정 | MISSING | HP/공격/기지만, 숨은 추가웨이브 없음 |
| COOP-04 | 협동 첫 클리어 정상 진행 | MISSING | 보상/해금 동일 |
| COOP-05 | 공개 매칭 | MISSING | 대기/취소/실패 흐름 포함 |
| COOP-06 | 재접속/임시 AI | MISSING | 상태 보존 후 복귀 |
| FRIEND-01 | 친구 요청/목록/검색 | MISSING | 코드/검색/온라인 상태 |
| FRIEND-02 | 협동/친선 초대 | MISSING | 친구 UI에서 직접 실행 |
| FRIEND-03 | 차단/최근 플레이어 | MISSING | 안전/편의 |
| FRIEND-04 | 빠른 통신 | MISSING | 자유 텍스트 없이 핑/프리셋 |

---

## K. PvP

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| PVP-01 | 1v1 일반전 | MISSING | 레이팅 없음 |
| PVP-02 | 1v1 랭킹전 | MISSING | MMR/티어/랭킹 |
| PVP-03 | 친선전 | MISSING | 친구/방 코드, 보상 없음 |
| PVP-04 | PvP 성장 표준화 | MISSING | Lv/+Lv/영구보상 표준화 |
| PVP-05 | 티어/시즌 보상 | MISSING | 성장 보조+장식, 필수재화 독점 금지 |
| PVP-06 | 2v2 일반/친선 | MISSING | 플레이어당 5칸 |
| PVP-07 | 2v2 랭킹 | PLANNED | 동접 확인 후 업데이트 가능 |

---

## L. 계정/저장

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| SAVE-01 | 게스트 저장 | DONE | 로컬 권위/실패 처리 |
| SAVE-02 | v1 메타 저장 | REWORK | 새 속성/덱/레벨/+레벨/진화/모집/도감 |
| ACCOUNT-01 | 로그인 계정 | PARTIAL | 서버 canonical save 실제 사용자 루프 |
| ACCOUNT-02 | 게스트→로그인 1회 이전 | MISSING | 중복/충돌 규칙 포함 |
| ACCOUNT-03 | 진행 초기화 | MISSING | 계정 유지, 진행만 삭제 |
| ACCOUNT-04 | 계정 삭제 | MISSING | 서버 계정/저장 삭제 + 2단계 확인 |

---

## M. UI/연출/플레이 감각

| ID | 기능 | 상태 | v1.0 완료 기준 |
| --- | --- | --- | --- |
| UI-01 | 세계관형 UI 비주얼 언어 | REWORK | 단순 사각형 반복 감소 |
| UI-02 | PC/모바일 반응형/안전영역 | PARTIAL | 겹침/잘림/화면 밖 0 |
| UI-03 | 모집 고희귀 연출 | MISSING | S/SS 차등 + 스킵 |
| UI-04 | 돈 부족/쿨/선택 불가 피드백 | PARTIAL | 이유 즉시 판독 |
| UI-05 | 재도전/편성/도감 동선 | PARTIAL | 불필요한 클릭 최소화 |
| UI-06 | 개발자 문구 노출 0 | REWORK | prototype/debug/ID/TMI 전체 검색 |

---

## N. 1차 완성 후 업데이트

| ID | 기능 | 상태 | 범위 |
| --- | --- | --- | --- |
| POST-01 | 본능 대응 고유 후반 성장 | PLANNED | 1차 완성 후 새 설계 |
| POST-02 | 난이도 9~12 본격 콘텐츠 | PLANNED | 후반 성장과 함께 |
| POST-03 | 추가 모집 시리즈 | PLANNED | S5~7 + SS1 원칙 |
| POST-04 | 메인 5장 이후 | PLANNED | Lv50 추가 알파 보상 |

## 1차 완성 판정

전투 프로토타입이 실행된다는 이유로 완료로 보지 않는다. **메인80 + 핵심 SPECIAL + 성장/모집/3형태/+레벨 + 편성/도감 + 계정 + 협동/친구 + 1v1 일반/랭킹/친선 + 플레이 감각 QA**까지 실제 사용자 루프로 연결되어야 1차 완성이다.
