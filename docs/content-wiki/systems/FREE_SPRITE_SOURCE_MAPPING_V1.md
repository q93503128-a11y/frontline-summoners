# 무료 스프라이트 소스 매핑 v1 — 43인 로스터

상태: `DESIGN_TARGET / SOURCE_SELECTION`  
연결 정본: `PREMIUM_CHARACTER_ART_DIRECTION.md`, 각 캐릭터/모집 아트 바이블, `assets/raw/ASSET_REGISTRY.md`

목적은 무료 스프라이트를 43명에게 억지로 덮어씌우는 것이 아니라, **통일이 이득인 일반군은 검증된 CC0 계열을 적극 재가공하고 S/SS·간판 캐릭터는 전용 제작으로 빼는 것**이다.

이 문서는 source/base 선택표다. 여기서 `SELECTED`라고 적어도 production target을 `READY_FOR_REVIEW`나 `APPROVED`로 승격하지 않는다. 실제 runtime PNG, provenance, capture evidence, 사람 검수가 모두 따로 필요하다.

## 분류 코드

- `BASE_REWORK`: 무료 sprite의 pixel density/기본 동작/몸체 일부를 출발점으로 삼을 수 있음. 최종형은 파츠와 실루엣 재작업 필수.
- `MOTION_REFERENCE`: 원본 픽셀을 최종 몸체로 쓰지 않고 애니메이션 리듬/포즈만 참고.
- `CUSTOM_CREATURE`: 고유 골격 때문에 무료 인간형/몬스터를 억지로 맞추지 않고 전용 제작.
- `CUSTOM_PREMIUM`: S/SS/간판급 전용 제작. 무료 sprite는 필요하면 모션 참고만 허용.
- `CUSTOM_TECH`: SF/기계 골격 전용 제작.

## 무료 source key

현재 런타임 placeholder 또는 검증된 무료 후보만 적는다.

- `LZ-HERO1` — LuizMelo Hero Knight, CC0.
- `LZ-HERO2` — LuizMelo Hero Knight 2, CC0.
- `LZ-FW` — LuizMelo Fantasy Warrior, CC0.
- `LZ-WIZ` — LuizMelo Wizard Pack, CC0.
- `LZ-EVILWIZ` — LuizMelo Evil Wizard, CC0.
- `LZ-HUNT1` — LuizMelo Huntress, CC0.
- `LZ-HUNT2` — LuizMelo Huntress 2, CC0 source candidate.
- `LZ-MW1` — LuizMelo Medieval Warrior Pack, CC0 source candidate.
- `LZ-MW2` — LuizMelo Medieval Warrior Pack 2, CC0.
- `LZ-MW3` — LuizMelo Medieval Warrior Pack 3, CC0 source candidate.
- `LZ-KING1` — LuizMelo Medieval King Pack, CC0 source candidate.
- `LZ-KING2` — LuizMelo Medieval King Pack 2, CC0 source candidate.
- `LZ-MON1` — LuizMelo Monsters Creatures Fantasy, CC0 source candidate.
- `LZ-MON2` — LuizMelo Monsters Creatures Fantasy 2, CC0 source candidate.

무료 후보는 원출처에서 라이선스를 다시 확인한 뒤 실제 인입한다. 유료이거나 현재 무료 다운로드가 아닌 LuizMelo pack은 이 v1의 무료 후보에서 제외한다.

---

# A. 스토리 확정 획득 10종

