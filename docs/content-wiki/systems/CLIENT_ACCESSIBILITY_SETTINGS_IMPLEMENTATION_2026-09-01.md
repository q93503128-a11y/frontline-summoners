# 클라이언트 접근성·저사양 설정 구현 — 2026-09-01

상태: **IMPLEMENTED FOUNDATION / automated coverage authored / device QA pending**

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

`화면 흔들림 0`, `강한 번쩍임 줄이기`가 공격 판정이나 boss telegraph 자체를 제거하는 구조는 만들지 않는다. 공용 helper는 장식 camera feedback만 제어한다.

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

## 아직 TESTED / LOCKED가 아닌 이유

다음 사람 QA 전에는 `TESTED` 또는 `LOCKED`로 올리지 않는다.

- 640×360 및 실제 모바일 COMPACT에서 UI 125% 겹침/잘림 검사
- 고대비 상태의 전체 화면 가독성 검사
- LOW / 배터리 절약 상태의 실기기 frame-time 비교
- 실제 camera shake/flash 연출이 추가되거나 연결된 장면에서 0%/reduction 검증
- 실제 BGM/SFX asset 연결 후 브라우저 autoplay, focus 복귀, bus mute 검증
- 대표 모바일 Safari/Chrome storage 지속성 검사
