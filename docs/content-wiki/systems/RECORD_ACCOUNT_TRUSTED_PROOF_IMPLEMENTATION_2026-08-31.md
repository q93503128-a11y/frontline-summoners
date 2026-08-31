# Record SPECIAL 계정 Trusted Proof 구현 — 2026-08-31

상태: `IMPLEMENTED_AUTHENTICATED_TRUSTED_RECORD_FLOW`

상위 정본:
- `docs/CANONICAL.md`
- `docs/content-wiki/stages/special/EVENT_AND_RECORD_SPECIALS_DETAILED.md`
- `docs/content-wiki/systems/ACCOUNT_SAVE_SYNC_SPEC.md`

이 문서는 끝없는 전선 / 보스 러시의 로그인 계정 경로에서 클라이언트가 기록 점수나 보상을 자기신고하지 못하도록 만든 server replay proof 구현을 기록한다.

## 1. 공용 Record 정본

`@frontline/sim/record-content`에 다음을 공용화했다.

- Record mode ID / unlock stage / 1× / SOLO_ONLY / sweep 금지.
- 끝없는 전선 deterministic wave sequence.
- 보스 러시 9보스 순서와 magnification / rest frame.

client와 server가 같은 정의를 직접 사용한다.

## 2. account snapshot 기반 server runtime

`apps/server/src/account-trusted-battle-runtime.ts`

server가 account save v2에서 다음을 읽어 Record 초기 전투를 재구성한다.

- deck.
- Base Lv / +Lv.
- selected evolution form.
- permanent reward effects.
- selected base weapon.

끝없는 전선:
- mapLength 2600.
- base HP 8000 후보값에 permanent 효과 적용.
- starting supply 300.
- shared authored endless waves.

보스 러시:
- mapLength 2850.
- base HP 9000 후보값에 permanent 효과 적용.
- starting supply 350.
- shared 9-boss sequence.
- first boss delay 90F.

## 3. trusted ticket / replay / completion

`trusted_battle_runs`의 battle kind를 `MAIN | SPECIAL | RECORD`로 확장했다.

migration:
- `apps/server/migrations/0012_trusted_record_battles.sql`

기존 proof row를 새 table로 복사한 뒤 CHECK를 확장하므로 기존 MAIN/SPECIAL proof를 버리지 않는다.

Record start:
- server account revision 고정.
- start snapshot JSON 고정.
- canonical Record unlock 재검증.
- initial deterministic state hash 고정.

client가 제출 가능한 것은 기존 trusted battle과 동일한 accepted command log뿐이다.

- SPAWN.
- UPGRADE_SUPPLY.
- FIRE_BASE_WEAPON.

client가 제출하지 않는 것:
- survival time.
- reached minute.
- defeated boss count.
- completed flag.
- reward.
- enemy discovery.
- winner.

server replay가 이를 모두 산출한다.

## 4. Record terminal semantics

Record는 일반 전투의 `PLAYER 승리` 보상 규칙을 사용하지 않는다.

끝없는 전선:
- player base 파괴까지 replay.
- terminal battle tick을 survival frame으로 사용.
- 해당 frame에서 survival ms / reached minute을 authoritative mutation이 계산.

보스 러시:
- player base 파괴 또는 9보스 완료까지 replay.
- 실제 server runtime의 `defeatedBosses`를 저장.
- client가 boss count를 제출하지 않음.

따라서 Record 실패도 그 시점까지 새로 달성한 기록과 milestone을 저장할 수 있다.

## 5. account claim / enemy discovery

Record claim은 stored replay completion에서만 입력을 만든다.

- 끝없는 전선: `survivalFrames`.
- 보스 러시: `defeatedBosses`.
- actual simulation encounter enemy IDs.

`RECORD_RESULT` account mutation 한 revision에서:
- record high-water.
- 신규 milestone reward.
- enemy discovery.
을 함께 저장한다.

같은 battleId/idempotency receipt 재전송은 재지급하지 않는다.

## 6. client flow

로그인 온라인:

`record-hub → trusted RECORD start → record-battle → server complete replay → server claim → record-result`

- RecordHub는 active account progress로 unlock/record를 읽음.
- `AUTHENTICATED_OFFLINE_CACHE`에서는 Record 새 출전을 차단.
- ticket start revision이 local remote revision과 다르면 시작 거부/refresh.
- RecordBattle은 initial hash를 server ticket과 대조.
- 실제 local sim에서 성공한 command만 recorder에 기록.
- account Record 전투는 guest enemy discovery/save writer를 사용하지 않음.
- RecordResult는 server replay terminal fingerprint와 local terminal을 대조한 후 claim.
- trusted branch에서 guest record writer fallback 없음.

게스트:
- 기존 local Record save 경로를 유지한다.

## 7. 검증

주요 회귀:
- `apps/server/test/trusted-record-battle.test.ts`
- `apps/client/test/record-account-proof.test.ts`
- 기존 trusted battle/account mutation/client suites.

검증 범위:
- RECORD kind ticket.
- canonical unlock.
- deterministic initial hash.
- endless server-derived survival score.
- boss-rush server-derived defeated count.
- server-derived enemy discovery.
- forged client score/reward field 무시.
- account Record mutation과 discovery 동시 저장.
- migration이 기존 proof rows를 보존.
- client accepted-command recorder.
- online-only account Record start.
- complete-before-claim 순서.
- trusted branch의 guest writer 차단.

최종 코드 기준:
- commit `156c65fec3698fbdc3bbf70e41cb46f379137d0c`
- CI run `33357731317` (#874)
- typecheck / content schema / simulation / server / client diagnostics / client suite / build 전체 green.

## 8. 남은 Record 작업

기능 proof 경계는 닫혔지만 다음은 TESTED/LOCKED가 아니다.

- 장기 사람 플레이 난이도 QA.
- milestone resource 공급량 경제 검증.
- production character/enemy/boss art와 contact motion.
- Record 전용 BGM/SFX/VFX polish.
- 기록 시즌/versioning은 밸런스가 실제로 크게 바뀔 때 별도 설계.

세 번째 Record mode는 현재 추가하지 않는다.