| characterId | 캐릭터 | 제작 분류 | 우선 source | 실제 제작 지시 |
| --- | --- | --- | --- | --- |
| `char_story_militia` | 징집병 | `BASE_REWORK` | `LZ-MW2`, `LZ-MW3` | 짧은 실용 무기, 배낭, F1 급조/F2 정돈/F3 낮은 자세를 새 파츠로 분리. |
| `char_story_guard` | 방벽기사 | `BASE_REWORK` | `LZ-HERO2`, `LZ-MW2` | 몸보다 큰 직사각 방패를 새로 제작. 원본 기사 실루엣보다 방패가 먼저 읽혀야 함. |
| `char_story_hunter` | 수렵창병 | `BASE_REWORK` | `LZ-HUNT1`, `LZ-HUNT2` | 이동/신체 리듬만 활용하고 장창·덫·짧은 망토는 전용 제작. |
| `char_story_duelist` | 결투검사 | `BASE_REWORK` | `LZ-FW`, `LZ-HERO2` | 두꺼운 검을 그대로 쓰지 않고 얇은 세검/코트 외곽선으로 교체. |
| `char_story_blue_lancer` | 청창대 | `BASE_REWORK` | `LZ-MW1`, `LZ-MW2` | 넓은 창날, 겹천 갑주, 짧은 등 깃발로 수렵창병과 체형부터 분리. |
| `char_story_battlemage` | 전투마도사 | `BASE_REWORK` | `LZ-WIZ` | 로브 복제 금지. 무릎 외투·전술 가방·주문판을 새 파츠로 추가. |
| `char_story_pyromancer` | 화염술사 | `BASE_REWORK` | `LZ-WIZ`, `LZ-EVILWIZ` | 등 화로/불씨 항아리가 본체보다 먼저 읽히도록 재구성. |
| `char_story_royal` | 왕실기사 | `BASE_REWORK` | `LZ-KING1`, `LZ-HERO1` | 높은 키, 장식 깃털, 넓은 대검을 새로 제작. 방패형 금지. |
| `char_story_heretic` | 이단주술사 | `BASE_REWORK` | `LZ-EVILWIZ` | 비대칭 가면·부적·긴 주술 도구를 전용 제작. Evil Wizard 색놀이 금지. |
| `char_story_voidsage` | 공허현자 | `MOTION_REFERENCE` | `LZ-WIZ`, `LZ-EVILWIZ` | 인간형 기본 모션만 참고. 공허 조각·부유 검은 판/구체 때문에 최종 몸체는 사실상 전용 제작. |

## 첫 production vertical slice 적용

`char_story_militia` F1/F2/F3는 기존 실루엣 concept를 최종 픽셀로 옮기는 대신 `LZ-MW2/MW3`의 픽셀 밀도와 동작 구조를 참고해 새 파츠를 만든다. 기존 `militia-raider-silhouette-v2`는 비율/외곽선 참고 기록으로만 남긴다.

---

# B. 공통 모집 C/B/A 15종

| characterId | 캐릭터 | 제작 분류 | 우선 source | 실제 제작 지시 |
| --- | --- | --- | --- | --- |
| `char_common_c_turnip_rider` | 순무기수 | `CUSTOM_CREATURE` | 없음 | 순무 탈것이 본체인 고유 저상 골격. 억지 인간 sprite 합성 금지. |
| `char_common_c_tin_squire` | 양철방패 시종 | `BASE_REWORK` | `LZ-MW2`, `LZ-HERO2` | 작은 몸체만 활용하고 찌그러진 대형 양철방패 전용 제작. |
| `char_common_c_slinger` | 목동 투석수 | `BASE_REWORK` | `LZ-HUNT2` | 보행/회전 동작 참고 + 아주 긴 투석끈과 양털 망토 전용 제작. |
| `char_common_c_bell_crab` | 종껍질 게 | `CUSTOM_CREATURE` | 없음 | 종형 껍질과 게 골격 전용. |
| `char_common_c_lantern_moth` | 등불나방 | `CUSTOM_CREATURE` | `LZ-MON1`, `LZ-MON2` motion | Flying Eye/Bat의 부유 리듬만 참고. 나방·등불 복부는 새로 제작. |
| `char_common_b_lantern_witch` | 등불마녀 | `BASE_REWORK` | `LZ-WIZ` | 마녀 몸체보다 살아 있는 대형 등불의 후행/공전 구조가 핵심. |
| `char_common_b_clockduck` | 태엽오리기사 | `CUSTOM_CREATURE` | 없음 | 황동 오리+태엽키 고유 골격. |
| `char_common_b_coffin_merchant` | 관짝 장사꾼 | `BASE_REWORK` | `LZ-KING1`, `LZ-MW3` | 인간 이동만 베이스. 세로 관과 F3 영구차 구조 전용 제작. |
| `char_common_b_moss_golem` | 이끼골렘 | `CUSTOM_CREATURE` | `LZ-MON1` motion | Mushroom의 무게감 참고 가능. 뿌리/고목 중심 골렘은 전용 제작. |
| `char_common_b_ink_raven` | 먹물까마귀 | `CUSTOM_CREATURE` | `LZ-MON1`, `LZ-MON2` motion | Flying Eye/Bat의 비행 주기만 참고, 실제 군집은 하나의 붓획 실루엣으로 새로 제작. |
| `char_common_a_glass_keeper` | 유리등대지기 | `MOTION_REFERENCE` | `LZ-WIZ`, `LZ-EVILWIZ` | 인간/마도사 리듬 참고. 유리 등대 포격 구조는 전용. |
| `char_common_a_bonedrum` | 뼈북 악단장 | `BASE_REWORK` | `LZ-MON1` Skeleton | Skeleton body 사용 후보. 거대한 뼈북/지휘 실루엣과 3연타 모션은 새로 제작. |
| `char_common_a_paper_dragon` | 접지 않은 종이용 | `CUSTOM_CREATURE` | 없음 | 한 장의 종이가 용이 되는 형태라 전용 제작. |
| `char_common_a_meteor_cart` | 고철 운석차 | `CUSTOM_CREATURE` | 없음 | 투석기+기계 생물 복합 골격 전용. |
| `char_common_a_mirror_guide` | 거울길잡이 | `MOTION_REFERENCE` | `LZ-WIZ` | 본체 모션 참고만. 떠다니는 거울 조각이 실루엣 중심. |

