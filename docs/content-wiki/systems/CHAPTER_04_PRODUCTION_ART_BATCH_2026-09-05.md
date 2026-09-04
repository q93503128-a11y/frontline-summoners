# Chapter 04 Production Art Batch — 2026-09-05

## Scope

- Chapter: `제4장 · 기어 제국의 균열`
- Stages: `main_04_001` through `main_04_020`
- New production candidates: 10 targets
- Motion coverage: `idle / move / attack / knockback / death`
- Total strips: 50
- Review route: `?productionReview=chapter-04`

This is one chapter-sized production batch. It does not split Chapter 04 back into five-stage review slices.

## Source and approval policy

- `sourcePolicy`: `PROJECT_AUTHORED_DETERMINISTIC_ONLY`
- `generativeAiUsed`: `false`
- External sprites: none
- `normalRuntimeAuthoritative`: `false`
- Contract lifecycle: `AWAITING_ART / PENDING`
- Generated runtime lifecycle: `UNREVIEWED_RUNTIME_FILES / PENDING`

These files are production candidates for review. They are not human approval evidence, and the batch does not populate normal-runtime authoritative unit art.

## Canonical visual targets

| Unit | Runtime identity carried into the candidate |
| --- | --- |
| `enemy_ch4_sawbird` | Saw-blade wings dominate the small, fast floating machine silhouette; attack reads immediately for the 7F contact role. |
| `enemy_ch4_magnet_spider` | Six mechanical legs support a horseshoe-magnet body; attack expands a visible push field rather than inventing a projectile. |
| `enemy_ch4_railworm` | A segmented low chassis is subordinate to the extremely long rail barrel; the attack strip spends most frames charging before discharge to reflect the 110F role. |
| `enemy_ch4_furnace_golem` | Giant armored furnace torso, short heavy limbs, and a visibly heated core communicate the slow high-HP front line. |
| `enemy_ch4_folded_soldier` | The silhouette is made from spatially folded wedges and displaced limbs instead of a normal human sprite. |
| `enemy_ch4_error_mass` | Multiple misregistered fragments overlap around a core; four successive attack pulses correspond to the canonical 25/30/35/40F multi-hit identity. |
| `enemy_ch4_void_lens` | Concentric lens rings and a black central point dominate; the attack opens a long forward void-lens lane after a readable charge. |
| `enemy_ch4_fusion_cavalry` | Machine cavalry chassis and anomaly rift share one silhouette, rather than appearing as two layered characters. |
| `boss_ch4_moving_throne` | Wide moving-fortress throne with restrained height; main gun and lower press structure both remain legible without occupying excessive screen height. |
| `boss_ch4_zero_engine` | Concentric engine rings are the identity. The attack sequence uses deterministic alignment/compression, radial rift lines, then vibration bands to carry the fixed A/B/C language without random animation. |

## Battlefield reuse

Chapter 04 stages use only existing production themes:

- `canyon`
- `fortress`
- `ruins`
- `burning`
- `moon`
- `golden`

The review layer reuses each theme's existing `battlefield-base.svg`, `background-landmarks.svg`, and `foreground-low-density.svg`. No redundant Chapter 04 battlefield copies are authored.

## Validation gate

`tools/validate-chapter-04-runtime-files.mjs` checks:

- exactly 10 targets;
- exactly 50 unique motion-strip digests;
- configured frame counts and PNG dimensions;
- byte counts and SHA-256 consistency against generated metadata;
- deterministic project-authored provenance fields;
- `generativeAiUsed: false`;
- `normalRuntimeAuthoritative: false`;
- pending/unreviewed lifecycle state;
- availability of all three reused battlefield layers for all six themes.

The package-level `assets:production:check` materializes and validates Chapter 04 together with earlier production batches.
