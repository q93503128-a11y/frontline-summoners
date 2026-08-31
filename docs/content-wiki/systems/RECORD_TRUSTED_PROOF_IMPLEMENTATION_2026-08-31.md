# Record SPECIAL authenticated trusted proof — 2026-08-31

상태: `IMPLEMENTED_AUTHENTICATED_TRUSTED_RECORD_FLOW`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`
- `docs/content-wiki/stages/special/EVENT_AND_RECORD_SPECIALS_DETAILED.md`

이 문서는 로그인 계정의 Record SPECIAL이 client 자기신고 점수 대신 server deterministic replay proof로 저장되는 현재 실행 경계를 기록한다.

## 대상

1차 Record SPECIAL 두 모드만 포함한다.

- `record_endless_front` — 끝없는 전선.
- `record_boss_rush` — 보스 러시 9체.

둘 다 `SOLO_ONLY`, 1× 고정, 소탕 불가다.

## 공용 Record 정본

`packages/sim/src/record-content.ts`가 client/server 공유 정본이다.

공유 항목:
- Record mode ID / display metadata / unlock MAIN stage.
- Endless deterministic wave sequence.
- Boss Rush 9보스 순서와 magnification / rest frame.

client와 server가 서로 복사한 별도 배열을 쓰지 않는다.

## authenticated start

client `RecordBattleScene`은 account가 `AUTHENTICATED_ONLINE`이면:

1. active server progress로 local Record runtime을 구성한다.
2. `POST /api/account/battles/start`에 `kind=RECORD`, `targetId=record mode id`만 보낸다.
3. server는 현재 account snapshot / revision을 proof row에 고정한다.
4. server가 같은 canonical Record runtime을 재구성해 `initialStateHash`를 만든다.
5. client local runtime hash와 server hash가 다르면 기록전을 진행하지 않는다.

`AUTHENTICATED_OFFLINE_CACHE`는 기록 조회만 허용하며 새 Record 도전을 시작하지 않는다.
Guest는 기존 local save 경로를 유지한다.

## command proof

client가 server에 보내는 전투 입력은 실제 local simulation이 승인한 명령뿐이다.

- `SPAWN(slotId)`.
- `UPGRADE_SUPPLY`.
- `FIRE_BASE_WEAPON`.

각 명령은 실행 tick과 함께 기록한다.

client는 다음을 proof 입력으로 보내지 않는다.
- 생존 시간.
- 격파 보스 수.
- 승패.
- 최종 HP.
- 적 발견 목록.
- milestone reward.

## server replay

complete 요청은 `battleId + command log`만 받는다.

server는 start 시 고정한 account snapshot으로 Record runtime을 다시 만들고 command를 같은 tick에 재적용한다.

끝없는 전선:
- server가 player base 파괴 시점까지 재생한다.
- `clearFrames`가 authoritative survival frame이다.
- 일반적인 결과 winner는 `ENEMY`지만 이 패배 자체가 정상적인 기록 종료다.

보스 러시:
- server가 실제 boss death transition을 추적한다.
- authoritative `defeatedBosses`를 계산한다.
- 9체 완료 여부를 `recordCompleted`로 계산한다.
- full clear일 때 Record completion을 `PLAYER`로 표현한다.

두 모드 모두 실제 simulation에 등장한 enemy ID만 encounter discovery로 수집한다.

현재 trusted replay abuse/CPU guard는 최대 30분 simulation frame이다. 이는 보상곡선이나 디자인상 목표 기록 상한을 의미하지 않으며, 장기전 사람/서버 부하 QA에서 별도 정책 확정 대상이다.

## claim / account transaction

Record는 일반 MAIN/SPECIAL과 달리 패배해도 그 시점까지의 기록을 저장해야 한다.

따라서 `RECORD` claim은 winner와 무관하게 server completion을 account `RECORD_RESULT` mutation으로 보낸다.

하나의 revision/idempotent mutation에 함께 들어가는 값:
- Endless best time / minute high-water 또는 Boss Rush best defeated high-water.
- 새 milestone resource reward.
- rewarded high-water.
- server replay에서 실제 발견된 enemy IDs.

동일 `battleId` 재전송은 기존 mutation receipt를 replay하며 milestone reward와 discovery를 중복 지급/증가시키지 않는다.

## client result UX

authenticated Record 결과 화면은:

1. complete.
2. server completion target/mode validation.
3. claim.
4. returned account snapshot의 Record progress를 표시.

순서로 처리한다.

trusted proof가 존재하는 account 경로는 server 실패 시 guest save로 fallback하지 않는다.
검증/claim에 실패하면 결과 화면에 머물며 같은 battleId/command log를 `결과 재전송`할 수 있다.

성공 시 상태 문구는 server replay 검증과 account 기록/도감/milestone reward 저장 완료를 명시한다.

## DB migration

`apps/server/migrations/0012_trusted_record_battles.sql`

기존 `trusted_battle_runs` row를 보존하면서 `battle_kind` CHECK를:
- `MAIN`
- `SPECIAL`
- `RECORD`

으로 확장한다.

## 회귀검증

추가 테스트:
- `apps/server/test/trusted-record-battle.test.ts`
- `apps/client/test/record-account-proof.test.ts`

검사 범위:
- shared deterministic Record initial hash.
- server-derived Endless survival frame.
- server-derived Boss Rush defeated count.
- forged score/reward fields가 public HTTP proof 입력에 없음.
- Record + discovery atomic account mutation.
- offline account cache challenge 차단.
- accepted command만 proof log에 기록.
- complete → claim client 순서.
- trusted account 경로의 guest fallback 금지.
- migration이 기존 proof row를 보존.

검증 기준점:
- code/test HEAD `3f26839d238d276a7e861db0a5fd046c604fecf0`.
- GitHub Actions run `33355073898`.
- typecheck / content schema / simulation / server / client / build 전체 green.

## 남은 작업

이 구현은 Record의 authenticated authority 경계를 닫은 것이며, 다음을 완료로 선언하지 않는다.

- Record 장기전 사람 난이도 QA.
- exact milestone 경제 공급량 TESTED/LOCKED 승격.
- 30분 이상 장기전 정책/부하 검증.
- production character/enemy/boss art/motion/audio.
- Record 전용 production VFX/SFX/표현 polish.
