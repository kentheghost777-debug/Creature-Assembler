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

## Movement clamp vs edge-exit triggers (off-by gotcha)
Movement clamps the player to `x∈[30, w-30]`, `y∈[0, h-30]` (a ~30px sprite buffer at right/bottom, none at top/left). So ANY exit/door trigger rect on the **bottom or right edge** must intersect that reachable domain: a bottom-edge gate needs `y1 ≤ h-30`, a right-edge door needs `x1 ≤ w-30`. When you shrink a scene's world height/width, a bottom/right trigger that was barely reachable can fall entirely outside the clamp and become impossible to hit (silent soft-lock — player can't leave the scene).
**Why:** Route 1's south gate was a 1px-tight bottom-edge trigger at the old height; rescaling pushed its y1 below `h-30` and locked the player in.
**How to apply:** after changing any scene's `{w,h}`, check every bottom/right edge exit rect against `h-30`/`w-30` and pull its near edge inward if needed. Top/left edge triggers (y=0 / x=0) are unaffected.