---

# C. SERIES 01 — 성휘의 기사단 6종

**전원 `CUSTOM_PREMIUM`.** 무료 sprite를 최종 얼굴/몸체로 승격하지 않는다. 여섯 캐릭터 모두 명확한 성인 여성로 제작하며 `PREMIUM_CHARACTER_ART_DIRECTION.md`의 상품성 규칙을 적용한다.

| characterId | 캐릭터 | 분류 | 모션 참고 후보 | 프리미엄 핵심 |
| --- | --- | --- | --- | --- |
| `char_s01_elsia` | 에르시아, 백은의 창 | `CUSTOM_PREMIUM` | `LZ-MW3`, `LZ-FW` | 장신, 긴 은발 포니테일, 초장 랜스. 길고 우아한 전신선. |
| `char_s01_riena` | 리에나, 불량 성녀 | `CUSTOM_PREMIUM` | `LZ-HERO1`, `LZ-KING2` | 작은 체구의 성인 여성 + 거대 철퇴 대비. 거친 자세와 성녀 장식의 충돌. |
| `char_s01_mireille` | 미레이유, 유리궁의 사수 | `CUSTOM_PREMIUM` | `LZ-HUNT1`, `LZ-HUNT2` | 풍성한 드레스와 초대형 수정 활. 후열에서도 얼굴/헤어가 묻히지 않게. |
| `char_s01_neria` | 네리아, 흑장미 기사 | `CUSTOM_PREMIUM` | `LZ-HERO1`, `LZ-HERO2`, `LZ-FW` | 성인 여성 중갑 기사. 비대칭 갑주 + 거대 한손검, 갑옷과 체형의 대비. |
| `char_s01_totoria` | 토토리아, 마도인형사 | `CUSTOM_PREMIUM` | `LZ-WIZ`, `LZ-HUNT2` | 작은 체구의 **성인 여성**으로 고정. 본체보다 큰 인형이 실루엣 중심. |
| `char_s01_arselia` | 아르셀리아, 별의 왕녀 | `CUSTOM_PREMIUM` | `LZ-WIZ` motion only | SS. 전용 portrait + 전용 전투 sprite. 천체 구조체와 망토가 희귀도 첫인상. |

성휘 기사단은 노출을 일괄 유니폼처럼 넣지 않는다. 캐릭터별로 어깨/등/복부/허벅지/하이슬릿 등 가능한 영역을 분산하고 갑주·드레스·직업 소품과 조합한다. 얼굴, 체형, 하체 구조, 포즈 반복을 금지한다.

---

# D. SERIES 02 — 태고의 거수 6종

무료 몬스터 pack은 움직임 참고에는 유용하지만 이 시리즈의 핵심은 골격 차이이므로 **최종은 전원 고유 제작**한다.

