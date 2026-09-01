# 로그인 계정 메타 진행 권위 연결 — 2026-09-01

상태: **DESIGN_TARGET / code-wired, integrated CI + human browser QA pending**

상위 정본: `docs/CANONICAL.md`, `docs/GAME_DESIGN_FULL.md`, `docs/GROWTH_RECRUITMENT_DESIGN.md`

## 문제

서버에는 로그인 계정용 메타 mutation 권위가 이미 존재했지만, 다음 핵심 플레이 화면은 게스트 IndexedDB write 함수를 직접 호출하고 있었다.

- 성장: 기본 레벨 / +레벨 / F2·F3 진화 / 형태 선택
- 모집: 유료 1회·10회 / 중복 +레벨·분해
- 편성: 수동 1~10칸 / 자동 편성
- 거점 병기: 장착 변경

따라서 로그인 상태에서도 화면이 계정 서버 정본 대신 게스트 로컬 저장을 변경할 수 있었다. 이는 `수집 → 성장 → 편성 → 실전`의 first-completion 계정 루프를 끊는 문제였다.

## 구현

`apps/client/src/active-meta-progression.ts`를 추가했다.

이 계층은 새 성장 시스템을 복제하지 않는다. 현재 로그인 상태만 판별한 뒤 기존 권위에 위임한다.

| 상태 | 읽기 | 쓰기 |
| --- | --- | --- |
| 게스트 | IndexedDB `GuestProgress` | 기존 guest save/recruitment authority |
| 로그인 + 온라인 | account snapshot | 기존 `/api/account/meta`, `/api/account/recruitment` mutation authority |
| 로그인 + 오프라인 cache | 마지막 account snapshot | 차단하고 온라인 연결 필요 안내 |

계정 mutation 성공 결과는 기존 `account-network.ts`의 `acceptRemoteSave()`를 거치므로 최신 snapshot과 revision이 즉시 클라이언트 계정 상태에 반영된다.

## 성장

`growth-scene.ts`는 이제 `loadActiveProgress()`와 active mutation을 사용한다.

- `CHARACTER_LEVEL`
- `CHARACTER_PLUS_LEVEL`
- `EVOLUTION_UNLOCK`
- `EVOLUTION_SELECT`

비용 계산이나 진화 규칙을 클라이언트에 새로 복제하지 않는다. 계정 온라인 경로의 실제 비용·소유·조건 판정은 기존 서버 mutation authority가 담당하고, 화면은 mutation 전후 resource ledger 차이만 사용해 소비량을 표시한다.

게스트 경로는 기존 IndexedDB 동작을 그대로 유지한다.

## 모집

`recruitment-scene.ts`는 `performActiveRecruitment()`를 사용한다.

게스트에서는 기존 crypto RNG + atomic guest recruitment를 사용한다.

로그인 계정에서는 `/api/account/recruitment`를 사용하므로 다음이 서버 권위다.

- 실제 추첨 RNG
- 모집 결정 소비
- 신규 획득
- 중복 `APPLY_PLUS`
- 중복 `DISMANTLE`
- +50 초과 자동 분해
- revision / request idempotency

계정 save v2에는 banner별 누적 모집 횟수를 정본으로 저장하지 않는다. pity/direct select가 first-completion 범위가 아니므로 이를 위해 save schema를 늘리지 않았다. 대신 계정 UI가 로컬 `0회`를 사실처럼 표시하지 않고 `계정 서버 저장`으로 구분한다.

## 편성

`deck-scene.ts`는 읽기와 쓰기 모두 active authority를 사용한다.

- 수동 편성: 계정 온라인이면 `DECK_SET`
- 게스트 자동 편성: 기존 dynamic guest auto semantics 유지
- 계정 자동 편성: 현재 서버 save schema에 별도 auto-mode를 추가하지 않고, 현재 보유 canonical 순서의 최대 10명을 계산해 구체적인 `DECK_SET` snapshot으로 저장

따라서 전투가 읽는 실제 `deckSlotIds`와 UI가 저장하는 계정 덱이 같은 서버 정본을 사용한다.

## 거점 병기

`base-weapon-scene.ts`는 `BASE_WEAPON_SELECT` active mutation을 사용한다.

로그인 계정에서 장착 변경 후 새 snapshot이 계정 상태에 반영되며, 오프라인 account cache에서는 읽기만 허용한다.

## 회귀 계약

다음 테스트를 active authority 기준으로 갱신했다.

- `apps/client/test/recruitment-ui-wiring.test.ts`
- `apps/client/test/growth-recruitment-loop.test.ts`

다음을 새로 추가했다.

- `apps/client/test/active-meta-progression-wiring.test.ts`

새 회귀는 다음 경계를 고정한다.

1. guest write는 기존 guest authority에 위임된다.
2. 로그인 온라인 write는 account meta/recruitment mutation을 사용한다.
3. 성장·모집·편성·거점 병기 화면이 guest mutation API를 직접 호출하지 않는다.
4. account 모집 결과를 다시 로컬 duplicate-growth 로직에 통과시키지 않는다.
5. account 자동 편성을 위해 새로운 save-schema mode를 임의로 만들지 않는다.

## TESTED 승격 조건

content wiki 의미상 `TESTED`는 자동 검사만으로 승격하지 않는다. 다음을 모두 마친 뒤 TESTED 후보가 된다.

- 통합 CI green
- 실제 브라우저 게스트: 모집 → 성장 → 편성 → 거점 병기 → 전투 확인
- 실제 브라우저 로그인 계정: 동일 루프 확인
- 계정 로그아웃/재로그인 후 서버 저장 유지 확인
- 로그인 계정 오프라인 cache에서 write 차단·read 유지 확인
- 모바일/데스크톱에서 mutation 중 중복 클릭 및 오류 문구 확인

production character art/audio는 이 구현 범위와 무관하며 후반 productization 단계에 남긴다.
