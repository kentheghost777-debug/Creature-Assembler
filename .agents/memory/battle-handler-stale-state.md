---
name: Battle-end handlers read companion state via ref
description: Why handleBattleEnd/handleTrainerEnd must use caughtPartyRef, not the closure caughtParty, and how companion (Wyvrunt) evolution is keyed.
---

# Battle-end handlers + caughtParty staleness

`handleBattleEnd` / `handleTrainerEnd` (WalkDemo) are `useCallback`s that intentionally
**omit `caughtParty` from their deps**. So the `caughtParty` value captured in the
closure is stale. To read the current caught-companion list inside these handlers, use
`caughtPartyRef.current` (a ref kept in sync via `useEffect`), never the closure variable.
All writes use functional updaters (`setCaughtParty(prev => ...)`) for the same reason.

**Companion (Wyvrunt) evolution keys off the companion's OWN level, not the starter's.**
`checkWyvForms` must be called with the Wyvrunt's post-battle level, computed by
`wyvLevelAfter(parts, xpGained)`: it reads `caughtPartyRef.current`, finds the Wyvrunt
by id, and re-applies `levelUpCaughtMon` *only if that slot participated* (`parts.includes(i+1)`),
else returns its current level (0 if no Wyvrunt). Earlier bug: it was passed the
**starter's** `r.newLevel`, so the dragon evolved off the starter's level.

**Why:** companions have their own level/xp; evolving them off a different creature's
level is wrong. Re-applying `levelUpCaughtMon` (instead of reading post-`setState`)
sidesteps async state-update timing.

**How to apply:** any new logic in these handlers that needs current companion data
(levels, ids, participation) must read the ref + recompute, and stay mirrored in BOTH
WalkDemo copies (primeria + mockup-sandbox).
