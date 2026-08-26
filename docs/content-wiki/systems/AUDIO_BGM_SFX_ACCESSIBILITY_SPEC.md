# BGM·SFX·접근성·저사양 옵션 상세 사양

상태: `DESIGN_TARGET`  
상위: `docs/GAME_DESIGN_FULL.md`, `UI_SCREEN_LAYOUT_TOUCH_SPEC.md`, 각 캐릭터/보스 art bible

목표는 전투가 복잡해져도 소리와 시각 피드백이 정보 전달을 돕고, 모바일/저사양/감각 민감 사용자가 핵심 게임을 정상적으로 플레이할 수 있게 하는 것이다.

---

# 1. 오디오 기본 철학

오디오는 장식보다 상태 전달이 우선이다.

플레이어가 화면을 잠깐 다른 곳에 보고 있어도 다음을 어느 정도 구분할 수 있어야 한다.

- 캐릭터 생산 성공
- 생산 실패/보급 부족
- 거점 병기 사용
- 아군/적 거점 큰 피해
- 보스 등장
- 위험 공격 예고
- 승리/패배
- S/SS 모집 결과

동시에 모든 공격을 큰 소리로 내서 전투가 소음 덩어리가 되는 것은 금지한다.

---

# 2. Audio Bus

최소 bus:

```text
MASTER
├─ MUSIC
├─ BATTLE_SFX
├─ UI_SFX
├─ AMBIENCE
└─ VOICE(optional)
```

VOICE는 실제 음성 연기를 넣을 때만 활성화한다. 1차에서 필수 아님.

설정 slider:

- Master 0~100
- Music 0~100
- SFX 0~100
- UI 0~100 후보
- Ambience는 SFX와 통합 가능

Mute는 slider 0과 별도 quick toggle 가능.

---

# 3. Web Audio 제약

브라우저 autoplay 정책을 고려한다.

- 첫 사용자 interaction 전 BGM 강제 재생 시도 금지
- 첫 click/tap에서 audio context resume
- resume 실패 시 UI가 깨지지 않음
- tab background/foreground 전환 시 BGM 중복 인스턴스 금지
- visibilitychange 후 시간축 동기화

모바일 Safari/Chrome 모두 검사.

---

# 4. BGM 구조

1차는 지나치게 많은 곡 수보다 **장/상태가 명확히 구분되는 테마군**을 우선한다.

## 메인 메뉴

느낌:

- 전선 지휘소
- 활기 있지만 전투 직전 긴장 과도하지 않음
- 90~120 BPM 후보

장시간 듣는 화면이므로 고주파 반복음과 지나친 브라스 압박 금지.

## 편성/성장/도감

메인 메뉴 motif를 가볍게 변형한 낮은 밀도 곡 또는 동일 곡의 arrangement 후보.

화면 이동마다 곡이 처음부터 재시작되지 않게 한다.

## 모집

평상시:

- 짧은 기대감 loop

결과:

- rarity sting은 BGM과 별도
- S/SS reveal 후 기존 BGM으로 자연스럽게 복귀

---

# 5. 메인 4장 BGM 방향

## 1장 — 뒤집힌 국경

키워드:

- 목재
- 북/스네어
- 피리/현
- 가벼운 행군
- 너무 영웅적이지 않은 초반 모험

보스 layer:

- 낮은 북/금속 percussion 추가

## 2장 — 뒤틀린 숲

키워드:

- 목관
- 현의 tremolo
- 나뭇잎/바람 ambience
- NATURE/UNDEAD가 섞이는 불길함

보스 layer:

- 낮은 합창음 또는 현 texture 후보

## 3장 — 마도도시 세라페

키워드:

- glass bell
- celesta/synth sparkle
- 현/전자음 혼합
- ARCANE/DEMON 대비

보스 layer:

- 불협 화음과 pulse 강화

## 4장 — 기어 제국의 균열

키워드:

- 금속 percussion
- 기계 pulse
- 낮은 synth
- 규칙적 rhythm이 ANOMALY 구간에서 의도적으로 흔들림

단 실제 BPM/simulation timing을 혼동시키는 박자 트릭은 피한다.

---

# 6. SPECIAL BGM

모든 SPECIAL에 전용곡을 만들 필요는 없다.

그룹별 family:

