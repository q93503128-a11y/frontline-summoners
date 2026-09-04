# Third Slice Mid-Wave Production — 2026-09-04

상태: `AWAITING_ART / UNREVIEWED / PENDING`

이 문서는 제1장 `main_01_004`~`main_01_008`의 세 번째 production candidate 묶음을 기록한다. 자동 materialize 결과나 review runtime 표시는 사람 승인 또는 정식 review evidence가 아니다.

## 신규 유닛 후보

- 결투검사 F1 / 검무가 F2 / 일섬검객 F3
- 청창대 F1 / 장창방진 F2 / 파진창대 F3
- 전투마도사 F1 / 전선술사 F2 / 포격마도사 F3
- 적 `enemy-sniper` · 유리봉 사수

총 `10 targets × 5 motions = 50 PNG strips`.

### 실루엣·모션 핵심

- 결투검사: 얇은 세검과 좁은 체형. F3는 낮은 발도 자세와 짧은 한 줄 contact가 핵심.
- 청창대: 수렵창병과 달리 몸통이 넓고 넓은 창날 + 등 깃발. F2가 최장 창, F3는 창을 다시 줄이는 대신 가장 넓은 날과 횡쓸기 언어를 사용.
- 전투마도사: 로브-only 마법사 금지. 전술 가방/보호구/주문판을 유지하며 F3 포격마도사는 공격할 때만 후방 포격 링이 크게 열린다.
- 유리봉 사수: player hunter와 충돌하지 않게 활 정체성을 약화하고 긴 유리봉/프리즘 조준기/긴 조준 후 단발 discharge를 강조한다.

simulation contact 정본은 기존 runtime 값을 유지한다.

- duelist: 8F
- lancer: 14F
- battlemage: 19F
- enemy-sniper: 58F

production local sprite contact frame은 각 strip 내부 접촉 프레임이며 `production-motion.ts`가 simulation timing에 맞춰 재생한다.

## 전장 후보

신규:

- `fortress` · `main_01_004 녹슨 방패선`
- `burning` · `main_01_005 붉은 물결`
- `moon` · `main_01_007 유리봉 능선`

각 테마는 `battlefield-base / background-landmarks / foreground-low-density` 3레이어다.

재사용:

- `canyon` · `main_01_006`
- `ruins` · `main_01_008`

두 테마는 second-slice에서 만든 production candidate를 그대로 재사용한다.

## 명시적 보류

`enemy-sprinter / 달림개`는 `BEAST`다. 현재 검증된 human CC0 family를 억지로 변형해 짐승으로 쓰지 않는다. 적합한 합법 비인간 source 또는 original production art가 확보될 때까지 placeholder/source-reference 상태를 유지한다.

## Review runtime

기본:

`?productionReview=third-slice`

형태 강제:

- `duelistForm=f1|f2|f3`
- `lancerForm=f1|f2|f3`
- `battlemageForm=f1|f2|f3`

review mode는 presentation-only다. normal runtime authority, progression, save, trusted combat logging은 변경하지 않는다.

## 생성·검증

- `tools/lib/production-png.mjs`
- `tools/materialize-third-slice-production-art.mjs`
- `tools/assemble-third-slice-horizontal-strips.mjs`
- `tools/materialize-third-slice-battlefields.mjs`
- `tools/validate-third-slice-runtime-files.mjs`

root `npm run assets:production:check`가 first / second / third slice를 순서대로 생성·검증한다.

## 승인 계약

아래는 현재 모두 미충족이다.

- 실제 BattleScene review capture
- 8~12기 중첩 가독성 사람 판정
- 각 F1/F2/F3 closest-three 사람 판정
- source/reference sufficiency 확인
- canonical provenance promotion
- human reviewer / reviewedAt

따라서 이 묶음은 `APPROVED`, `READY_FOR_REVIEW`, normal runtime-authoritative로 올리지 않는다.
