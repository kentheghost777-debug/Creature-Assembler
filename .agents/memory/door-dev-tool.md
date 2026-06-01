---
name: In-game DEV door-placement tool
description: How to let a non-technical user tell you exactly where a door trigger belongs
---

# DEV door editor (WalkDemo)

A fixed "DEV" button (top-left, in `WalkDemo.tsx`, both the primeria runtime and the
mockup-sandbox canonical copy) toggles an editor overlay that now does more than probe:
- shows ALL door trigger rects for the **current scene** (not just overworld) as labeled
  draggable blue boxes; drag moves the door live, with a ✦ corner button to toggle that
  door's glow on/off,
- still shows live player coords + a tap-to-probe yellow crosshair,
- a COPY button exports a labeled per-scene layout (name, key, rect, glow ON/OFF) to the
  clipboard for the user to paste back, so I bake the chosen values into source.

Drag/probe screen→world conversion uses `delta / ZOOM` (world container is
`scale(ZOOM) translate(-cam)`; `cam` is a ref).

**Door rects are now `let X: Rect = ld("key", [..default..])`, NOT `const`.** `ld()` reads
a localStorage override (`primeria_dev_doors`); `ldGlow()` reads `primeria_dev_glows`. A
`DOOR_LIST` registry maps each key → scene + live get()/set() accessors that mutate those
`let`s, and drives both the always-on glow renderer and the dev editor. Per-door glow
visuals are preserved by a `GLOW_SHAPE` lookup (keyed by door key, anchored to the live
rect so the glow tracks dragging); unmapped doors fall back to a centered ellipse.
Excluded from the DOOR registry on purpose: `MAYA_SHELL` (a pickup).

## DEV wall/collider editor (same DEV overlay, "WALL TOOL" section)

The same DEV overlay now also has a wall editor mirroring the door one. The `*_BLOCKED`
arrays are now module-level `let` (not const) with a `WALL_SCENES` registry (scene → key
→ get()/set() closures reassigning those lets). At module load `WALL_SCENES.forEach(w =>
w.set(ldWalls(w.key, w.get())))` overlays localStorage edits (`primeria_dev_walls`) on top
of the baked defaults. `WALLS_ON` is also `let`, initialized from `primeria_dev_walls_on`.
- In the panel: "Walls: ON/OFF" toggle (flips module `WALLS_ON` + persists), "Edit:
  ON/OFF" toggle, and "COPY wall layout" (exports per-scene rects with the array var name).
- In edit mode: tap two map corners to draw a box, drag a box to move, **double-tap**
  (450ms window, guarded by `wallMovedRef` so a drag isn't a tap) to delete. While
  wallEditMode is ON, the door editor / probe / passive red visualiser are suppressed.
- Reading correctness: `blocked()`, the movement zones ternary, and the render ternary all
  read the module-level lets at call/render time, so reassignment is observed immediately;
  React overlays refresh via `setWallEditTick` / `setWallsOnTick`.
- **To bake a layout:** user enables DEV → Edit, draws walls, hits COPY, pastes back; I
  write the rects into the `*_BLOCKED` array literals in BOTH WalkDemo copies, then flip
  `WALLS_ON` default back to a real default once walls are baked. Same localStorage-masking
  caveat as doors — trust the user's COPY/words over source defaults.

**Why:** repositioning doors by eye from screenshots was a slow, costly guess loop. The
editor lets a non-technical user drag doors and toggle glows themselves, then COPY the
result for me to commit — exact, no coordinate dictation.

**How to apply:** when the user wants doors moved/glow changed, tell them to enable DEV in
the relevant scene, drag boxes / tap ✦, hit COPY, and paste it back. Then write the values
into the `ld("key", [...])` defaults in BOTH WalkDemo copies. (For a one-off coord, the
tap-probe yellow numbers still work.) Note: localStorage overrides persist per-browser, so
the user's local edits can mask source defaults until the override key is cleared.
