---
name: In-game DEV door-placement tool
description: How to let a non-technical user tell you exactly where a door trigger belongs
---

# DEV door-placement overlay (WalkDemo)

A fixed "DEV" button (top-left, in `WalkDemo.tsx`, both the primeria runtime and the
mockup-sandbox canonical copy) toggles a debug overlay that:
- draws every overworld door trigger rect as a labeled blue box ("name x,y"),
- shows live player world coords,
- on tap/click computes the world coord under the tap and shows it in yellow.

Screen→world conversion: `world = cam.current + (clientX - vpRect.left) / ZOOM`
(reuses the world container's `scale(ZOOM) translate(-cam)` transform; `cam` is a ref).

**Why:** repositioning door hotspots by eye from screenshots was a slow, costly guess
loop. Letting the user tap where they want the door and read me the numbers is exact.

**How to apply:** when a user wants a door/interaction moved and can't describe coords,
tell them to enable DEV, tap the spot, and report the yellow numbers — then set the
matching `OW_*_DOOR` rect around that point.