- 재화 SPECIAL: 가볍고 반복 피로 낮음
- 상시 보스: 긴장도 높음
- 이벤트: 테마 전용 motif 가능
- 끝없는 전선: 시간 경과에 따라 layer 추가 후보
- 보스 러시: boss transition sting + 공통 긴장 loop

끝없는 전선에서 1분마다 곡을 바꾸지 않는다. 3~5분 단위 layer 변화가 더 자연스럽다.

---

# 7. PvP BGM

일반/랭킹:

- 전투 긴장감은 높지만 지속적으로 과도한 climax 금지
- 100~140 BPM 후보

매칭:

- 짧은 queue ambience

랭킹 승급:

- 별도 2~4초 sting

친선전:

- 일반 PvP 음악 재사용 가능

---

# 8. BGM 전환

기본 crossfade:

- 메뉴→메뉴: 250~600ms 또는 seamless 유지
- 메뉴→전투: 400~900ms
- 일반→보스 layer: 300~700ms
- 승/패: BGM duck 후 result sting

보스가 나온다고 곡을 처음부터 끊고 다시 시작하는 방식은 피한다.

---

# 9. SFX 재질 Family

공격 SFX는 캐릭터 이름별이 아니라 **재질 family + 크기 + 속성 layer**로 조합 가능하게 한다.

기본 family:

- flesh/soft impact
- wood
- metal light
- metal heavy
- stone
- glass/crystal
- fire
- arcane
- undead/bone
- machine/electric
- void/anomaly
- projectile air

캐릭터별로 같은 family를 쓰더라도 pitch/transient/tail을 바꿔 구별 가능.

---

# 10. 공격 SFX Layer

가능 레이어:

1. windup
2. release/swing
3. projectile travel(optional)
4. impact
5. elemental tail

모든 공격에 5개를 다 넣지 않는다.

멀티히트 5회가 모두 최대 음량 impact를 반복하지 않게 한다.

첫/마지막 hit 강조 후보.

impact는 `ANIMATION_CONTACT_FRAME_TARGETS.md`의 실제 hit ±1 render frame 안에 맞춘다.

---

# 11. 생산 SFX

생산 성공:

- 80~180ms 짧은 확인음
- rarity별로 과도하게 차별하지 않음

보급 부족:

- 낮고 짧은 reject sound
- 250ms 이내
- 반복 spam 시 volume/재생 빈도 제한

cooldown 중:

- 보급 부족과 다른 음색

두 실패 이유를 소리만으로도 어느 정도 구분 가능하게 한다.

---

# 12. 보급/보급소 SFX

보급 획득은 매 tick 소리 내지 않는다.

허용:

- 대량 처치 보급
- 보급소 upgrade
- 보급 cap 상승

보급소 upgrade:

- mechanical/coin confirmation 250~450ms 후보

연속 upgrade 시 귀 피로를 줄인다.

---

# 13. 거점/병기 SFX

거점 일반 피격:

- 일정 cooldown으로 묶어 spam 방지

큰 피해:

- 저역 impact + UI warning

전선포:

- charge/release/impact 분리

결계발진기:

- low pulse + barrier hum

보급투하기:

- deploy whistle/landing crate sound 후보

병기 cooldown ready는 짧은 readiness sound 후보이며 반복하지 않는다.

---

# 14. 보스 SFX

보스 등장:

- 1~2초 signature sting

위험기:

- telegraph cue
- attack impact와 분리
- 시각 flash가 감소 옵션으로 약해져도 소리로 보완 가능

보스마다 완전히 새 오디오 시스템을 만들기보다 family 안에서 signature layer를 추가한다.

---

# 15. 모집 Rarity SFX

C/B:

- 0.2~0.5s
- 빠름

A:

- 0.5~0.8s accent

S:

- 1~1.5s series motif + rarity sting

SS:

- 1.5~2.5s unique sequence
- series identity 포함

이미 본 reveal을 Skip할 때 오디오도 즉시 부드럽게 종료/결과음으로 전환.

Skip 뒤 2초짜리 tail이 계속 재생되면 실패.

---

# 16. 동시 음원 예산

브라우저/모바일을 고려한 DESIGN_TARGET:

- 동일 저중요 impact family: 동시 4~6개까지, 이후 voice stealing
- 캐릭터 공격 전체: 16~24 active voices 후보
- UI: 4
- ambience: 2~4
- music stems: 2~4

최대값은 실제 기기에서 테스트.

