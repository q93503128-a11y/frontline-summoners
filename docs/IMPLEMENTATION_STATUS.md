# Frontline Summoners 구현 상태

기준: 2026-08-29  
최상위 기획 정본: `docs/CANONICAL.md`

이 문서는 현재 실행 코드/콘텐츠의 구현 사실과 남은 큰 공백을 기록하는 상태 문서다. 기획 정본을 대체하지 않는다.

## 현재 실행 콘텐츠

- 메인: 4장 × 20 = **80 전장** 실행 데이터 연결 완료.
- SPECIAL: 현재 **46 전장** 실행 데이터 연결.
  - 기존 프로토타입 SPECIAL 5.
  - 주기 재화 SPECIAL 18: 황금 수송대 5 / 혼의 제련소 4 / 진화의 문 5 / 별빛 균열 4.
  - 상시 도전 SPECIAL 23: 폭식룡의 둥지 4 / 망자의 행진 4 / 유리성의 재판 4 / 녹슨 기계성 4 / 균열 관측기록 4 / 세 왕의 잔향 3.
- 현재 전장 합계: **126**.
- 플레이어 캐릭터 실행 로스터: **43종**.
- 진화: 43종 전원 F1/F2/F3, 총 **129 form** 데이터와 F2/F3 진화 recipe 연결.
- 적 실행 정의: 메인 및 현재 SPECIAL 전용 실행체를 포함해 **46종**.
- 스테이지 collection: 메인 4 + 현재 실행 SPECIAL 11 = **15 collection**.

## 성장/재화

- 게스트 저장 schema v11.
- `gold`, `evo_fragment`, `evo_core`, `evo_crown`, `soul_ember`, `summon_crystal` 재화 ledger 저장.
- 진화는 F2 Lv10, F3 Lv30 및 이전 form/재화 조건을 검사하고 한 transaction에서 차감+해금한다.
- 진화 실패 시 반쪽 상태를 남기지 않도록 application-state transaction 경계를 사용한다.
- 주기 재화 SPECIAL이 성장/진화/모집 재화의 실제 공급 경로로 연결되어 있다.
- 메인 1/2/3/4장 완료에 따라 Lv20/30/40/50 상한이 열린다.
- 재생산 최종 하한 60F 규칙을 유지한다.

## 전투 코어

- 30Hz 결정론 simulation을 solo와 authoritative co-op이 공유한다.
- Slow / Push / one-time Revive / conditional close-range attack이 실행된다.
- 상시 SPECIAL 확장에서 Weaken을 일반 on-hit 효과로 추가했다.
- `boss_sp_unobservable`은 90F 동안 공격력 75% Weaken을 사용한다.
- `boss_sp_glutton_drake`는 HP 60%/30% 임계에서 각각 210 전진하고 다음 공격 startup만 18F 단축한다.
- `boss_sp_undying_night`는 150F 뒤 HP 35% one-time Revive를 사용한다.
- 신규 상태는 simulation hash/signature에 포함되어 lockstep 결정론 경로를 유지한다.

## SPECIAL 진행/보상

- SPECIAL 허브는 `main_01_020 NORMAL_CLEAR` 뒤 열린다.
- 주기 재화 및 상시 도전 collection은 main 진행 gate와 collection 내부 이전 SPECIAL NORMAL_CLEAR를 함께 검사한다.
- `recordSpecialStageClear()` 저장 경계에서도 같은 unlock 규칙을 재검증하여 UI 우회로 잠긴 SPECIAL 보상을 선취할 수 없다.
- 상시 도전의 반복 보상은 낮은 골드 중심이며, 진화/모집 가치가 큰 재화는 첫 클리어 쪽에 집중되어 있다.
- 어린 포식룡은 최종 폭식룡의 축소 재사용이 아니라 BOSS tag 없는 별도 실행체다.

## 협동

- 대부분의 메인/SPECIAL이 동일 stage definition을 사용해 2인 협동 가능.
- 서버가 stage policy와 적/보스 정의를 authoritative content에서 읽는다.
- 새 Weaken/HP-threshold advance/revive 정의도 co-op scaling 이후 보존된다.
- 개인 성장/경제 보정과 공유 거점 규칙은 기존 lockstep 경로를 유지한다.

## 아직 1차 완성에서 큰 공백

다음 항목은 현재 상태만으로 완료라고 부르지 않는다.

- 친구 목록/초대/빠른 통신의 최종 사용자 흐름.
- PvP 일반전/랭크/친선, MMR/티어/랭킹/시즌 보상.
- 계정 로그인/전송/삭제 UX와 서버 정본 save의 릴리스 수준 마감.
- 제한 SPECIAL의 실제 formation restriction 강제 실행.
- 기간 이벤트 availability/복각/이벤트 누적 보상 시스템과 이벤트 전장.
- 기록 SPECIAL `끝없는 전선` / `보스 러시`의 전용 기록·보상·공정성 runtime.
- 기본 무기 전체 catalog/progression.
- Ch3/Ch4 일부 보스의 HP phase별 패턴 및 분리 hit-range처럼 현재 grammar로 근사된 세부 전투 사양.
- 캐릭터/적/보스 최종 production art 및 공격 모션. 현재는 구조 검증용 temporary art mapping을 사용한다.
- PC/모바일 전수 사람 플레이, 장시간 record 안정성, reconnect 및 릴리스 QA.

## 의도적으로 아직 넣지 않은 것

- availability가 없는 상태에서 이벤트를 상시 SPECIAL처럼 노출하는 가짜 구현.
- formation restriction runtime이 없는 상태에서 제한전 숫자만 채우는 데이터 구현.
- 세 번째 기록 모드.
- 본능 대응 후반 성장 및 메인 5장 이후 콘텐츠.

## 다음 개발 우선순위

1. 제한 SPECIAL의 formation restriction을 실제 battle factory에서 강제하고 C1/C2를 연결.
2. 이벤트 availability/복각 상태를 만든 뒤 `한여름 괴수 대소동`, `제로 엣지 시험운용` 연결.
3. `끝없는 전선`과 `보스 러시`를 일반 stage와 분리된 record runtime으로 구현.
4. 친구/초대/빠른 통신 → PvP/MMR/랭킹.
5. 남은 전투 근사 사양을 schema 확장으로 정본화.
6. 마지막에 production art/모션과 릴리스 QA를 집중 처리.

## 검증 원칙

- 파일 존재만으로 완료 처리하지 않는다.
- 실행 데이터 → client → save → server/co-op이 필요한 기능은 전체 경로가 연결되어야 구현으로 센다.
- 현재 HEAD의 정확한 자동검증 결과는 해당 커밋의 GitHub Actions CI를 기준으로 본다.
