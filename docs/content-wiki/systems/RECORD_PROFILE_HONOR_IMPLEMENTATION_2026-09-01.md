# Record 고기록 프로필 보상 구현 메모 — 2026-09-01

상태: `IMPLEMENTED_RECORD_HIGHWATER_PROFILE_HONORS`

상위 정본:
- `docs/CANONICAL.md`
- `docs/GAME_DESIGN_FULL.md`
- `docs/content-wiki/stages/special/EVENT_AND_RECORD_SPECIALS_DETAILED.md`
- `docs/content-wiki/systems/ACHIEVEMENT_PROFILE_COSMETIC_CATALOG.md`

## 1. 목적

끝없는 전선과 보스 러시는 이미 trusted replay, 최고기록 high-water, 구간 재화 보상까지 실행되고 있었지만 10분/8보스 이후의 장기 목표가 재화 중심이었다.

Record는 반복 파밍보다 기록 갱신이 핵심이므로 후반 milestone은 성장재화를 계속 키우기보다 프로필 명예 보상으로 닫는다.

## 2. 끝없는 전선 고기록

기존 단계는 유지한다.

- 5분: `badge_endless_5`
- 8분: `badge_endless_8`
- 10분: `title_endless_10`

새 고기록 milestone:

- **15분 생존**
  - achievement: `ach_endless_15`
  - 배너 `심층 전선` (`banner_endless_depth`)
  - 프레임 `끝없는 심연` (`frame_endless_abyss`)

15분은 현재 1차 완성 후반 계정의 일반 목표 7~12분보다 위에 둔 숙련/고기록 목표다. 정확한 체감 난도는 장기전 사람 QA 전까지 `DESIGN_TARGET`이다.

20분까지의 기존 재화 high-water는 유지한다. 15분 장식을 얻은 뒤에도 기록 갱신과 16~20분 최초 구간 보상은 계속 존재한다.

## 3. 보스 러시 완주

기존 milestone을 보존한다.

- 3보스: `badge_boss_3`
- 5보스: `badge_boss_5`
- 8보스: `badge_boss_8`

현재 1차 런타임의 마지막 9번째 보스까지 전부 격파하면:

- achievement: `ach_bossrush_complete`
- 문장 `보스 러시 제패` (`emblem_bossrush_complete`)
- 기존 9보스 재화 보상(모집 결정/진화 왕관/소탕권)도 함께 유지

따라서 8보스 직전 milestone과 9/9 완주 명예 보상이 분리된다.

## 4. achievement catalog 경계

이벤트 메타 보상 추가 이후 초기 achievement catalog가 상한에 가까워졌기 때문에 단순히 항목 수만 늘리지 않았다.

실질적인 장식/장기 목표가 없던 `ach_gold_1`(황금 수송대 I 첫 완료)은 제거했다. 황금 수송대 I 자체의 첫 클리어 재화/소탕권 보상은 그대로이며 gameplay reward는 사라지지 않는다.

그 자리에 Record 후반 목표를 넣어 초기 authored target **45..55**를 유지했고 현재 catalog는 **55개**다.

## 5. guest / account 동작

별도 Record 전용 저장 스키마를 추가하지 않는다.

- guest profile은 durable `recordModeProgress`의 `endlessBestReachedMinute` / `bossRushBestDefeated`를 기존 achievement evaluator에 전달한다.
- authenticated account profile도 server account save의 같은 authoritative high-water를 evaluator에 전달한다.
- authenticated Record high-water 자체는 client 자기신고가 아니라 trusted replay 결과에서만 갱신된다.
- 완료 achievement의 cosmetic ownership은 기존 profile sync가 자동으로 재구성한다.
- 동일 이하 기록 재도전으로 장식이 중복 지급되지 않는다.

즉 Record score와 profile reward 사이에 별도의 클라이언트 claim 값이나 임의 cosmetic id 입력 surface를 만들지 않는다.

## 6. shared honor metadata

`packages/sim/src/record-rewards.ts`에 `RECORD_PROFILE_HONORS`와 high-water helper를 추가했다.

현재 정의:

- ENDLESS_FRONT 15분 → `banner_endless_depth`
- ENDLESS_FRONT 15분 → `frame_endless_abyss`
- BOSS_RUSH 9보스 → `emblem_bossrush_complete`

Record 허브와 결과 화면이 이 metadata를 직접 읽기 때문에 milestone 숫자와 프로필 장식 이름을 화면별로 따로 하드코딩하지 않는다.

## 7. 플레이어 노출

Record 허브:

- 현재 최고기록과 수령한 재화 high-water 아래에 **다음 명예 목표**를 표시한다.
- 끝없는 전선은 `15분 · 심층 전선 · 끝없는 심연`을 미리 보여준다.
- 보스 러시는 `9/9보스 · 보스 러시 제패`를 미리 보여준다.
- 목표 달성 뒤에는 같은 위치가 `명예 달성` 표시로 바뀐다.

Record 결과:

- 재화 보상과 별도로 현재 high-water에서 달성한 프로필 명예를 표시한다.
- 같은 이하 기록을 다시 플레이했을 때 `신규 획득`이라고 잘못 표시하지 않고 `고기록 명예` / `완주 명예`로 표현한다.
- authenticated 결과는 trusted replay claim이 돌려준 authoritative account snapshot을 사용한다.
- guest 결과는 durable guest high-water 저장 결과를 사용한다.

따라서 플레이어가 프로필 화면을 나중에 열기 전에도 Record의 장기 장식 목표와 달성 상태를 확인할 수 있다.

## 8. 상태 경계

구현됨:

- high-water 기반 achievement 판정
- guest/account 공통 profile cosmetic ownership 경로
- 15분 배너/프레임 content identity
- 9/9 보스 러시 완주 문장
- 8보스 milestone 보존
- authored achievement 상한 55 유지
- Record 허브 다음 명예 목표 표시
- Record 결과 달성 명예 표시

아직 `TESTED/LOCKED`가 아님:

- 15분까지 실제 도달 난도와 평균 생존시간
- 15분 장식 milestone의 장기 동기 효과
- 9보스 전체 순서/체력의 사람 밸런스
- production profile art
- 별도 animation/toast 연출

이번 묶음에서는 콘텐츠 확장을 우선했고 전체 CI는 별도 통합 검증 묶음까지 반복 실행하지 않는다.
