---
name: scene world dims must match bg art aspect
description: Why each WalkDemo scene's world {w,h} must match its background image's native aspect ratio, how to re-place entities when fixing it, and the easy-to-miss runtime selectors
---

# Scene world dims vs background art aspect

Each scene renders its background `<img>` filling the world container (`objectFit:"cover"` for most, `"fill"` for overworld). If the world `{w,h}` aspect does NOT match the background PNG's native aspect, `cover` **crops** the art (parts of the map invisible but still walkable) and `fill` **distorts** it.

**Correct pattern** (overworld already does it): set world dims to the art's native aspect. overworld-map.png 1402×1122 → `OW={1124,900}`; route2-map.png 1024×1536 → `R2={1024,1536}`.
**Why:** when world aspect == art aspect, cover/fill/contain all show the full art with no crop and no distortion, so the walkable grid == the visible map.

## Two places to edit per scene (easy to miss)
A scene is only fully wired when it appears in BOTH the **render** selectors (the width/height + bg `<img>` ternaries) AND the **main movement-loop** selectors `world`/`zones`. If a scene is in render but missing from the `world` ternary, it silently falls through to `PH` (Player Home 800×800) and movement is clamped to 800×800 even though the map renders larger — right/bottom regions become unreachable. Always grep the `const world =` / `const zones =` ternaries when adding or resizing a scene. Scenes with no collisions map to `NO_SOLIDS`.

## Re-placing entities when changing a scene's dims
Changing world dims moves where art features land in world coords, so every placed entity (NPC POS, door/exit Rects, spawn points, hotspots, `*_BLOCKED`) must be transformed by the cover-crop inverse to stay on the same art feature:
- old world (Wo×Ho), art (A×B), new world = native art (A×B).
- `scale = max(Wo/A, Ho/B)`; `offsetX=(A*scale-Wo)/2`, `offsetY=(B*scale-Ho)/2`.
- `newX=(oldX+offsetX)/scale`, `newY=(oldY+offsetY)/scale`.
- "art wider than world" mismatches → offsetY≈0, so y barely changes; x gets the offset+rescale.

Remember: apply edits to BOTH WalkDemo copies (primeria src/game + mockup-sandbox), numeric consts identical, only image path prefix differs.
