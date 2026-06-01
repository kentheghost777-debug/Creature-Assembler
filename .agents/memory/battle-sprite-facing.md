---
name: Battle sprite facing (wildFaces/playerFaces)
description: How to set a MonSpec's facing flags so a new battle sprite points the right way.
---

# Battle sprite facing

`MonSpec.wildFaces` / `playerFaces` declare the sprite art's **NATIVE** orientation (the direction the creature looks in the raw PNG), NOT the desired on-screen direction. The engine flips from there.

- Wild stands on the RIGHT, must face LEFT (toward player): `wildScaleX = wildFaces==="left" ? 1 : -1` (no flip if native already left).
- Player stands on the LEFT, must face RIGHT (toward opponent): player flip uses `active.faces==="right" ? 1 : -1`, i.e. it applies `scaleX(-1)` when native art faces **left**.

**Rule:** set both flags to the art's actual native direction. For art that faces LEFT (most of our AI dragon/creature art), use `wildFaces:"left", playerFaces:"left"` — the engine then mirrors the player copy to face right.

**Why:** a sprite swapped in with `playerFaces:"right"` while the art actually faces left will NOT flip, so the player's mon faces away from the opponent ("wrong side"). This bit the Wyvrunt chain — its art faces left but the spec said `playerFaces:"right"`.

**How to apply:** when adding/replacing a standalone battle sprite (`wildImg`/`playerImg`), eyeball which way the art looks and set both flags to that. Evolved forms that spread from a base spec (`{...WYVRUNT_SPEC, ...}`) inherit the base's facing — fix the base once.
