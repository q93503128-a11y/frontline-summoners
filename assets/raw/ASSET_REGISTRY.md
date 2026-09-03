# Asset Registry

모든 외부 에셋은 사용 전에 원출처와 라이선스를 확인하고 기록한다. GitHub 미러는 원저작자/원라이선스를 대체하지 않는다.

| assetId | 원출처 | 제작자 | 라이선스 | 사용 파일 | 수정 여부 | 배포 방식 |
| --- | --- | --- | --- | --- | --- | --- |
| `luizmelo-hero-knight` | `https://luizmelo.itch.io/hero-knight` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `vlee489/AC31009-Client`에서 빌드 시 검증·복사 |
| `luizmelo-hero-knight-2` | `https://luizmelo.itch.io/hero-knight-2` | LuizMelo | CC0 1.0 | Idle, Run, Attack | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-fantasy-warrior` | `https://luizmelo.itch.io/fantasy-warrior` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-wizard-pack` | `https://luizmelo.itch.io/wizard-pack` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `vlee489/AC31009-Client`에서 빌드 시 검증·복사 |
| `luizmelo-medieval-warrior-2` | `https://luizmelo.itch.io/medieval-warrior-pack-2` | LuizMelo | CC0 1.0 | Idle, Run, Attack1-4, Take Hit, Death | source reference only; final production rework required | 고정 커밋 `NQM765/IngeSoft1@84594e5d3da7472615660f453bdb457da13cca2f`에서 빌드 시 검증·복사 |
| `luizmelo-medieval-warrior-3` | `https://luizmelo.itch.io/medieval-warrior-pack-3` | LuizMelo | CC0 1.0 | Idle, Run, Attack1-3, Get Hit, Death | source reference only; final production rework required | 고정 커밋 `chaurunda/ClickerGodot@c425114bfa522b1e57f0cfc4f486580a3210f36d`에서 빌드 시 검증·복사 |
| `luizmelo-huntress` | `https://luizmelo.itch.io/huntress` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-evil-wizard` | `https://luizmelo.itch.io/evil-wizard` | LuizMelo | CC0 1.0 | Idle, Move, Attack | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |

## 검증된 무료 source candidate

아래 항목은 2026-09-03에 원출처 페이지의 현재 무료 다운로드 여부와 CC0 표기를 확인한 **source candidate**다. production runtime asset으로 채택된 것이 아니며 production review 상태에도 영향을 주지 않는다. `luizmelo-medieval-warrior-3`은 source candidate 검증 후 build-time reference까지 핀 고정했으므로 위 vendored source 표로 승격했고 이 중복 후보 표에서는 제거했다.

| assetId | 원출처 | 제작자 | 라이선스 | 현재 상태 | 우선 용도 |
| --- | --- | --- | --- | --- | --- |
| `luizmelo-medieval-warrior-1-candidate` | `https://luizmelo.itch.io/medieval-warrior-pack` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | 일반 인간형/창병/병사 재가공 |
| `luizmelo-huntress-2-candidate` | `https://luizmelo.itch.io/huntress-2` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | 경량 인간형의 달리기/공격 모션 참고 |
| `luizmelo-monsters-creatures-fantasy-1-candidate` | `https://luizmelo.itch.io/monsters-creatures-fantasy` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | Skeleton/Goblin/Mushroom/Flying Eye 기반 또는 모션 참고 |
| `luizmelo-monsters-creatures-fantasy-2-candidate` | `https://luizmelo.itch.io/monsters-creatures-fantasy-2` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | Mimic/Rat/Slime/Bat 모션 참고 |
| `luizmelo-medieval-king-1-candidate` | `https://luizmelo.itch.io/medieval-king-pack` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | 왕실기사/장의사 계열 인간형 재가공 |
| `luizmelo-medieval-king-2-candidate` | `https://luizmelo.itch.io/medieval-king-pack-2` | LuizMelo | CC0 1.0 | `SOURCE_CANDIDATE` | 중량 인간형 모션/장비 참고 |

현재 유료 결제가 필요한 pack은 라이선스가 CC0이더라도 이 `무료 source candidate` 목록에는 넣지 않는다. 실제 binary 인입 시에는 다시 원출처를 확인하고 master/runtime 파일의 checksum과 provenance를 별도로 기록한다.

43인 source/base/custom 분류 정본은 `docs/content-wiki/systems/FREE_SPRITE_SOURCE_MAPPING_V1.md`다.

## 현재 배포 방식

- 게임 런타임은 `raw.githubusercontent.com`을 직접 읽지 않는다.
- `tools/vendor-client-assets.mjs`가 `prebuild`에서 고정 커밋의 **33개 PNG**를 내려받아 `apps/client/public/assets/characters/`에 생성한다.
- Medieval Warrior Pack 2/3는 징집병 F1/F2/F3 production 재작업에 사용할 **source reference motion set**을 확보하기 위해 Idle/Run/Attack/Hit/Death 계열까지 포함한다. 이 파일 자체가 production 승인 아트는 아니다.
- 각 다운로드는 타임아웃과 재시도를 사용하고 PNG 시그니처 및 기대 가로·세로 크기를 검사한다.
- MW3는 135×135 프레임 캔버스를 사용하며 현재 검증 규격은 Idle `1350×135`(10), Run `810×135`(6), Attack1/2 `540×135`(4), Attack3 `675×135`(5), Get Hit `405×135`(3), Death `1215×135`(9)다.
- 한 파일이라도 누락되거나 원본 시트 크기가 바뀌면 빌드를 실패시켜 캐릭터가 빠진 Pages 배포를 막는다.
- Vite 빌드 결과에는 위 파일이 로컬 `/assets/characters/...` 경로로 포함되므로 실제 플레이 중 외부 미러 장애에 영향을 받지 않는다.
- 생성 산출물 폴더는 Git에 직접 중복 저장하지 않고 `.gitignore`한다. 원출처/핀 SHA/검증 규칙은 스크립트와 이 Registry가 정본이다.