중요도 priority:

1. UI critical / boss telegraph
2. base damage / weapon
3. player production feedback
4. large unit attack
5. common attack
6. ambience

---

# 17. Ducking

다음에만 제한적으로 사용:

- boss introduction
- victory/defeat sting
- S/SS reveal
- critical reconnect/system warning 후보

일반 타격마다 BGM duck 금지.

기본 duck:

- Music -3~-6dB
- 0.1~0.25s attack
- 0.3~1s release

TESTED 전에 조정.

---

# 18. 화면 흔들림

설정:

`화면 흔들림`

- 0%
- 50%
- 100%

기본 100 후보.

0에서도:

- hit VFX
- HP 변화
- boss telegraph

는 남아야 한다.

화면 흔들림이 공격 판정 정보를 대신하면 안 된다.

---

# 19. Flash/광과민 대응

설정:

`강한 번쩍임 줄이기`

ON:

- full-screen white flash 제거
- 고주파 밝기 반전 제거
- lightning/explosion alpha 감소
- rapid pulse 횟수 감소

목표:

- 초당 3회 이상의 전체 화면 강한 flash 패턴을 사용하지 않음

보스 공격 예고는 flash가 줄어도 shape/outline/icon으로 남는다.

---

# 20. Reduce Motion

설정:

`움직임 줄이기`

ON:

- 큰 UI slide → fade/짧은 이동
- 모집 camera zoom 감소
- reward card bounce 감소
- background parallax 감소
- 불필요한 idle screen motion 감소

전투 캐릭터 Attack/Move 자체를 제거하지는 않는다.

---

# 21. 색각/대비

핵심 상태는 색만으로 구분하지 않는다.

필수:

- rarity: 색 + C/B/A/S/SS text/icon
- cooldown: 색 + fill/숫자
- online: 색 + 상태 text/icon
- enemy attribute: icon shape + text in codex
- PvP team: 색 + side marker/shape

색각 preset 후보:

- 기본
- 적록 보조
- 청황 보조
- 고대비

초기 1차에서 preset을 전부 완성하기 어렵다면 최소 고대비 + 색 의존 제거는 필수.

---

# 22. UI Scale / Text

설정 후보:

- 90%
- 100%
- 110%
- 125%

COMPACT에서는 125%일 때 일부 layout이 scroll로 전환될 수 있다.

텍스트 확대 때문에 버튼 밖으로 잘리는 것은 실패.

최소 중요한 전투 텍스트는 14px 아래로 내리지 않는다.

---

# 23. 자막/텍스트 정보

음성 연기가 없더라도 boss/system callout은 텍스트/아이콘으로 표시.

음성이 추가될 경우:

- 자막 ON/OFF
- speaker name 후보
- subtitle text size

를 지원한다.

전투 핵심 telegraph를 음성만으로 전달하지 않는다.

---

# 24. 소리 시각화

1차 필수까지는 아니지만 중요한 audio cue는 이미 시각 cue를 가진다.

예:

- boss danger → ground/outline telegraph
- base critical → red border + base icon
- cooldown ready → slot highlight
- matchmaking found → modal

따라서 청각이 없어도 핵심 플레이가 가능해야 한다.

---

# 25. 저사양 그래픽 Preset

후보:

## LOW

- particle density 40~60%
- shadow 단순화
- background parallax 일부 OFF
- post-process OFF
- VFX trail 길이 감소
- decorative animation 감소

## MEDIUM

기본 모바일 후보.

## HIGH

데스크톱 기본 후보.

판정/위험영역 크기는 품질 preset에 따라 바뀌지 않는다.

---

# 26. VFX Density

설정:

- 낮음
- 보통
- 높음

낮음에서도:

- 공격 contact
- boss telegraph
- status icon
- base hit

은 유지.

감소 가능한 것은 decorative particles/tails/background effects.

---

# 27. 해상도/렌더 스케일

Web canvas 구현에 따라 내부 resolution scale 후보:

- 0.75
- 1.0
- 1.25 또는 device native cap

UI 텍스트는 가능한 DOM/vector/high-resolution layer로 유지하여 render scale 때문에 흐려지지 않게 한다.

AUTO 옵션은 frame time을 기준으로 낮출 수 있다.

---

# 28. FPS 목표

- 데스크톱 렌더: 60fps 목표
- 모바일: 60fps 목표, 저사양에서 안정 30fps fallback 허용
- simulation: 항상 30 tick/s 규칙 유지

