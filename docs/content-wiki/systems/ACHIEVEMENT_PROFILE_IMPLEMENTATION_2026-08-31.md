# Achievement / Profile Runtime Implementation — 2026-08-31

상태: `IMPLEMENTED_GUEST_RUNTIME_FOUNDATION`

이 문서는 `ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`의 초기 업적/프로필 설계를 현재 실행 코드에 내린 범위와 남은 권위 경계를 기록한다. 기획 정본을 대체하지 않는다.

## 1. 이번에 실행된 범위

공용 `@frontline/sim/achievement-profile`에 초기 업적 **50개**와 프로필 장식 카탈로그를 등록했다.

업적 분류:

- MAIN 8.
- SPECIAL 8.
- GROWTH 10.
- CODEX 4.
- COOP 4.
- PVP 6.
- RECORD 6.
- QUIRK 4.

모든 업적은 `repeatable: false`이며 고유 achievement id를 사용한다. 장식 보상 id는 achievement id와 분리한다.

프로필 장식 종류:

- TITLE.
- FRAME.
- BANNER.
- EMBLEM.
- BADGE.

기본 프로필은 `frame_default_wood`, `banner_default_frontline`, `emblem_default`를 가진다.

## 2. 공용 evaluator

업적 화면에 거대한 조건 if 사슬을 박지 않고 typed requirement + 공용 evaluator를 사용한다.

현재 requirement:

- MAIN stage clear / clear count.
- SPECIAL stage clear / unique clear count / collection final clear set.
- character max Base Lv / +Lv.
- F2/F3 unlock count.
- owned character count.
- discovered enemy count.
- unique co-op clear count.
- endless best minute.
- boss-rush defeated high-water.
- PvP tier reached.
- future authoritative boolean fact.

따라서 친구/PvP/기묘 조건이 후속 구현되어도 업적 UI의 조건 분기를 다시 설계할 필요가 없다.

## 3. 게스트 진행 연결

`apps/client/src/achievement-profile.ts`는 현재 guest progress에서 직접 다음 축을 읽는다.

- MAIN NORMAL_CLEAR.
- SPECIAL clear history.
- 캐릭터 ownership.
- Base Lv / +Lv.
- F2/F3 unlocked form.
- enemy discovery.
- `COOP_BATTLE` NORMAL_CLEAR provenance.
- 끝없는 전선 best minute.
- 보스 러시 best defeated.

완료 업적은 별도 수령 버튼 없이 즉시 claimed set에 들어간다. claimed id와 장식 ownership은 set 기반으로 정규화해 같은 완료를 다시 읽어도 중복 지급하지 않는다.

## 4. 게스트 프로필 저장

전투/경제 guest save v15를 억지로 확장하지 않고 장식 선택 상태를 별도 local meta store로 분리했다.

key:

- `frontline-summoners:achievement-profile:v1`

저장:

- claimed achievement ids.
- owned cosmetic ids.
- profile loadout.
- future fact ids.
- optional best PvP tier.

profile loadout:

- representative character 0..1.
- title 0..1.
- frame 1.
- banner 1.
- emblem 1.
- badge 0..3.

알 수 없는/stale cosmetic id는 버리고, 미보유 장식을 장착할 수 없으며 badge는 최대 3개로 정규화한다.

이 store는 resource ledger를 변경하지 않는다.

## 5. 플레이어 UI

`ProfileScene`을 추가하고 메인 메뉴의 `프로필·업적`에서 진입한다.

왼쪽 profile card:

- 게스트/계정 권위 표시.
- 대표 캐릭터.
- 칭호.
- 프레임.
- 배너.
- 문장.
- 대표 배지 0..3.
- MAIN/SPECIAL/업적 진행 요약.

오른쪽 achievement list:

- 전체 + 8개 category filter.
- pagination.
- 현재/목표 progress.
- 완료 표시.
- 확정된 cosmetic reward 이름.
- 미완료 QUIRK 업적은 `??? / 조건 비공개`.

manual reward mailbox/claim button은 만들지 않았다.

## 6. 경제 보상 경계

상세 위키에는 일부 업적에 Gold/모집재화/소탕권 등의 보상 후보가 있으나 정확한 수량은 현재 LOCKED가 아니다.

따라서 이번 구현은:

- 확정 가능한 cosmetic reward는 실제 ownership에 지급.
- 미확정 resource reward는 `designRewardNote`로만 기록.
- 임의 Gold/Crystal/Ticket 수량을 생성하지 않음.
- resource ledger를 achievement completion에서 변경하지 않음.

경제 사람 QA 뒤 정확한 수량이 확정되면 server-authoritative reward mutation과 함께 추가해야 한다.

## 7. 현재 account 경계

authenticated progress는 server snapshot에서 진행 기반 업적을 계산할 수 있으나 이번 단계의 profile state는 **read-only derived view**다.

아직 account 완료로 세지 않는 것:

- server authoritative achievement claimed state.
- account cosmetic ownership/profile loadout 저장.
- revisioned profile mutation/idempotency.
- guest profile → account migration/conflict UX.
- 친구/재접속 사실의 authoritative event wiring.
- PvP match/tier authoritative event wiring.
- QUIRK battle event fact wiring.
- account profile edit API/client mutation.

따라서 guest runtime foundation 존재를 production account achievement 시스템 완료로 표현하지 않는다.

## 8. 남은 production 범위

- account authority/persistence.
- exact resource reward 경제 검증.
- 친구/협동/PvP/QUIRK trigger source 연결.
- 완료 toast/card 연출.
- cosmetic production art.
- 프로필 공유/친구/랭킹 화면 연계.
- 모바일/PC viewport 및 실제 터치 QA.
- guest→account 전환 중 achievement/cosmetic idempotency 검증.

## 9. 검증 기준

현재 자동 회귀가 검사하는 것:

- 정확히 50개 초기 achievement.
- unique achievement/cosmetic ids.
- 공용 typed evaluator.
- MAIN/SPECIAL/GROWTH/CODEX/COOP/RECORD progress 계산.
- future fact/PvP tier gate.
- hidden QUIRK visibility.
- claimed cosmetic idempotency.
- 미보유 장식 거부 + badge 3개 cap.
- unresolved economy reward 미발행.
- 실제 guest save 축 → achievement evaluation 변환.
- profile scene/menu wiring.
- 별도 local profile store가 combat/resource ledger를 건드리지 않음.

자동 테스트 green만으로 UX와 경제를 `TESTED/LOCKED`로 승격하지 않는다.
