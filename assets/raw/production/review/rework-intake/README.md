# Production Art Rework Intake Workbench

This directory stores repository-side `PRODUCTION_ART_REWORK_INTAKE` workbench files created from an explicitly reviewed `LOCAL_REWORK_TRIAGE_DRAFT`.

Files here are **not** approval evidence, do not grant runtime authority, and are not promotion-eligible by themselves. Each imported item must still pass the later authored rework, provenance, review-evidence, and explicit human-approval gates defined in `docs/content-wiki/systems/PRODUCTION_ART_REWORK_INTAKE_CONTRACT_2026-09-05.md`.

Use the importer rather than hand-normalizing browser-local drafts:

```bash
npm run assets:production:rework-intake:import -- --input=<draft.json> --output=assets/raw/production/review/rework-intake/<batch>.json
```
