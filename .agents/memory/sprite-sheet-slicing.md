---
name: Sprite-sheet slicing & walk-cycle normalization
description: How to turn an AI-generated multi-frame walk sheet into clean, non-pulsing game frames; compass verification; per-row scale gotcha.
---

# Slicing AI walk sheets into game frames

When rebuilding a character's overworld walk cycle from an attached sprite sheet (e.g. a 1536×1024 sheet, 2 rows × 6 cols per direction = 12 frames):

1. **Background-remove the sheet first** (user pref: always run background removal on character sprites — AI sheets have warm gradient backgrounds, not black; pixel/threshold tricks don't work).
2. **Slice via connected-components** (scipy `label`) on the alpha channel, not fixed grid math — frame spacing/centering varies.
3. **Verify compass before writing.** Don't trust sheet labels. Build a montage and eyeball: face visible toward camera = front/`walk_down`; backpack/no face = back/`walk_up`; nose toward screen-right = side/`walk_side` (engine renders side right-native and mirrors with flipX for left). A "left" sheet is usually redundant — the engine mirrors.
4. **Downsample 12→6** with every-other `[0,2,4,6,8,10]` for a smooth loop matching the existing 6-frame cadence.

## The per-row scale gotcha (caused a size pulse)
AI sheets often draw the **top row larger than the bottom row** (e.g. side top row 230px tall, bottom row 190px). A single global scale + feet-at-bottom then makes the character **shrink mid-walk**. Within a row, bbox heights are uniform (variation is source-scale, not pose), so:

**Normalize each frame to a constant figure HEIGHT** (crop to bbox, scale so height = TARGET, here 290), then center x and anchor feet flush at the canvas bottom. This equalizes rows without introducing pose-driven pulsing.

## Canvas / feet anchor must stay 300×340
`drawSprite` maps canvas width→96px and height by aspect; `topOff=round(96*0.75)=72`. A 300×340 frame with feet at y=340 lands feet at `py+37` — the position every other char uses. Changing canvas aspect would misalign feet. Always output 300×340, feet flush at bottom (margin 0, matching jess/kinju), so a new char sits consistently in the world.

**Why:** the cut-feet bug was baked into the *source art* (soles cropped), not CSS — re-slicing from full-feet art + bottom-flush placement fixes it. See also `portrait-framing.md` (char-select framing is a different concern: there feet need margin, not flush-bottom).

## Idle frames must match their walk frame, or the player "pops" size when stopping
`drawSprite` normalizes by canvas WIDTH, so on-screen figure size = figure-px / canvas-px. If the `{dir}_idle.png` has a different figure-to-canvas ratio than its `{dir}_1.png` walk frame, the character visibly grows or shrinks the instant they stop moving. AI-generated idle and walk assets almost never share the same canvas/margins (idles came in tighter or looser).

**Fix:** re-pad each idle to the matching walk frame — same canvas (300×340), crop idle to bbox, scale so its figure HEIGHT equals the walk frame's figure height, center x, feet flush at the walk frame's feet line. (Real case: Kinju idle rendered oversized, Rowan's idle was figH 228 vs 290 walking — undersized.) The char-select picker reuses these same idle files via `objectFit:contain`, so this re-pad is safe there too.

## Canvas-clipping a sheet whose frames don't divide evenly
When a sheet's frame size isn't an integer (e.g. 1024/5 = 204.8), use `Math.round(fw*col)` for the **source** rect, not `Math.floor` — floored columns drift left and bleed an adjacent frame's edge (Jerbs caught a neighbour's lantern). And make the destination canvas match the frame's aspect ratio: a 204.8×512 frame (~0.4) drawn into 56×112 (0.5) stretched the figure ~25% too wide. Pick one axis (keep height) and derive the other from the frame aspect.

## Battle-stage sheets: cells are stretched to FILL the box → must be bottom-aligned
Area-3 battle sheets (`a3-wild/new/mid/apex`, helpers `wldF/nwF/mmF/apF`) render each grid cell via `sheetBgStyle` background-position/size so one cell exactly fills the battle box. AI sheets place creatures at wildly inconsistent vertical positions inside their cells (measured botgaps ranged 2→291px), so creatures appeared to **float / "feet above heads"** in wild encounters.

**Fix (no AI cost):** re-pack each cell with PIL — crop content bbox, scale DOWN only to fit (height ≤ ~0.94·cell, width ≤ ~0.96·cell, never upscale), then center-x and bottom-align (feet ~3% above cell bottom). Preserve relative size (a chick should stay smaller than a dragon) — do NOT normalize to constant height like walk frames (here the size variance is intentional, and upscaling genuinely-small art blurs it). Back up originals first; sync the 4 sheets to BOTH `artifacts/{primeria,mockup-sandbox}/public/images/` and bump `primeria/public/sw.js` cache.
