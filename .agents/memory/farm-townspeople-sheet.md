---
name: farm-townspeople sheet layout
description: Correct cell grid for farm-townspeople.png and which character maps to which farm NPC
---

# farm-townspeople.png layout

The sheet is **1264×843**, a clean **4 columns × 2 rows** grid → cells are **316×421** (NOT 256×256, despite an old stale comment that claimed 1024×512). Crops assuming 256px cells slice every character wrong.

**Why:** the source art was regenerated at a larger size at some point but the slicing comment/coords were never updated, so the canvas sprite-sheet clip produced garbage cuts.

**How to apply:** to re-cut an NPC, crop the full cell (`magick SRC -crop 316x421+COLx+ROWy`), remove background with `remove_image_background_tool`, then `-trim +repage -resize 280x340\> -gravity south -extent 300x340` to a feet-flush canvas, and render via `<img objectFit:contain>` (not canvas clipping).

Role → cell mapping (row,col, 0-indexed):
- **Shella** (shell vendor, gold theme) → r0 c1 — seafaring woman, red bandana
- **Runrik** (rune forger, blue theme) → r1 c0 — burly bearded blacksmith
- **Maren** (creature keeper, green theme) → r0 c3 — woman in green dress + white apron

Other unused cells: r0c0 old woman, r0c2 purple-apron woman w/ hammer, r1c1 soldier, r1c2 suited man w/ book, r1c3 young man w/ guitar.

Saved sprites: `shella-npc.png`/`runrik-npc.png`/`maren-npc.png` in BOTH artifacts' `public/images/`.
