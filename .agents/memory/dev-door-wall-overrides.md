---
name: DEV door/wall localStorage overrides mask new code defaults
description: Why a freshly-changed door/wall default rect can appear "wrong" during QA in Primeria
---

When you change a baked default door rect (e.g. `A4_RETURN_A3`) or wall layout in WalkDemo.tsx, the in-game DEV tool's saved overrides can silently win over your new code default.

**Why:** `ld(key, default)` overlays `primeria_dev_doors` (and `ldWalls`/`primeria_dev_walls` for walls) from localStorage on top of the baked defaults at module load. If the user previously placed/saved that same key via the DEV tool, the persisted rect overrides the new literal — so your code change has no visible effect for anyone with a saved override.

**How to apply:** After changing a door/wall default, if it doesn't take effect in the preview, clear `primeria_dev_doors` / `primeria_dev_walls` (or re-place via the DEV tool) before concluding the code is wrong. Only the door *keys* matter for the overlay; reusing an existing key keeps old overrides alive.
