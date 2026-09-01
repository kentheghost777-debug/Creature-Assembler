# Primeria Safe Polish Status

This file preserves the verified September 1, 2026 polish state so future agents do not redo, erase, or misidentify completed work.

## Verified complete in code

- **Active repository:** `kentheghost777-debug/Creature-Assembler`
- **Protected source:** `main`
- **Recovered baseline:** commit `a14a45a98e84c2b3868a893dbb303082b9b640c1`
- Rowan is already a selectable player character in `GameLauncher.tsx`.
- The journal/player menu already exposes Party, Storage, Shells, Bag, Equipment, Guide, Map, and Licenses tabs.
- The Dex already contains Dex and Evolution subviews.
- Encounter hotspots are not plain fallback circles: they use rarity-tier animation, elemental coloring, glow, and symbols.
- Battle sprite developer controls already support move, scale, flip, and issue flags.
- Missing local image requests are proxied to the GitHub asset source.

Do not replace these systems with older copies.

## Confirmed asset defect: Rowan

Rowan's player art is source-cropped. The missing feet are baked into the PNG frames; CSS sizing or `object-fit` changes cannot restore those pixels.

Affected set:

- `rowan_front_idle.png`, `rowan_front_1.png` through `rowan_front_6.png`
- `rowan_back_idle.png`, `rowan_back_1.png` through `rowan_back_6.png`
- `rowan_side_idle.png`, `rowan_side_1.png` through `rowan_side_6.png`
- `rowan_hero.png` should be reviewed separately as portrait art

The three duplicated runtime asset locations must stay synchronized:

- `artifacts/mockup-sandbox/public/images/`
- `artifacts/primeria/public/images/`
- `primeria-export/public/images/` when that export exists

## Required replacement standard

When replacement art is supplied or regenerated:

1. Preserve the character design; do not redraw or restyle Rowan.
2. Use a transparent 300 × 340 canvas for every walk frame.
3. Keep the full body visible with a shared bottom margin; no feet may touch or cross the canvas edge.
4. Normalize character height across every frame so walking does not pulse in scale.
5. Verify front, back, and side sequences as animated loops before replacing runtime files.
6. Replace all runtime duplicates together.
7. Do not compensate with CSS cropping, stretching, or per-direction scale changes.

## Tayanari image-quality rule

Never silently replace questionable Tayanari art. Record each confirmed defect by exact path and defect type (cropped anatomy, fake checkerboard, opaque background, duplicate art, wrong creature, incorrect facing, or inconsistent frame scale), then replace only after visual confirmation.

The battle DEV flag control is useful for discovery, but its current flags are session state. Durable findings belong in `.agents/memory/tayanari-asset-quality.md`.

## Deliberately not changed

- No existing PNG was modified without an approved replacement image.
- No player-menu behavior was rewritten because its requested tabs are present in the recovered code.
- No encounter visuals were reverted because the recovered code already contains the upgraded rarity/element effects.
- No class or move balance was changed without final design values.
