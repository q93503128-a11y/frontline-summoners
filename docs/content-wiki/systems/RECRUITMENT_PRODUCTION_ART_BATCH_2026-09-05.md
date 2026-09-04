# Recruitment Production Art Batch — 2026-09-05

## Scope

Canonical character source: `content/units/recruitment-01.json`

Canonical recruitment form sources:

- `content/evolution/recruitment-common-explicit-01.json`
- `content/evolution/recruitment-series-01-explicit.json`
- `content/evolution/recruitment-series-02-explicit.json`
- `content/evolution/recruitment-series-03-explicit.json`

Root batch: `recruitment-production-01`

Canonical form materialization batch: `recruitment-production-01-forms`

Review route: `?productionReview=recruitment`

This batch covers every currently canonical recruitment character and every explicit F1/F2/F3 evolution form while preserving the production-art approval boundary.

## Coverage

- Common pool C/B/A: 15 characters
- Series 01 Starlight Order: 6 characters
- Series 02 Primordial Titans: 6 characters
- Series 03 Zero Edge: 6 characters
- Total recruitment character roots: 33
- Explicit forms per character: F1 / F2 / F3
- Total canonical recruitment forms: 99
- Required motions per form: idle / move / attack / knockback / death
- Canonical nested form strips: 99 × 5 = 495
- Additional root-silhouette review strips: 33 × 5 = 165
- Total generated recruitment review candidate strips: 660
- New battlefield themes: 0

The 33 root-silhouette sets are supporting review candidates. The canonical production requirement surface is the 99 F1/F2/F3 form assets under `units/<characterId>/<formId>/`.

## Review runtime

`?productionReview=recruitment` preloads all 99 canonical form families. In battle it resolves the active visual form through the same presentation-only selected-form mirror used by the normal art resolver, falling back to each recruitment character's F1 when no selection exists.

This review route does not add any entry to the normal approved production-art manifest.

## Authority boundary

- `status`: `AWAITING_ART`
- `reviewStatus`: `PENDING`
- `normalRuntimeAuthoritative`: `false`
- `generativeAiUsed`: `false`
- `sourcePolicy`: `PROJECT_AUTHORED_DETERMINISTIC_ONLY`
- Automated materialization is not human review evidence.
- Normal runtime promotion remains forbidden until explicit human approval.

## Validation contract

`tools/validate-recruitment-runtime-files.mjs` validates the 33 character-root candidates and must fail if:

1. canonical recruitment character count is not exactly 33,
2. canonical character IDs and root production-contract IDs are not a 1:1 set,
3. the base first simulation hit frame differs from the root contract,
4. any root strip is missing or has invalid dimensions/hash metadata,
5. any of the 165 root strips duplicates another root strip,
6. pending recruitment IDs are directly promoted into the normal production-art manifest.

`tools/validate-recruitment-form-runtime-files.mjs` validates the canonical form surface and must fail if:

1. any recruitment character lacks exactly F1/F2/F3,
2. the canonical form count is not exactly 99 unique form IDs,
3. a form's first simulation contact frame disagrees with its explicit form attack timing or base fallback,
4. any nested form strip is missing or its dimensions/hash metadata drift,
5. any of the 495 canonical form strips duplicates another recruitment form strip,
6. pending recruitment forms are promoted into the normal production-art manifest before approval.

The root `assets:production:check` runs both recruitment validators so later roster or evolution additions cannot silently create uncovered recruitment production requirements.
