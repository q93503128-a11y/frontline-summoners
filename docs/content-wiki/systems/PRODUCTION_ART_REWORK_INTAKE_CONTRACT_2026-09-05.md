# Production Art Rework Intake Contract — 2026-09-05

## Purpose

Human review tools can identify candidates that need another art pass, but those local notes are not canonical approval or production evidence. This contract defines the only supported bridge from a browser-local `LOCAL_REWORK_TRIAGE_DRAFT` into a repository workbench intake.

## Boundaries

- Source draft must remain `humanApprovalAuthority: false`, `canonicalWrite: false`, `approvalEvidence: false`.
- Import rejects empty drafts, unknown review modes/targets, missing or mismatched `assetId`, duplicate targets, unknown reason codes, and targets without an explicit `REVISIT` or `BLOCKER` disposition.
- Import rejects reviewer identity/timestamps, provenance, runtime-file claims, evidence, captures, or approval claims inside the draft.
- Every imported target is revalidated against current runtime metadata for the 11 existing review modes.
- Current runtime review state must remain `PENDING` or `UNREVIEWED_RUNTIME_FILES`, `normalRuntimeAuthoritative: false`, and `generativeAiUsed: false`.
- Output is `PRODUCTION_ART_REWORK_INTAKE`, `status: WORKBENCH`, `promotionEligible: false`, and `requestedAction: REWORK_CANDIDATE_ONLY`.
- Import does not edit runtime files, provenance, review packages, or approval state.

## Workflow

1. Human reviewer inspects a target in Motion Gallery and/or Battle Review.
2. Local Rework Queue records an explicit `REVISIT` or `BLOCKER`, reason codes, and optional observation note in browser `localStorage`.
3. `COPY REWORK JSON` creates a `LOCAL_REWORK_TRIAGE_DRAFT` containing the exact current `assetId` for each queued target.
4. Save that copied JSON to a local file.
5. Run:

```bash
npm run assets:production:rework-intake:import -- --input=<draft.json> --output=assets/raw/production/review/rework-intake/<batch>.json
```

6. The importer revalidates each mode/target/asset identity against current runtime metadata before writing the workbench intake.
7. A later explicit art rework batch may consume that workbench file. It still cannot grant approval.

## CI

`npm run assets:production:check` includes:

- review queue materialization,
- exported asset-identity preservation validation,
- the 242-target/form rework-intake contract test,
- positive and negative import-boundary cases.

The older `first-slice-rework-01.json` and `validate-production-rework-plan.mjs` remain unchanged as the historical first-slice workbench contract; this new intake contract covers the current 11-mode review surface without rewriting that legacy schema.
