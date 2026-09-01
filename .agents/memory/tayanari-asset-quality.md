# Tayanari and Player Asset Quality Registry

This is the durable source of truth for visual asset defects. Future agents must read it before changing character or Tayanari images.

## Confirmed defects

| Asset set | Status | Defect | Required action |
|---|---|---|---|
| Rowan player walk frames (front/back/side idle + frames 1–6) | Confirmed | Feet/body are source-cropped; framing is baked into PNGs | Replace as a complete normalized 300 × 340 transparent set; do not CSS-patch |
| Rowan hero portrait | Review required | Listed with player art but serves a different framing purpose | Inspect independently; do not apply walk-frame rules blindly |

## Candidate Tayanari defects

No Tayanari is marked broken solely from a filename or automated size check. Add entries only after seeing the actual pixels.

Use one row per exact asset:

| Exact path | Creature | Defect type | Evidence | Replacement status |
|---|---|---|---|---|
| _Add after visual confirmation_ |  |  |  |  |

Accepted defect types: cropped anatomy, fake checkerboard, opaque background, duplicate art, wrong creature, incorrect facing, inconsistent scale, corrupt/unreadable file.

## Replacement safety

- Preserve filenames unless code references are updated in the same validated change.
- Keep `mockup-sandbox`, `primeria`, and export copies synchronized.
- Confirm transparency and alpha edges.
- Verify player/wild facing in a real battle.
- Run the build and a gameplay smoke test before merging.
- Never bulk-delete assets as a cleanup shortcut.
