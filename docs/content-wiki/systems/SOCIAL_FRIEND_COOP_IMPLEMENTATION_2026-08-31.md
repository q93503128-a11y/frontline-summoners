# Social / Friend Co-op Implementation — 2026-08-31

상태: `IMPLEMENTED_AUTHENTICATED_SOCIAL_FRIEND_COOP_FOUNDATION`

기획 정본: `MULTIPLAYER_SOCIAL_PVP.md`  
관련 계정 정본: `ACCOUNT_SAVE_SYNC_SPEC.md`

이 문서는 친구·직접 협동·빠른 통신을 현재 실행 코드에 내린 범위와 남은 제품화 경계를 기록한다. PvP나 공개 매칭까지 완료됐다는 뜻이 아니며 상위 기획 정본을 대체하지 않는다.

## 1. 구현된 소셜 계정 경계

D1 migration `0011_social_graph.sql`과 server social authority가 다음을 저장한다.

- social profile.
- 고유 짧은 friend code.
- display name.
- presence timestamp.
- friend request.
- friendship.
- block relation.
- recent co-op player.
- direct co-op invite.

친구 요청 상태는 실행 경로에서 다음을 구분한다.

- NONE.
- OUTGOING_PENDING.
- INCOMING_PENDING.
- FRIEND.
- BLOCKED.

동일 요청 중복과 자기 자신 대상 요청을 거부한다.

소셜 HTTP는 Bearer authenticated session의 `principal.userId`만 계정 정체성으로 사용한다. client가 accountId를 지정하는 공개 route는 없다.

모든 authenticated social request는 presence timestamp를 갱신하며, summary에서는 TTL 안의 사용자만 online으로 표시한다.

## 2. 친구 UI

메인 메뉴 `친구·초대`에서 `SocialScene`으로 진입한다.

현재 표시/동작:

- 내 display name / friend code / frame id / online 상태.
- friend code 복사.
- display name 변경.
- friend code 직접 입력 요청.
- 친구 목록.
- 받은 친구 요청.
- 보낸 친구 요청 `수락 대기` 상태.
- 친구 삭제.
- 최근 함께 플레이한 사용자.
- 차단 / 차단 해제.
- 받은 직접 협동 초대.
- 친구에게 직접 협동 초대.

닉네임만으로 계정을 유일 식별하지 않으며 정확한 위치 같은 불필요한 개인정보를 표시하지 않는다.

보낸 요청 취소는 현재 canonical 필수 경계가 아니므로 존재하지 않는 cancel endpoint를 임의로 만들지 않았다.

## 3. 차단 우선순위

차단 시 server transaction에서:

- 기존 friendship 제거.
- 양방향 pending friend request 제거.
- pending direct co-op invite 취소.
- 이후 friend request/direct invite 제한.
- recent-player row는 기록 이력으로 남기되 interaction을 제한.
- authenticated friend co-op quick communication 전달을 막음.

신고 시스템은 별도 안전/운영 정책 없이 임의 구현하지 않았다.

## 4. 직접 친구 협동 초대 보안 경계

친구 초대 row에는 `matchId`와 stage 정보만 저장한다.

**co-op join token은 social D1 table에 저장하지 않는다.**

방 생성 시:

1. 서버가 friend 관계와 양쪽 account stage 접근 권한을 검증한다.
2. Durable Object에 A/B account id와 seat token을 귀속한다.
3. 초대한 사람은 A seat websocket path를 받는다.
4. 초대받은 사람이 authenticated 상태로 수락한다.
5. server가 invitee account id와 B seat binding을 내부 호출로 검증한 뒤 B token을 그 요청에만 반환한다.

friend code를 안다는 이유만으로 seat token을 얻는 경로는 없다.

## 5. account-bound 협동 편성

친구전 좌석은 양쪽 authenticated account id에 고정된다.

READY 시 client가 보낸 성장 수치를 신뢰하지 않는다.

서버가 account save v2에서 다시 구성하는 것:

- 현재 deck의 앞 5칸.
- 각 캐릭터 Base Lv.
- +Lv.
- selected form.
- permanent rewards.
- MAIN progression.
- selected base weapon unlock authority.

이를 기존 server co-op runtime validation에 통과시킨 뒤 전투를 시작한다.

게스트 코드 협동은 기존 별도 경로로 유지되며 authenticated friend-coop account 저장과 섞이지 않는다.

## 6. 협동 경제 / 거점 병기

기존 authoritative co-op 규칙을 그대로 사용한다.

- 플레이어당 5칸.
- 개인 supply / max supply / supply level / character cooldown.
- shared battlefield / base / victory condition.
- 팀 공유 base weapon 1슬롯.
- 양쪽 같은 unlocked weapon 합의 후 ready.
- shared cooldown.
- same-frame 양쪽 fire deterministic 1회 승인.
- Supply Drop은 승인된 activator seat 개인 supply에만 지급.

