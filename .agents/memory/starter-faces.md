---
name: StarterSpec faces field
description: StarterSpec has an optional faces field for starters whose art natively faces left; BattleScene uses it to flip them correctly.
---

## Rule
`StarterSpec` has `faces?: "left" | "right"` (defaults "right"). BattleScene builds the lead BattleMon with `faces: starter.faces ?? "right"`. The engine then flips the sprite so the mon always faces the opponent (right side).

**Why:** The lead BattleMon's `faces` field was hardcoded to `"right"` in BattleScene, so any starter whose art natively faces LEFT appeared backwards in battle (facing away from the wild mon).

**How to apply:** Add `faces: "left" as const` to any entry in the `STARTERS` array (WalkDemo.tsx) whose `img` asset faces left. Known left-facers:
- `pebble` → `grrountain-baby.png` faces left → `faces: "left" as const`

If adding a new starter and the sprite faces right, no field needed (defaults "right").
