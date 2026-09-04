# Recruitment Production Art Batch — 2026-09-05

## Scope

Canonical source: `content/units/recruitment-01.json`

Batch: `recruitment-production-01`

Review route: `?productionReview=recruitment`

This batch covers every currently canonical recruitment unit while preserving the production-art approval boundary.

## Coverage

- Common pool C/B/A: 15 units
- Series 01 Starlight Order: 6 units
- Series 02 Primordial Titans: 6 units
- Series 03 Zero Edge: 6 units
- Total recruitment targets: 33
- Required motions per target: idle / move / attack / knockback / death
- Expected generated strips: 165
- New battlefield themes: 0

## Authority boundary

- `status`: `AWAITING_ART`
- `reviewStatus`: `PENDING`
- `normalRuntimeAuthoritative`: `false`
- `generativeAiUsed`: `false`
- `sourcePolicy`: `PROJECT_AUTHORED_DETERMINISTIC_ONLY`
- Automated materialization is not human review evidence.
- Normal runtime promotion remains forbidden until explicit human approval.

## Validation contract

`tools/validate-recruitment-runtime-files.mjs` must fail if:

1. canonical recruitment count is not exactly 33,
2. canonical IDs and production-contract IDs are not a 1:1 set,
3. the first simulation hit frame differs from the contract,
4. any required strip is missing or has invalid dimensions/hash metadata,
5. any of the 165 recruitment strips duplicates another strip,
6. pending recruitment IDs are directly promoted into the normal production-art manifest.

The root `assets:production:check` includes this batch so later content additions cannot silently create uncovered recruitment units.
