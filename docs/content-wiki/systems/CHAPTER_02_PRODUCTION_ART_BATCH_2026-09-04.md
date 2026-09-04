# Chapter 02 Production Art Batch — 2026-09-04

Status: `AWAITING_ART` / `PENDING` / `UNREVIEWED_RUNTIME_FILES`

This batch closes the first deterministic production-candidate pass for all Chapter 02-specific combatants without changing normal runtime art authority.

## Scope

Stages: `main_02_001` through `main_02_020`.

New Chapter 02 combatants, each with `idle / move / attack / knockback / death` strips:

1. `enemy_ch2_mossboar` — 이끼멧돼지
2. `enemy_ch2_umbrella` — 우산버섯
3. `enemy_ch2_vinerider` — 덩굴기수
4. `enemy_ch2_seedbattery` — 씨앗포대
5. `enemy_ch2_bonewheel` — 뼈바퀴
6. `enemy_ch2_coffinbug` — 관짝벌레
7. `enemy_ch2_gravebell` — 묘지종지기
8. `enemy_ch2_revivedarmor` — 되살아난 갑옷
9. `boss_ch2_rootwidow` — 뿌리과부
10. `boss_ch2_funeral_king` — 종 없는 장의왕

Total: **10 targets / 50 motion strips**.

All ten are `project-authored deterministic` silhouettes. No generative AI art and no external sprite family is used in this Chapter 02 batch.

## Visual-language anchors

- NATURE half: animal/fungus/vine/seed-structure silhouettes instead of recolored humanoids.
- UNDEAD half: wheel/coffin-insect/bell-skeleton/empty-armor silhouettes instead of generic zombies.
- 뿌리과부: trunk body + moving root skirt + empty nest-like face opening.
- 종 없는 장의왕: broken inverted bell dominates the upper silhouette; multiple coffins function as legs.

## Battlefield reuse

Chapter 02's canonical stage data uses only battlefield themes already materialized during Chapter 01 production work:

- `meadow`
- `moon`
- `ruins`
- `canyon`
- `fortress`

No redundant Chapter 02 battlefield copy is generated. The production review mode preloads and renders the existing three-layer candidates for those themes.

## Review runtime

Query:

`?productionReview=chapter-02`

The review runtime replaces only the ten Chapter 02-specific enemy/boss visuals. It preserves the real battle simulation, wave timing, HP, attack timing, knockback, death state, progression and save behavior.

ST10 exposes the root-widow boss presentation; ST19 and ST20 expose the funeral-king presentation and Chapter 02 finale composition.

## Lifecycle lock

- Automated generation is not review evidence.
- Human capture is still required before approval.
- Human approval is still required before production runtime authority.
- `PRODUCTION_UNIT_ART_CANDIDATES` remains untouched by this batch.
