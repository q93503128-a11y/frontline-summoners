# First Slice Production Preflight — 2026-09-04

상태: `RUNTIME CANDIDATES MATERIALIZED / PREFLIGHT AUTOMATED / HUMAN CAPTURE + REVIEW PENDING`

이 문서는 `FIRST_PRODUCTION_REVIEW_PACKAGE_2026-09-02.md`의 계약을 바꾸지 않는다. 현재 실제 구현 상태와 사람 검수 직전 준비물을 기록한다.

## 현재 존재하는 runtime candidate

### Units

- `unit:militia:militia_f1`
- `unit:militia:militia_f2`
- `unit:militia:militia_f3`
- `unit:enemy-raider`
- `unit:enemy-boss`

각 target은 현재 `Idle / Move / Attack / Knockback / Death` 5개 strip을 실제 production asset 경로에 가진다.

Runtime metadata:

`apps/client/public/assets/production/units/first-slice-runtime-metadata.json`

### Battlefield

- `battlefield:meadow`

Runtime candidate:

`apps/client/public/assets/production/battlefields/meadow/battlefield-base.svg`

Metadata:

`apps/client/public/assets/production/battlefields/meadow/meadow-runtime-metadata.json`

### Audio

- Chapter 1 battle loop
- slash contact
- pierce contact
- light impact
- heavy impact
- boss warning
- boss void cast

Metadata:

`apps/client/public/assets/production/audio/first-slice-audio-runtime-metadata.json`

모두 deterministic project-authored candidate이며 human review 완료 상태가 아니다.

## Review runtime

실제 BattleScene에서 미승인 candidate를 격리해 보는 query:

`?productionReview=first-slice`

정상 production resolver에는 영향을 주지 않는다. 승인되지 않은 candidate는 일반 runtime authority가 아니다.

징집병 비교용:

`militiaForm=f1|f2|f3`

review overlay에서도 `AUTO / F1 / F2 / F3`를 즉시 바꿀 수 있다.

## Preflight console

`/first-slice-art-review.html`

다음 계약 viewport를 내부 frame으로 재현한다.

- `1280x720`
- `844x390`
- `640x360`

또한:

- actual meadow candidate background
- 12-unit overlap
- grayscale
- bright/dark
- contact frame
- 5-motion crop
- boss inclusion
- closest-three difference memo candidate

를 한 화면에서 확인할 수 있다.

이 console 자체는 gameplay screenshot evidence가 아니다.

## 자동 생성 preflight PNG

Generator:

`tools/materialize-first-slice-review-preflight.mjs`

Output:

`assets/raw/production/review/vertical-slice-01/preflight/`

Client mirror:

`apps/client/public/assets/production/review/vertical-slice-01/preflight/`

자동 생성되는 보드:

1. `reference-sheet.png`
2. `silhouette-comparison.png`
3. `motion-key-poses.png`
4. `contact-board.png`
5. `scale-sheet.png`
6. `closest-three-differences.png`

`preflight-manifest.json`에는 SHA-256, dimensions, source status, contract mapping과 `READY_FOR_REVIEW`까지 남은 항목을 기록한다.

이 PNG들은 실제 committed sprite에서 재생성한 preflight 자료다. 정식 runtime screenshot capture나 human approval을 대신하지 않는다.

## 현재 lifecycle

6개 visual target은 계속 `AWAITING_ART`를 유지한다.

이유:

- review contract의 exact-size 실제 runtime PNG capture가 아직 없음
- side reference가 turnaround 대체로 충분한지 사람 판단 전
- closest-three 차이 판독을 사람이 승인하지 않음
- target provenance가 canonical review package의 reviewable state로 아직 승격되지 않음
- human checklist가 아직 시작되지 않음

따라서 `review-package-01.json`의 evidence/captures/provenance를 임의로 채우거나 `READY_FOR_REVIEW`/`APPROVED`로 올리지 않는다.

## 다음 인간 검수 단계

1. `?productionReview=first-slice` 실제 BattleScene에서 계약 viewport별 PNG capture
2. silhouette / overlap / bright-dark / contact / boss-small-screen 확인
3. reference-sheet가 충분한 reference인지, 추가 turnaround가 필요한지 판정
4. target별 closest-three 차이 메모 확정
5. provenance와 실제 capture를 canonical review package에 연결
6. 그때만 `READY_FOR_REVIEW`
7. reviewer checklist 완료 후에만 `APPROVED`
