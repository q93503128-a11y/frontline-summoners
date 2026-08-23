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

## 운영 원칙

- 기준 화풍은 LuizMelo 계열 CC0 횡스크롤 픽셀아트다.
- 다른 화풍의 무료 에셋을 단순히 수량 채우기 목적으로 섞지 않는다.
- 원본 에셋의 프레임 시트 크기와 코드의 `frameWidth × frames`가 반드시 일치해야 한다.
- Hero Knight Idle은 원본 1980×180 / 11프레임이므로 프레임 폭 180으로 고정한다.
- Hit/Take Hit 스프라이트가 있더라도 일반 피격마다 사용하지 않는다. 필요하면 자연 KB 연출에 맞게 재해석한다.
