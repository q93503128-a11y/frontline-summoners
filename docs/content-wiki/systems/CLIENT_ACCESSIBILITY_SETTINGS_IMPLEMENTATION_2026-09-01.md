# 클라이언트 접근성·저사양 설정 구현 — 2026-09-01

상태: **IMPLEMENTED FOUNDATION + BATTLE FEEDBACK/VFX WIRING / automated coverage authored / device QA pending**

상위 사양: `AUDIO_BGM_SFX_ACCESSIBILITY_SPEC.md`

## 구현 범위

플레이어가 메인 메뉴의 `설정`에서 다음 값을 변경하고 브라우저 재실행 후에도 유지할 수 있는 v1 로컬 설정 계층을 추가했다.

- UI 크기: 90 / 100 / 110 / 125%
- 고대비
- 화면 흔들림: 0 / 50 / 100%
- 강한 번쩍임 줄이기
- 움직임 줄이기
- 그래픽 품질: LOW / MEDIUM / HIGH
- VFX 밀도: LOW / NORMAL / HIGH
- 배터리 절약
- Master / Music / SFX / UI 볼륨: 0 / 25 / 50 / 75 / 100%

저장 키는 `frontline-summoners:client-settings:v1`이며 스키마가 아닌 임의 값, 손상 JSON, storage 접근 실패는 안전한 기본값으로 복구한다. 저장 실패 때문에 게임 진입 자체가 막히지 않는다.

## 실제 런타임 반영

`scene-ui.ts`의 공용 UI 계층이 설정을 읽는다.

- UI 크기는 공용 `addText` 글자 크기에 즉시 반영된다.
- 고대비는 텍스트 외곽선, 버튼 경계와 공용 배경 대비를 강화한다.
- LOW / 낮은 VFX / 배터리 절약은 `drawBackdrop`의 장식 geometry 수를 줄인다. 전투 simulation이나 판정 geometry는 건드리지 않는다.
- 움직임 줄이기 또는 배터리 절약에서는 공용 버튼 press scale motion을 생략한다.
- 화면 흔들림은 공용 `shakeCamera` helper에서 0/50/100% 강도로 제한된다.
- 강한 번쩍임 줄이기는 공용 `flashCamera` helper의 full-screen flash를 차단한다.
- 오디오 값은 `getEffectiveAudioBusGain`으로 MASTER × child bus gain을 한 곳에서 계산한다. 현재 실제 BGM/SFX 배포 asset이 아직 없으므로 오디오 제작 이후에도 별도 설정 체계를 다시 만들지 않고 이 bus 값을 사용한다.

추가로 `battle-feedback-policy.ts`와 `battle-camera-feedback.ts`를 통해 현재 battle scene에 남아 있는 legacy `Camera.shake` / `Camera.flash` 호출도 설정 계층 아래로 넣었다.

- 화면 흔들림 0%는 battle camera shake를 완전히 생략한다.
- 50%는 현재 authored numeric shake intensity의 절반만 적용한다.
- 강한 번쩍임 줄이기는 battle camera full-screen flash를 차단한다.
- 이 compatibility layer는 camera presentation 메서드만 감싸며 simulation step, trusted command recorder, 공격 판정, 보급, 적 스폰, 승패 판정에는 관여하지 않는다.
- 일반 MAIN/SPECIAL은 `ReplayBattleScene -> QuirkBattleScene -> AccessibleBattleScene -> BattleScene` 체인을 사용한다.
- Record Endless/Boss Rush는 `QuirkRecordBattleScene -> AccessibleRecordBattleScene -> RecordBattleScene` 체인을 사용하며 같은 camera feedback gate를 공유한다.
- 따라서 일반/스페셜/trusted/Record 전투의 authored camera feedback이 같은 0/50/100% shake 및 flash reduction 정책을 따른다.

### 전투 VFX 밀도 pass

`battle-vfx-density.ts`를 같은 presentation-only bridge에 연결했다. 이 pass는 전투가 만든 짧은 수명의 shape 중 depth 9~20 presentation layer만 후처리하며, unit sprite/container, 이동 투사체 container, HP/UI, boss warning, simulation object는 대상 밖이다.

LOW 그래픽 / VFX LOW / 배터리 절약에서는 다음처럼 동작한다.

