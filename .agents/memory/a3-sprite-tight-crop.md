---
name: A3 sprite sheet tight-crop fix
description: A3 battle sprite sheets have large empty top margins per frame — use tight bounding box coords, not the generic grid formula.
---

## Rule
When A3 mons appear too small or show arena background above/below them in battle, the cause is **large transparent top margins** in the sprite sheet frames. The generic `wldF(c,r)`, `nwF(c,r)` etc. helpers select the full grid cell. Use the tight-crop helpers instead, passing **absolute sheet pixel coordinates** measured to the actual content bounding box.

**Why:** The sprite sheets were AI-generated with creatures positioned at the bottom or middle of each frame rather than filling it. When `sheetBgStyle` renders a nearly-empty frame in a square container, the empty area shows the arena background (ritual circles, etc.), creating "something floating above/below" the creature.

**How to apply:** Use Python + PIL to measure content bounds per frame (`arr[:,:,3].max(axis=1) > 10`). Then pass tight `(x, y, w, h)` to the helpers `A3WS/A3NS/A3MS/A3AS` (defined in WalkDemo.tsx alongside the grid helpers).

## Measured bounds (as of fix date)

### a3-wild-sheet.png (1024×1536, 512×384 per cell)
| Entry | Old call | Tight coords |
|---|---|---|
| sprigget (0,0) | wldF(0,0) | A3WS(0,172,512,200) |
| ashcrawl (1,0) | wldF(1,0) | A3WS(512,164,512,208) |
| finwing (0,1) | wldF(0,1) | kept (top-margin=13) |
| stoneback (1,1) | wldF(1,1) | A3WS(512,612,512,143) |
| driftpaw_f (0,2) | wldF(0,2) | kept (top-margin=12) |
| driftpaw_m (0,3) | wldF(0,3) | A3WS(0,780,512,360) ← reuses driftpaw_f frame (row 3 frame only had 95px of content) |
| stoneback_m (1,3) | wldF(1,3) | A3WS(512,1427,512,97) |
| gloomcap (1,2) | wldF(1,2) | kept (top-margin=12) |

### a3-new-sheet.png (1536×1024, 512×512 per cell)
All frames had top-margin ~140-177px. Tight coords:
- silkfae_m: A3NS(0,141,512,355)
- murkspine_m: A3NS(512,160,512,337)
- fernclaw_m: A3NS(1024,169,512,328)
- silkfae_f: A3NS(0,652,512,357)
- murkspine_f: A3NS(512,684,512,325)
- fernclaw_f: A3NS(1024,689,512,320)

### a3-mid-sheet-m.png (1122×1402, 1122×350 per cell)
- verdwulf: A3MS(0,46,1122,294)
- scorchrex/tidalfang: kept (top-margin≤10)
- aetherwing: A3MS(0,1114,1122,276)

### a3-apex-sheet.png (1536×1024, 768×512 per cell)
- verdanthos: kept (top-margin=16)
- voidtide: A3AS(768,140,768,357)
