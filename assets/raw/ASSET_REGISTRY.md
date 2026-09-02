# Asset Registry

모든 외부 에셋은 사용 전에 원출처와 라이선스를 확인하고 기록한다. GitHub 미러는 원저작자/원라이선스를 대체하지 않는다.

| assetId | 원출처 | 제작자 | 라이선스 | 사용 파일 | 수정 여부 | 배포 방식 |
| --- | --- | --- | --- | --- | --- | --- |
| `luizmelo-hero-knight` | `https://luizmelo.itch.io/hero-knight` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `vlee489/AC31009-Client`에서 빌드 시 검증·복사 |
| `luizmelo-hero-knight-2` | `https://luizmelo.itch.io/hero-knight-2` | LuizMelo | CC0 1.0 | Idle, Run, Attack | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-fantasy-warrior` | `https://luizmelo.itch.io/fantasy-warrior` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-wizard-pack` | `https://luizmelo.itch.io/wizard-pack` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `vlee489/AC31009-Client`에서 빌드 시 검증·복사 |
| `luizmelo-medieval-warrior-2` | `https://luizmelo.itch.io/medieval-warrior-pack-2` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-huntress` | `https://luizmelo.itch.io/huntress` | LuizMelo | CC0 1.0 | Idle, Run, Attack1 | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |
| `luizmelo-evil-wizard` | `https://luizmelo.itch.io/evil-wizard` | LuizMelo | CC0 1.0 | Idle, Move, Attack | 코드상 tint/scale만 | 고정 커밋 `NQM765/IngeSoft1`에서 빌드 시 검증·복사 |

## 현재 배포 방식

- 게임 런타임은 `raw.githubusercontent.com`을 직접 읽지 않는다.
- `tools/vendor-client-assets.mjs`가 `prebuild`에서 위 고정 커밋의 21개 PNG를 내려받아 `apps/client/public/assets/characters/`에 생성한다.
- 각 다운로드는 타임아웃과 재시도를 사용하고 PNG 시그니처 및 기대 가로·세로 크기를 검사한다.
- 한 파일이라도 누락되거나 원본 시트 크기가 바뀌면 빌드를 실패시켜 캐릭터가 빠진 Pages 배포를 막는다.
- Vite 빌드 결과에는 위 파일이 로컬 `/assets/characters/...` 경로로 포함되므로 실제 플레이 중 외부 미러 장애에 영향을 받지 않는다.
- 생성 산출물 폴더는 Git에 직접 중복 저장하지 않고 `.gitignore`한다. 원출처/핀 SHA/검증 규칙은 스크립트와 이 Registry가 정본이다.

## 정식 제작 자산 인입

현재 LuizMelo 자산은 시스템 개발용 placeholder이며 production 승인으로 간주하지 않는다.

정식 제작 자산은 다음 경로를 사용한다.

- 런타임 URL: `/assets/production/...`
- Vite public 실제 파일: `apps/client/public/assets/production/...`
- 첫 제작 인입 계약: `assets/raw/production/vertical-slice-01.json`
- 첫 visual review 계약: `assets/raw/production/review-package-01.json`
- review evidence root: `assets/raw/production/review/vertical-slice-01/...`
- 통합 자동 검증: `npm run assets:production:check`
- intake validator: `tools/validate-production-vertical-slice.mjs`
- review validator: `tools/validate-production-review-package.mjs`

첫 visual vertical slice는 다음을 대상으로 한다.

- `unit:militia:militia_f1`
- `unit:militia:militia_f2`
- `unit:militia:militia_f3`
- `unit:enemy-raider`
- `unit:enemy-boss`
- `battlefield:meadow`

현재 위 항목은 모두 `AWAITING_ART`이며 최종 제작 파일이 아직 Registry에 등록된 상태가 아니다.

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

- 기준 화풍은 현재 placeholder 기준으로 LuizMelo 계열 CC0 횡스크롤 픽셀아트를 사용하지만, 정식 production 디자인은 캐릭터 아트 바이블과 별도 사람 검수 기준이 우선한다.
- 다른 화풍의 무료 에셋을 단순히 수량 채우기 목적으로 섞지 않는다.
- 원본 에셋의 프레임 시트 크기와 코드의 `frameWidth × frames`가 반드시 일치해야 한다.
- Hero Knight Idle은 원본 1980×180 / 11프레임이므로 프레임 폭 180으로 고정한다.
- Hit/Take Hit 스프라이트가 있더라도 일반 피격마다 사용하지 않는다. 필요하면 자연 KB 연출에 맞게 재해석한다.
- production 자산은 `같은 인간형 + tint` 방식으로 기존 placeholder를 그대로 승격하지 않는다.