렌더 FPS 저하 때문에 simulation tick을 임의로 줄이지 않는다.

---

# 29. 배터리/백그라운드

설정 후보:

`배터리 절약`

- render 30fps
- decorative VFX 감소
- background animation 감소

멀티 simulation/network 규칙은 그대로.

browser background에서는 렌더를 줄일 수 있으나 권위 멀티 입력/재접속 상태 처리 필요.

---

# 30. Audio Latency

SFX는 사용자 입력 후 체감 지연이 없어야 한다.

생산 버튼:

- visual press 즉시
- 성공/실패 SFX 최대한 같은 frame/다음 render frame

오디오 asset을 클릭 후 처음 로드해 300ms 늦게 재생하는 것을 피한다.

핵심 짧은 SFX는 preload.

---

# 31. Asset 압축

음악:

- streaming/loop 친화 format
- gapless loop 검사

SFX:

- 짧은 파일은 memory preload 후보
- 중복 decode 금지

모바일 데이터 사용량을 고려해 무손실 원본을 그대로 서비스하지 않는다.

원본 제작 asset과 배포 asset은 분리.

---

# 32. 반복 피로 검사

특히 검사:

- 징집병 같은 저비용 캐릭터 20회 생산
- 멀티히트 10기 동시
- 보급소 빠른 연속 upgrade
- 주기 SPECIAL 반복
- 10회 모집

10분 플레이 후 특정 0.2초 소리가 귀를 찌르거나 지나치게 크게 느껴지면 수정한다.

---

# 33. Mix 기준

정확 LUFS/dB는 최종 믹싱에서 TESTED하지만 상대 원칙:

- UI critical은 일반 공격보다 명료
- boss telegraph는 mix에서 묻히지 않음
- BGM이 모든 impact보다 크지 않음
- common unit 20기의 공격이 하나의 boss attack보다 항상 크지 않음

limiter를 최후 수단으로만 사용하고 과도한 동시 voice를 priority로 줄인다.

---

# 34. 접근성 설정 메뉴 구조

`설정 > 접근성`

후보:

- UI 크기
- 고대비
- 색각 preset
- 화면 흔들림
- 강한 번쩍임 줄이기
- 움직임 줄이기
- VFX 밀도
- 자막/텍스트 옵션

`설정 > 그래픽`

- LOW/MEDIUM/HIGH
- 렌더 스케일/AUTO
- FPS/배터리 절약

`설정 > 오디오`

- Master
- Music
- SFX
- UI

---

# 35. 설정 즉시 반영

- volume: 즉시
- UI scale: 가능한 즉시
- reduce motion: 즉시
- screen shake: 즉시
- flash reduction: 즉시
- graphic preset: 전투 중 적용 가능 여부를 테스트; 필요하면 다음 전투부터

설정이 저장되어 재접속/재실행 후 유지되어야 한다.

---

# 36. 접근성 실패 조건

- 보급 부족을 색만 보고 알아야 함
- boss danger가 flash/소리 하나에만 의존
- 화면 흔들림 0에서 공격이 안 보임
- text scale 후 버튼 겹침
- reduce motion ON인데 모집 화면이 여전히 큰 zoom 반복
- LOW preset에서 적 투사체/위험 범위까지 사라짐
- volume 0인데 HTML/audio element가 따로 소리 냄
- 브라우저 focus 복귀 후 BGM이 두 겹 재생
- 모바일에서 SFX가 지속적으로 200ms 이상 늦음

---

# 37. 테스트 장면

최소:

1. STORY 10종 동시 전투
2. S/SS 대형 캐릭터 포함
3. 멀티히트/기계/마법 혼합
4. 보스 + 위험기
5. 협동 최대 전선 밀도
6. PvP
7. 황금 수송대 반복
8. 10회 모집 SS 포함
9. 640×360 LOW preset
10. 1920×1080 HIGH preset

각 장면에서 frame time, audio voices, 가독성, 피로도를 기록한다.

---

# 38. TESTED 전환

- 대표 모바일 2종 이상
- 저사양 PC 1종
- 일반 desktop 1종
- Chrome/Edge/mobile Chrome/Safari 가능 범위
- headphones + speaker

에서 검사하고 실제 변경값을 기록한 뒤 TESTED로 올린다.
