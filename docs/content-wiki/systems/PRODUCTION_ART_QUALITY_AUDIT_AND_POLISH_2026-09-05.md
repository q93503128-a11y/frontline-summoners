# Production Art Quality Audit & Polish — 2026-09-05

## Scope

This pass adds an automated **polish-priority audit**, not a human approval gate.

Generated report:

`apps/client/public/assets/production/units/production-art-quality-audit.json`

Audit implementation:

`tools/audit-production-art-quality.mjs`

The audit reads the persisted production metadata and the actual generated PNG strips. It checks idle / move / attack presentation for silhouette occupancy, edge/clipping risk, frame-to-frame motion change, normalized cross-unit silhouette similarity, and recruitment F1/F2/F3 silhouette separation.

Human review authority remains unchanged. A good audit score does not approve an asset.

## Baseline before polish

- targets audited: 234
- strips audited: 702
- severe: 0
- at-risk: 30
- healthy: 204
- recruitment evolution groups: 33
- weak evolution groups: 21
- watch evolution groups: 10
- clipping risk: 0

The strongest concrete problems included:

- `char_s02_barga` and `char_s02_gormu`: normalized form silhouettes reached 1.0 cross-unit similarity.
- `char_s03_k17` and `char_s03_blade_hound`: roughly 0.94–0.96 cross-unit similarity.
- `enemy-shield`: weak movement silhouette delta plus high similarity to `enemy_ch2_bonewheel`.
- many recruitment F1/F2/F3 sets changed color/detail but not enough outer structure.

## Polish pass 01

Added:

- `tools/polish-recruitment-form-silhouettes.mjs`

The pass preserves the existing deterministic source-policy and adds structural silhouette language derived from unit identity, series, form order, and evolution modifiers such as HP, attack, movement, range, and cost.

Explicit high-priority separation was added for:

- Barga shell / Gormu ruin-mountain loadout
- K-17 dual cutting blades / Blade Hound low quadruped blade language

After pass 01:

- severe: 0
- at-risk: 7
- healthy: 227
- weak evolution groups: 5
- watch evolution groups: 17
- clipping risk: 0

## Targeted polish pass 02

Added:

- `tools/polish-recruitment-form-priority-02.mjs`
- `tools/polish-second-slice-priority-art.mjs`

Targeted recruitment roots:

- `char_s03_arc_railer`
- `char_s03_rxomega`
- `char_s02_gormu`
- `char_s02_barga`
- `char_common_c_turnip_rider`
- `char_common_b_clockduck`
- `char_common_b_lantern_witch`
- `char_s01_riena`
- `char_s01_totoria`

`enemy-shield` received a distinct asymmetric tower-shield silhouette and stronger movement/readability motion.

## Final audit result

- targets audited: **234**
- strips audited: **702**
- severe: **0**
- at-risk: **0**
- healthy: **234**
- recruitment evolution groups: **33**
- weak evolution groups: **0**
- watch evolution groups: **18**
- clipping risk: **0**

The audit therefore has no remaining target below the current at-risk threshold and no recruitment evolution group above the current weak-separation threshold.

Remaining `WATCH` or score-80 similarity entries are still legitimate future polish candidates. In particular, the audit still reports high normalized similarity between some intentionally radial / mirror-like silhouettes, including `boss_ch4_zero_engine` vs `enemy_ch2_bonewheel` and `enemy_ch3_torn_mirror` vs `enemy_sp_evo_mirror_seal`. They are not classified as at-risk under the current scoring threshold, but should remain visible in later visual-review passes.

## Authority boundary

All affected candidates remain:

- human review: `PENDING`
- normal runtime authoritative: `false`
- generative AI used: `false`
- source policy: project-authored deterministic / existing pinned-source policy according to each batch

No automated score or polish pass is human approval evidence.

## Verification

CI #1045 validated the audit system itself.

CI #1046 validated the first recruitment silhouette polish.

CI #1047 validated the targeted second polish, including typecheck, full production gate, content schema, simulation, server protocol, client diagnostics, client suite, build, and persisted generated assets.