| characterId | 캐릭터 | 분류 | 모션 참고 후보 | 고유 골격 |
| --- | --- | --- | --- | --- |
| `char_s02_barga` | 돌등껍질 바르가 | `CUSTOM_CREATURE` | `LZ-MON2` Rat/Slime 정도의 보행 리듬 참고 | 바위산 등껍질 네발 거수. |
| `char_s02_zirka` | 꼬리칼날 지르카 | `CUSTOM_CREATURE` | `LZ-MON2` Rat | 작은 몸 + 몸길이 3배 낫꼬리. |
| `char_s02_mogu` | 풍선포자 모구 | `CUSTOM_CREATURE` | `LZ-MON1` Mushroom/Flying Eye | 거대 균류 부유체. |
| `char_s02_gardo` | 천공턱 가르도 | `CUSTOM_CREATURE` | `LZ-MON2` Mimic attack rhythm | 몸 절반 이상이 턱인 네발 골격. |
| `char_s02_kreik` | 수정벌레 크리크 | `CUSTOM_CREATURE` | `LZ-MON2` low-body motion | 육족 절지 + 등 수정 기둥. |
| `char_s02_gormu` | 고대등짐 고르무 | `CUSTOM_PREMIUM` | 없음 | SS. 산/폐허를 짊어진 육족 이동 요새. 다른 pack에 맞추지 않음. |

---

# E. SERIES 03 — 제로 엣지 6종

LuizMelo 판타지 인간형에 기계 색만 입히는 방식은 금지한다. 이 시리즈는 별도 SF pixel language를 구축한다.

| characterId | 캐릭터 | 분류 | 무료 base | 고유 제작 지시 |
| --- | --- | --- | --- | --- |
| `char_s03_k17` | K-17 절단자 | `CUSTOM_TECH` | 없음 | 얇은 휴머노이드 + 팔 자체가 에너지 블레이드. |
| `char_s03_arc_railer` | 아크 레일러 | `CUSTOM_TECH` | 없음 | 다리 없는 레일건 본체. |
| `char_s03_nana04` | NANA-04 | `CUSTOM_PREMIUM` | 없음 | 성인 인간형 오퍼레이터로 확정할 경우 프리미엄 여성 규칙 적용 가능. 드론 4기가 실루엣 중심. |
| `char_s03_rxomega` | 방벽기 RX-Ω | `CUSTOM_TECH` | 없음 | 방패가 상체인 로봇. |
| `char_s03_blade_hound` | 크로노 블레이드 하운드 | `CUSTOM_TECH` | 없음 | 무두형 네발 + 펼쳐지는 다중 칼날. |
| `char_s03_overlay_astra` | 아스트라 프레임 | `CUSTOM_PREMIUM` | 없음 | SS. 중앙 코어 + 독립 칼날 모듈 6~8개. 전용 시그니처 제작. |

---

# 43인 집계

- 스토리: 10
- 공통 C/B/A: 15
- SERIES 01: 6
- SERIES 02: 6
- SERIES 03: 6
- **총 43**

제작 전략 집계:

- 무료 sprite를 실제 출발점으로 쓸 수 있는 `BASE_REWORK`: 12
- 동작만 참고하는 `MOTION_REFERENCE`: 3
- 고유 생물 `CUSTOM_CREATURE`: 10
- 프리미엄 전용 `CUSTOM_PREMIUM`: 9
- SF 전용 `CUSTOM_TECH`: 5
- 나머지 4는 위 표에서 복합 고유 제작/프리미엄 분류에 포함되며, 실제 인입 시 source provenance를 캐릭터 단위로 확정한다.

> 숫자보다 중요한 규칙: 무료 sprite가 디자인을 결정하지 않는다. 무료 원본이 바이블에 안 맞으면 해당 캐릭터는 즉시 전용 제작으로 올린다.

# 다음 production 순서

1. `char_story_militia` F1/F2/F3 — `LZ-MW2/MW3` 기반 재가공 vertical slice.
2. enemy raider — 같은 baseline pixel density를 쓰되 한쪽 대형 loot sack으로 적군 실루엣 분리.
3. SERIES 01에서 성인 여성 S 1명 + SS 아르셀리아 1명 — baseline과 premium의 실제 화면 공존 테스트.
4. 공통 C/B/A에서 `CUSTOM_CREATURE` 1종 — 인간형 재가공과 고유 골격의 스케일 통일 테스트.
5. 이후 43인 전개.

각 단계는 runtime asset과 review evidence가 실제로 생기기 전까지 기존 `AWAITING_ART`/design 상태를 유지한다.
