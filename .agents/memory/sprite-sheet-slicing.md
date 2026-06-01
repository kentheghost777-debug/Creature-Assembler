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
`drawSprite` maps canvas width→96px and height by aspect; `topOff=round(96*0.75)=72`. A 300×340 frame with feet at y=340 lands feet at `py+37` — the position every other char uses. Changing canvas aspect would misalign feet. Always output 300×340, feet flush at bottom (margin 0, matching jess/kael), so a new char sits consistently in the world.

**Why:** the cut-feet bug was baked into the *source art* (soles cropped), not CSS — re-slicing from full-feet art + bottom-flush placement fixes it. See also `portrait-framing.md` (char-select framing is a different concern: there feet need margin, not flush-bottom).