## 정식 제작 자산 인입

현재 LuizMelo 자산은 시스템 개발용 placeholder/source reference이며 production 승인으로 간주하지 않는다. `SOURCE_CANDIDATE`로 추가 기록된 pack도 같은 원칙을 적용한다.

정식 제작 자산은 다음 경로를 사용한다.

- 런타임 URL: `/assets/production/...`
- Vite public 실제 파일: `apps/client/public/assets/production/...`
- 첫 제작 인입 계약: `assets/raw/production/vertical-slice-01.json`
- 첫 visual review 계약: `assets/raw/production/review-package-01.json`
- 첫 concept candidate manifest: `assets/raw/production/concept-candidates-01.json`
- 2차 concept 기록: `docs/content-wiki/systems/SECOND_PRODUCTION_CONCEPT_CANDIDATES_2026-09-03.md`
- review evidence root: `assets/raw/production/review/vertical-slice-01/...`
- 통합 자동 검증: `npm run assets:production:check`
- intake validator: `tools/validate-production-vertical-slice.mjs`
- review validator: `tools/validate-production-review-package.mjs`
- concept candidate validator: `tools/validate-production-concept-candidates.mjs`

첫 visual vertical slice는 다음을 대상으로 한다.

- `unit:militia:militia_f1`
- `unit:militia:militia_f2`
- `unit:militia:militia_f3`
- `unit:enemy-raider`
- `unit:enemy-boss`
- `battlefield:meadow`

현재 위 항목은 모두 `AWAITING_ART`이며 최종 제작 파일이 아직 Registry에 등록된 상태가 아니다.

검토용 concept candidate는 같은 review root 아래 `concepts/`에 둘 수 있지만 runtime 자산이나 정식 review evidence로 간주하지 않는다. `militia-raider-silhouette-v1`은 `REVISION_REQUIRED` 이력을 보존하며, `militia-raider-silhouette-v2`, `golden-mask-necromancer-silhouette-v1`, `meadow-battlefield-composition-v1`은 모두 concept 수준의 `SELECTED_FOR_DEVELOPMENT`일 뿐이다. 이 상태는 어떤 production target도 `AWAITING_ART`에서 승격하지 않는다.

실제 파일이 들어올 때에는 각 production asset에 대해 최소 다음 provenance를 이 Registry 또는 연결된 production provenance 문서에 기록한다.

- 제작 주체/원본 출처
- 사용 권한 또는 라이선스
- AI 생성/수작업/혼합 등 제작 방식 구분
- 수정·리터치 여부
- 원본 master 위치와 런타임 변환 파일
- 사용자 검수 여부

`READY_FOR_REVIEW`와 `APPROVED`는 파일 존재만으로 올릴 수 없다.

- vertical-slice validator는 5개 필수 sprite motion, PNG sheet metadata, runtime 경로를 검사한다.
- review validator는 제출 evidence, landscape viewport capture, provenance, target status 동기화와 사람 검수 lifecycle을 검사한다.
- `390×844`/`360×640`은 모바일 기기 클래스 수치이며 실제 가로 review capture는 각각 `844×390`/`640×360` CSS viewport를 사용한다.
- `APPROVED`는 review package의 완료된 사람 checklist와 vertical-slice의 `humanReviewComplete=true`를 모두 요구한다.

## 운영 원칙

- BASELINE은 LuizMelo 계열 CC0 횡스크롤 픽셀아트를 기준으로 하지만, S/SS·시리즈 간판은 `PREMIUM_CHARACTER_ART_DIRECTION.md`에 따라 의도적으로 다른 프리미엄 화풍/렌더링 밀도를 사용할 수 있다.
- 다른 화풍의 무료 에셋을 단순히 수량 채우기 목적으로 섞지 않는다. 화풍 차이는 희귀도/시리즈 언어로 설명 가능해야 한다.
- 원본 에셋의 프레임 시트 크기와 코드의 `frameWidth × frames`가 반드시 일치해야 한다.
- Hero Knight Idle은 원본 1980×180 / 11프레임이므로 프레임 폭 180으로 고정한다.
- Hit/Take Hit/Get Hit 스프라이트가 있더라도 일반 피격마다 그대로 재생하지 않는다. 필요하면 자연 KB 연출에 맞게 재해석한다.
- production 자산은 `같은 인간형 + tint` 방식으로 기존 placeholder/source reference를 그대로 승격하지 않는다.
- 무료 원본이 캐릭터 바이블의 실루엣을 훼손한다면 무료 원본을 버리고 전용 제작한다.
