# Runtime assets

게임 빌드에 포함되는 최적화된 런타임 에셋 위치다.

## Placeholder assets

현재 시스템 개발용 CC0 sprite는 빌드 시 검증·vendor되어 아래에 생성된다.

- `/assets/characters/<family>/idle.png`
- `/assets/characters/<family>/run.png`
- `/assets/characters/<family>/attack.png`

원출처·라이선스·핀 SHA는 `assets/raw/ASSET_REGISTRY.md`와 `tools/vendor-client-assets.mjs`가 정본이다.

## Production assets

최종 제작 자산은 placeholder와 섞지 않고 `/assets/production/` 아래에 둔다.

예정 계약:

- `/assets/production/units/<unitId>/<formId>/...` — 플레이어 F1/F2/F3
- `/assets/production/units/<enemyId>/...` — 적/보스
- `/assets/production/battlefields/<themeId>/...`
- `/assets/production/audio/music/...`
- `/assets/production/audio/sfx/...`
- `/assets/production/audio/ambience/...`

실제 runtime preload/선택 권위는 `apps/client/src/production-assets.ts`다. 단순히 파일을 이 경로에 추가하는 것만으로는 사용되지 않으며, manifest candidate가 실제 자산을 가리키고 필요한 검수를 거쳐 `APPROVED`가 되어야 production runtime 자산으로 승격된다.

`READY_FOR_REVIEW` 또는 `AWAITING_ART` 상태는 런타임 권위가 아니다. 승인 자산이 없는 대상은 기존 검증된 placeholder로 fallback한다.
