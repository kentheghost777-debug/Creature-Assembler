# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Game "Primeria" (monster-tamer RPG): `artifacts/mockup-sandbox/src/components/mockups/walk-demo/`
  - `GameLauncher.tsx` — title/menu/intro/character-reveal flow → mounts the game (role/path is now declared in-game at the lab, not here)
  - `WalkDemo.tsx` — overworld engine (scenes: overworld/home/lab/route1/area3, movement, doors, NPCs, quests, inventory UI). Area 3 = Westwood Reaches (west of overworld via corridor at y≈290-360). Encounter transition flourish: element-tinted radial burst (`encounterFlash` state + `@keyframes encounterFlash`) fires on disturbance click before the battle fade. `MoveManager` component (lines ~32-114) lets the player rearrange their active 4 moves from the full learned pool in the party tab.
    - Route 1 BESTIARY (10 mons): commons Hatchick/Loth/Voltowl, uncommons Stonub/Potent/Scavencrow, rares Ghosti/Scalel, ultra Mentyke, apex Peachi + cerepup_w (Volcanic apex) + shockit_wa (Storm ultra)
    - Area 3 BESTIARY_A3 (24 mons): commons Sprigget/Ashcrawl/Finwing/Stoneback, uncommons Driftpaw×2/Stoneback_m/Gloomcap, rares Silkfae×2/Murkspine×2/Fernclaw×2 (from a3-new-sheet), ultras Verdwulf/Scorchrex/Tidalfang/Aetherwing (from a3-mid-sheet-m), apexes Verdanthos/Voidtide (from a3-apex-sheet) + cunbubble_wa/pebble_wa/foxin_wa apexes + burg_wa ultra
    - Sprite sheets: `a3-wild-sheet.png` (4r×2c, 512×384/frame), `a3-new-sheet.png` (2r×3c, 512×512/frame), `a3-mid-sheet-m.png` (4r×1c, 1122×350/frame), `a3-apex-sheet.png` (2r×2c, 768×512/frame). Frame helper fns: `wldF(col,row)`, `nwF(col,row)`, `mmF(row)`, `apF(col,row)`
    - `SpriteSheet` type + `sheetBgStyle(s)` exported from `BattleScene.tsx` — percentage-based CSS background clipping works at any container size. Party/storage icons use exact-pixel clip (maintain aspect ratio).
    - A3_HOTSPOTS: 8 ruin spots in courtyard + clearing. Disturbance tick clears on scene entry and picks from scene-appropriate bestiary via `pickMonForScene(rarity, scene)`.
  - `BattleScene.tsx` — turn-based battle + capture + XP. Exports `SpriteSheet`, `sheetBgStyle`, `MonSpec` (now includes optional `wildSheet`/`playerSheet` fields — sheet sprites rendered in battle with percentage CSS clipping, fallback to `wildImg`/`playerImg`).
  - `progression.ts` — XP curve, SHELLS/RUNES item data, element colors
  - `moves.ts` — combat data + pure math: `MOVES` catalog (per-element damage tiers + utility heal/sharpen/bulwark), validated `STRONG_AGAINST` type chart, `effectiveness`, `computeDamage` (STAB/eff/crit/defense soak, ±15% variance), learnsets (`learnedMoveIds`/`movesLearnedAt`/`defaultActiveMoves`/`sanitizeActiveMoves`), wild stat/level helpers
  - `battleFx.tsx` — `<MoveFx>` per-element/utility battle animations + `MOVE_FX_KEYFRAMES` (mobile-light: transform/opacity, ≤10 particles)
  - `save.ts` — localStorage save (key `primeria_v2`): `PartySave` + `WorldSave`. `PartySave.moves` stores active move IDs (max 4); old cosmetic name-strings are migrated via `sanitizeActiveMoves` on load
  - `STANDALONE_BUILD.md` — exact steps to package a downloadable web/APK/desktop build
- Game images: `artifacts/mockup-sandbox/public/images/` (referenced as `/__mockup/images/...`)
- Play it at preview path `/preview/walk-demo/GameLauncher`

## Architecture decisions

- **Sprite sheet clipping** — `sheetBgStyle(SpriteSheet)` returns `background-size/position` as percentages. Formula: `bsX=(sheetW/frameW)*100%`, `bpX = x/(sheetW-frameW)*100%` (0% if single column). Works at any responsive container size. Party/storage icons use a different approach (explicit pixel scale via `Math.min(size/w, size/h)`) to preserve the frame's native aspect ratio inside a fixed-px box.
- **Encounter zones** — both Route 1 and Area 3 share the same `activeDisturbances` + hotspot tick machinery. On scene entry the state is cleared; `pickMonForScene(rarity, scene)` selects from the scene-appropriate bestiary. The render block uses an IIFE (`(() => { const hs = …; return <>…</>; })()`) to bind a local `hs` variable inside JSX.
- **Starter split** — 8 starters split across two encounter zones: cerepup/shockit in Route 1 (forest/fire/storm feel), cunbubble/pebble/foxin/burg in Area 3 (oceanic/earthbound/spirit/frost — ruins vibes). Route 1 starters use standalone `wildImg`/`playerImg`; Area 3 native mons use sprite sheet frames.
- **Save key** — `primeria_v2` (localStorage). `PartySave.moves` stores active move IDs (max 4); migrated by `sanitizeActiveMoves` on load.

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- Always run `remove_image_background_tool` on every character/NPC sprite before using it in the game — all directions (front, back, side/profile). Sprites from AI generators have gradient backgrounds that break transparency tricks. Proper transparent PNGs are the only reliable fix.

## Gotchas

- Sprite images from AI generators have warm gradient backgrounds, NOT black. BFS/threshold pixel tricks do not reliably work. Always pre-process sprites with background removal first.
- After background removal, `drawSprite` just calls `ctx.drawImage` — no pixel manipulation needed.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