친구전이라고 별도 2배 보상이나 감산을 만들지 않는다.

## 7. 빠른 통신

자유 텍스트 채팅은 넣지 않았다.

canonical 8종만 사용한다.

1. 준비됐어
2. 보급 올릴게
3. 전열 부탁
4. 후열 부탁
5. 병기 쓸게
6. 위험!
7. 기다려
8. 좋아!

server 제한:

- 최소 900ms 간격.
- 8초 창에서 최대 4회.
- 현재 seat를 실제 제어하는 socket만 발신 가능.
- 차단 관계면 상대 seat 전달 금지.

전투 UI에서는 작은 팔레트/상단 알림으로만 표시하고 중앙 전장을 장시간 가리지 않는다.

아직 quick-message 전용 sound on/off production option은 남아 있다.

## 8. 재접속 / AI handoff

기존 Durable Object foundation을 사용한다.

- disconnect 시 seat state/경제/cooldown 유지.
- lockstep deadlock 방지를 위해 AI no-op control로 임시 인계.
- 같은 seat token으로 reconnect하면 player control 복구.
- 실제 AI handoff 이후 복귀한 seat를 `reconnectedSeats`에 server가 기록.

현재 구현은 deterministic continuity foundation이며, 기획의 30초 전후 유예와 모바일/Wi-Fi↔LTE 장기 soak 결과가 LOCKED됐다는 뜻은 아니다.

## 9. authoritative 협동 결과

account-bound friend co-op은 server room의 실제 terminal state에서만 account 결과를 처리한다.

승리 시 각 계정에:

- MAIN이면 `COOP_BATTLE` NORMAL_CLEAR provenance.
- SPECIAL이면 canonical SPECIAL clear.
- first/repeat reward.
- permanent reward / 다음 stage progression.
- periodic charge를 포함한 해당 stage reward semantics.
- 실제 조우 enemy discovery.

를 기존 account mutation authority로 저장한다.

`matchId` 기반 battle id를 사용하므로 동일 terminal settlement 재호출이 보상을 중복 지급하지 않는다.

패배 시:

- clear/progression/reward를 지급하지 않는다.
- authoritative battle snapshots에서 실제 등장한 enemy discovery만 account save에 저장한다.

따라서 협동 도감도 client 자기신고 enemy list를 받지 않는다.

## 10. 최근 플레이어 / achievement fact

authenticated 2인 방 종료 시 두 계정의 recent-player relation을 server가 기록한다.

friend match 승리 시 server가:

- `coop_friend_first`

fact를 기록한다.

실제 AI handoff 뒤 같은 seat로 재접속해 승리하면:

- `coop_reconnected_win`

fact를 기록한다.

이 두 fact는 public client self-report route가 없고 account profile achievement authority가 다시 평가한다.

## 11. 자동 회귀 경계

현재 regression이 고정하는 것:

- social migration table과 join-token 비저장.
- canonical quick message 8종.
- account save에서 co-op loadout 재구성.
- Worker `/api/social` 실제 routing.
- authenticated social request presence refresh.
- account-bound friend seats.
- quick-message cooldown/burst/block.
- reconnect server fact.
- recent-player recording.
- friend/reconnect achievement fact.
- actual authoritative snapshot enemy discovery.
- 승리 clear/reward + discovery.
- 패배 discovery-only settlement.
- outgoing friend request UI.
- friend-coop client가 guest save persistence를 사용하지 않음.

코드 기준점:

- `a9d743d514fcdb69bcd68bfa862dad6641aad1ed`
- GitHub Actions run `33351096636`: typecheck / content schema / simulation / server / client / build 전체 green.

## 12. 남은 multiplayer/social 제품화

이번 closure 밖의 항목:

- 공개 PvE 협동 matchmaking queue와 매칭 조건 완화 정책.
- reconnect grace/AI takeover의 실제 모바일·네트워크 soak와 production UX.
- quick-message sound on/off option.
- friend profile icon/frame 표시와 초대 가능 상태의 최종 presentation polish.
- 계정 session renewal/rotation/revoke-all 및 delete/recovery 같은 account lifecycle.
- 1v1 일반/랭킹/친선 PvP.
- 2v2 일반/친선 PvP.
- MMR/tier/season/leaderboard/PvP achievement source.
- 전체 production art/audio/accessibility/viewport QA.

따라서 현재 상태는 **친구·직접 협동의 authenticated authoritative foundation이 실행 가능한 수준으로 연결된 것**이지, 전체 온라인 1차 완성이 종료됐다는 선언은 아니다.
