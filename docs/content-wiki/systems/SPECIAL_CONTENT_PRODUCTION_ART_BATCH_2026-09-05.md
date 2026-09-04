# Special Content Production Art Batch — 2026-09-05

## Scope

This batch closes deterministic production-candidate coverage for every special/event-only enemy definition currently present in canonical content data.

- Batch: `special-content-production-01`
- Review route: `?productionReview=special-content`
- Event-only definitions: 10
- Permanent-special definitions: 30
- Total targets: 40
- Motion set per target: `idle / move / attack / knockback / death`
- Total strips: 200
- New battlefield themes: 0
- Reused production battlefield themes: `meadow`, `golden`, `canyon`, `ruins`, `fortress`, `burning`, `moon`

Canonical enemy sources:

- `content/enemies/special-event-enemies.json`
- `content/enemies/special-permanent-bosses.json`

The validator requires the union of those canonical enemy IDs to match the contract target IDs exactly. Adding or removing a canonical special enemy without updating this batch therefore fails the production gate instead of silently losing art coverage.

## Runtime / review implementation

- Contract: `assets/raw/production/special-content-production-01.json`
- Materializer: `tools/materialize-special-content-production-art.mjs`
- Validator: `tools/validate-special-content-runtime-files.mjs`
- Review runtime: `apps/client/src/special-content-production-review-runtime.ts`
- Battlefield reuse bridge: `apps/client/src/special-content-production-review-battlefields.ts`
- Generated metadata: `apps/client/public/assets/production/units/special-content-runtime-metadata.json`

The root `assets:production:check` materializes and validates this batch alongside the chapter/slice production batches.

## Art/source policy

All 40 targets are project-authored deterministic silhouettes assembled from repository code primitives. No external sprite, generated image, or generative-AI image is used.

Required lifecycle remains:

- `status: AWAITING_ART`
- `reviewStatus: PENDING`
- generated runtime metadata: `UNREVIEWED_RUNTIME_FILES`
- `humanReview: PENDING`
- `generativeAiUsed: false`
- `normalRuntimeAuthoritative: false`

This batch is therefore review-candidate coverage, **not human approval and not final runtime authority**.

## Completeness comparison after this batch

### Main progression

The canonical main progression currently ends at Chapter 4. Chapters 1–4 contain 80 main stages in total. Their currently defined enemy/boss production-candidate coverage is complete:

- Chapter 1: legacy first-through-sixth-slice production/review coverage, including chapter-one finale
- Chapter 2: chapter-sized production batch complete
- Chapter 3: chapter-sized production batch complete
- Chapter 4: chapter-sized production batch complete

There is no canonical Chapter 5 stage/enemy data in the repository at the time of this audit.

### Special / event combat content

Before this batch, 40 canonical special-only enemy/boss definitions had no equivalent chapter-sized production batch. This batch covers all 40:

- event-only: 10 / 10
- permanent-special: 30 / 30
- combined: 40 / 40

After validation, **currently defined enemy/boss production-candidate ID coverage is 100% across main + special content**.

### Battlefield coverage

All seven battlefield themes currently used by these main/special stages already have production battlefield layers and are reused rather than duplicated:

- meadow
- golden
- canyon
- ruins
- fortress
- burning
- moon

Thus the current theme footprint is 7 / 7 covered at production-candidate runtime level.

### What is NOT 100% complete

Candidate coverage must not be confused with final-art completion. Human review/approval remains pending for unapproved production batches, so final authoritative art cannot be claimed as complete or assigned a fabricated approval percentage.

The remaining art-phase work is therefore primarily:

1. human visual review of the candidate runtime files,
2. polish/rework where review finds silhouette, motion-readability, scale, contact-timing, or battlefield-composition issues,
3. legitimate approval/provenance recording,
4. only then promotion into normal runtime authority.

The project must continue to keep `normalRuntimeAuthoritative:false` and approval state pending until those steps actually occur.