- 피격/공격의 저알파 dust ellipse와 비-stroke glow circle은 생략한다.
- 충격파처럼 위치 정보가 있는 stroke ring은 없애지 않고 투명도만 낮춘다.
- 기지 피격의 넓은 반투명 rectangle flash는 제거하지 않고 강도만 낮춰 피격 위치는 계속 읽힌다.
- slash/pierce tip, 고알파 contact core 등 공격 위치를 읽는 핵심 shape는 유지한다.
- `강한 번쩍임 줄이기`에서는 depth 9~20의 밝은 백색/중성색 local core를 제거하지 않고 절반 강도로 낮춰 타격 위치 정보는 남긴다.
- NORMAL/HIGH는 현재 authored density를 그대로 사용한다. HIGH가 NORMAL보다 추가 particle을 강제로 증식시키지는 않는다. 실제 sprite/VFX asset 제작 시 authored HIGH variant를 별도 확장할 수 있다.

이 후처리는 scene display object만 다루므로 30Hz simulation, hit frame, projectile travel plan, damage, target selection, base weapon 결과에는 영향을 주지 않는다.

`boss-warning.ts`도 같은 battle feedback policy를 소비한다.

- 움직임 줄이기/배터리 절약에서는 등장/퇴장 slide tween 없이 우두머리 이름과 경고 패널을 즉시 표시하고 동일한 표시 시간을 유지한다.
- LOW/VFX LOW/배터리 절약에서는 위·아래 장식선을 생략하되 `우두머리 출현` 문구와 boss name은 제거하지 않는다.
- 화면 흔들림 0에서도 boss telegraph 자체는 항상 남는다.

`화면 흔들림 0`, `강한 번쩍임 줄이기`, `움직임 줄이기`가 공격 판정이나 boss telegraph 자체를 제거하는 구조는 만들지 않는다. 접근성 설정은 presentation-only 경계 안에서만 동작한다.

## 색 의존 제거

이번 구현은 기존 희귀도 C/B/A/S/SS 문자, PvP A/B 및 팀 이름, cooldown 숫자 등 텍스트 표기를 유지하면서 고대비 표시를 추가한다. 색각 preset 전체는 아직 별도 구현하지 않았으며, 상위 사양이 요구하는 1차 최소선인 고대비 + 핵심 상태의 색 단독 의존 회피를 우선한다.

## 자동 회귀 범위

`apps/client/test/client-settings.test.ts`에서 다음을 고정한다.

- 허용 enum/range 외 값의 기본값 복구
- local storage round-trip
- 손상 JSON 안전 복구
- UI scale / screen shake / low-effects 파생값
- MASTER × audio bus gain
- authored 단계값 순환
- 메인 메뉴 → 설정 장면 wiring
- 공용 UI가 UI scale / high contrast / low effects / reduced motion을 소비하는지 확인

`apps/client/test/battle-feedback-accessibility.test.ts`에서 다음을 추가 고정한다.

- 0/50% screen shake scale 계산
- reduced motion duration 0 처리
- battery saver가 battle reduced-motion/decorative policy를 함께 켜는지
- VFX LOW에서 dust/glow 제거, stroke ring 감쇠, base flash 감쇠, 핵심 contact shape 유지
- flash reduction에서 local bright core를 제거하지 않고 감쇠하는지
- MAIN/SPECIAL 재전투 상속 체인과 Record 상속 체인이 각각 camera + VFX bridge를 통과하는지
- boss warning이 reduced motion / reduced decorative effects를 소비하면서 핵심 경고 텍스트를 유지하는지
- battle feedback/VFX policy가 `@frontline/sim`을 import하지 않는 presentation-only 경계

## 아직 TESTED / LOCKED가 아닌 이유

다음 사람 QA 전에는 `TESTED` 또는 `LOCKED`로 올리지 않는다.

- 640×360 및 실제 모바일 COMPACT에서 UI 125% 겹침/잘림 검사
- 고대비 상태의 전체 화면 가독성 검사
- LOW / 배터리 절약 상태의 실기기 frame-time 비교
- 실제 MAIN/SPECIAL/Record 전투에서 camera shake 0/50/100%, flash reduction, boss reduced-motion 동작을 눈으로 대조
- LOW/NORMAL/HIGH VFX를 실제 대규모 교전·보스전에서 대조해 핵심 hit readability가 유지되는지 확인
- 실제 BGM/SFX asset 연결 후 브라우저 autoplay, focus 복귀, bus mute 검증
- 대표 모바일 Safari/Chrome storage 지속성 검사
