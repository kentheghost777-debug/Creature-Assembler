# Primeria

A monster-tamer RPG (Pokémon-style) built entirely in the browser — explore an overworld, bond with Tayanari creatures, evolve them, and battle rival Keepers.

## Run & Operate

- `pnpm --filter @workspace/mockup-sandbox run dev` — run the game (preview path `/preview/walk-demo/GameLauncher`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Vite + React 19

## Two file sets (READ FIRST)

There are TWO copies of the game code — apply every gameplay/dialogue/asset edit to BOTH and keep them in sync:

1. **Canonical source**: `artifacts/mockup-sandbox/src/components/mockups/walk-demo/`
2. **LIVE runtime the user plays**: `artifacts/primeria/src/game/` (entry: `src/main.tsx → App.tsx → ./game/GameLauncher`). Always sync to `src/game/<file>`, never `src/` root.

Sync rules & known divergences between the two sets:
- **Image/audio paths differ**: mockup uses `/__mockup/images/` + `/__mockup/audio/`; primeria uses `./images/` + `./audio/`. Sync sed: `'s|/__mockup/images/|./images/|g; s|/__mockup/audio/|./audio/|g'`. `audioManager.ts` is copied verbatim (no path replacement).
- **char-select portrait field name differs**: primeria runtime uses `activeChar.hero`, mockup uses `activeChar.hdImg` (both point at the same `{kinju,jess,rowan}_hero.png`). A blind sed-sync would clobber this — review before resyncing GameLauncher/WalkDemo.
- **Some dialogue (LINES) text differs** between the two sets (e.g. `prof2_d4`). When adding adjacent lines, anchor on each file's own text rather than assuming identical strings.
- **Assets are per-artifact copies**: image/audio fixes must be written to BOTH `artifacts/mockup-sandbox/public/` and `artifacts/primeria/public/`, then bump `artifacts/primeria/public/sw.js` CACHE_VERSION + ASSET_CACHE so the service worker refetches. **Code-only changes need NO sw.js bump.**

## File map

- `GameLauncher.tsx` — title/menu/character-reveal/intro flow → mounts the game (role/path declared in-game at the lab)
- `WalkDemo.tsx` — overworld engine (scenes: overworld/home/lab/route1/route2/area3/maya/jay/ellio/lia; movement, doors, NPCs, quests, inventory UI)
- `BattleScene.tsx` — turn-based battle + capture + XP. Exports `SpriteSheet`, `sheetBgStyle`, `MonSpec`, `BattleMon`
- `progression.ts` — XP curve, SHELLS/RUNES item data, element colors
- `moves.ts` — combat data + pure math (`MOVES`, `STRONG_AGAINST` type chart, `effectiveness`, `computeDamage`, learnsets, wild stat/level helpers, `partyBattleStats`)
- `battleFx.tsx` — `<MoveFx>` per-element/utility battle animations + `MOVE_FX_KEYFRAMES` (mobile-light: transform/opacity, ≤10 particles)
- `save.ts` — localStorage save (key `primeria_v3`)
- `audioManager.ts` — singleton BGM/jingle manager
- `STANDALONE_BUILD.md` — steps to package a downloadable web/APK/desktop build
- Game images: `public/images/` (mockup serves as `/__mockup/images/...`)

## Characters & sprites

- **Playable characters**: Kinju (id `"kinju"`, sunlit wanderer), Jess (wildheart roamer), Rowan (seasoned traveler). All sprite files use the `kinju` prefix.
- **`CHARACTERS` array** carries `id`, `name`, `tag`, `sprite`, `hero`, `desc`, `stats`. `sprite` = small pixel idle for the char-select picker (leave it alone); `hero` = HD full-body transparent portrait `{kinju,jess,rowan}_hero.png` shown in the large box (`objectFit:contain`, no pixelated). `CHAR_INTRO_LINES` = `Record<CharId,string[]>`, 5 lines each. `hero-art.png` is the title-screen art.
- **`CHAR_IMG_KEY`** (`Record<CharId,string>` in WalkDemo) — identity map; the single place to remap a CharId to its sprite-file prefix if assets are swapped.
- **Walk-cycle frames** (`dirFrames(c, sideN=6)`): each char has `{front,back,side}_{1..6}.png` + `{front,back,side}_idle`. Rules:
  - **Idle frames must be normalized to match their `{dir}_1.png` walk frame** (same 300×340 canvas, same figure height, feet flush at bottom, centered x) or the player "pops" bigger/smaller when standing still. Re-pad on every idle regen.
  - Side frames face RIGHT natively; engine mirrors (flipX) for left.
  - `sideN` lets a char use fewer side frames — **Jess uses `dirFrames("jess", 5)`** (`jess_side_6.png` faces the wrong way; dropped from the cycle).
  - When rebuilding walk frames from sprite sheets, normalize **per-frame to constant HEIGHT** (sheet rows have inconsistent source scale, so a single global scale pulses).
- **Jay/Lia NPC sprites**: static (no walk cycle) — single front sprite `jay-sprite.png` / `lia.png` (already transparent) covers overworld + dialog + Area 3.

## World geography & navigation

Rects are `[x1,y1,x2,y2]`. Movement clamps player x to `world.w-30` — door/exit rects must START inside that bound or they're unreachable.

- **Door positions** (placed via the DEV door tool): Player home `[550,735,610,765]` + up-key; Lia `[945,738,1005,768]`; Ellio `[174,709,234,769]` + up-key (exit → `(204,790)`); Jay `[195,349,263,397]`; Maya `[971,335,1036,397]`; Lab `[525,325,607,382]`.
- **Area exits**: Route 1 north `OW_ROUTE1_EXIT=[212,0,327,15]`; Route 2 east `OW_EAST_EXIT=[1091,482,1135,572]`; Area 3 west `OW_AREA3_EXIT=[44,459,66,508]` (return spawn shifts with `OW_AREA3_EXIT[2]+30`).
- **Area 3 corridor**: gap in Jay's west fence at y=400-440. Left forest block `[0,0,155,400]` + `[0,445,155,900]` (gap y=400-445).
- **PH↔Lia path**: 50px gap (PH north fence right ends x=750, Lia north fence left starts x=800).
- **Area 3 = Westwood Reaches** (west of overworld via corridor at y≈290-360). Background `area3-bg.png` (1536×1024 source drawn into 1024×768 world). Town-return door `A3_RETURN_OW=[960,370,1024,480]` on the EAST edge (→ overworld 170,453), pulsing yellow glow.
- **Walls (collisions) currently OFF**: `WALLS_ON=false` short-circuits `blocked()` to false (player walks anywhere; `*_BLOCKED` rect arrays inactive; DEV red boxes hidden). Doors unaffected (use `inRect` directly). NPC colliders use a separate always-solid check so they block regardless (see Old Hollis). Flip back to `true` once new walls are baked in.
  - **Wall editor (BUILT)** — DEV overlay "WALL TOOL" section. `*_BLOCKED` arrays + `WALLS_ON` are now module-level `let`; a `WALL_SCENES` registry (scene→get/set closures) lets the editor reassign them live, and `ldWalls`/`primeria_dev_walls` overlays localStorage edits on the baked defaults at module load. Controls: Walls ON/OFF toggle (persists `primeria_dev_walls_on`), Edit ON/OFF, COPY wall layout. In edit mode: tap two corners to draw a box, drag to move, double-tap (450ms, drag-guarded) to delete. While editing, door editor / probe / passive visualiser are suppressed. Paste the COPY output back and I bake rects into the `*_BLOCKED` literals in BOTH copies, then flip the `WALLS_ON` default true.

## Progression gates

- Lab door → requires `allTownItems` (5 town errands done) before giving starter.
- Route 1 → `starter && allTownItems`. Route 2 → `wifeIntercepted`. Area 3 → `starter && route1Visited && route2Greeted` (progressive toasts).
- **Level cap**: MAX_LEVEL=25 normally; Wyvrunt chain (forms 0-2) cap=30; Aureyvant uncapped. Enforced in `calcBattleXp()`.

## NPCs

- **Old Hollis (Route 2 farmer)** — painted into `route2-map.png` art (no sprite entity), made interactive: `FARMER_R2_POS={x:665,y:740}` + solid collider `FARMER_R2_BOX=[651,689,680,752]`. Collider enforced via a dedicated always-solid check (`const solids = sc==="route2"?FARMER_SOLIDS:NO_SOLIDS;` OR'd into both `blocked()` axis checks) so it blocks even with `WALLS_ON=false`. Proximity (`dfarm<95`) → green "!" button (`#8ec850`) → 3-line dialogue `farm_d1→farm_d2→farm_d3→walk`. Lore: watches the Tayanari play, farms up north, originally found the rare Wyvrunt half-frozen by his fence.
- **Cleminus "Jerbs"** — demo-end mystery NPC; Jerbeen elder who lands via portal at the WEST closed-door (`JERBS_POS={x:150,y:380}`, trigger `worldPos.x<215` in area3). **Two-stage intro**: the west trigger makes Jerbs *land* (portal animates, NO text — `jerbsAppeared` flips, `portalOpen` true then auto-closes after 1700ms); the player walks up (dist<110) and taps "!" to start the conversation. Phases: `jerbs_appear → jerbs_d1/d2/d3 → jerbs_cards (overlay) → jerbs_d4 → demo_end`. Branch at jerbs_d3: if both Jay & Lia beaten → cards, else → jerbs_remind. `cleminusMet` persists him; `demoComplete` marks playthrough finished. On return: button "?" if !beatBoth, "!" if beatBoth && !demoComplete, "…" if demoComplete.
  - **Trial Cards overlay** (`jerbs_cards`) — fullscreen, Keeper + Elder Trial Cards side by side; player front-idle sprite composited into the Keeper card photo slot (≈x:88,y:233,w:283,h:320 on 1024px card → 180px display). Accept → `jerbs_d4`.
  - **Demo Complete** (`demo_end`) — fullscreen `demo_complete.png`. "Continue Exploring" → `setDemoComplete(true)`, returns as `jerbs_a3_idle`. "Thank You" → walk.
  - **Portal animation** — `jerbs_portal.png` (1536×1024, 5×2, 10 frames @120ms): size 700×460, position `-(frame%5)×140 / -floor(frame/5)×230`, loops via `setInterval` while `portalOpen`.
  - **Jerbs sprite** — `jerbs_sprite.png` (1024×1536, 5×3); canvas draws col 2 row 1. Dialog portrait: background-size 180px, position -72px/-90px. Jerbs canvas renders when `cleminusMet||portalOpen||jerbsAppeared` (draw-effect deps include those flags so the freshly-mounted canvas paints).
  - **Jerbs ambient** — `jerbs_a3_idle` handled by the ambient chat box (speaker `{name:"JERBS", color:"#e8b840"}`).

## Battle & creatures

- **Party battle system** (`BattleScene`): `bench?: BattleMon[]` carries caught companions; internal `team=[lead,...bench]`. `activeIdx`/`activeIdxRef` + per-mon `teamHp`/`teamPp`. `active` = current mon; HP plate, sprite, facing all derive from it. `setPlayerHp`/`setPlayerPp` are shims writing the active slot.
- **Switching**: root "Switch" → `menu==="switch"` picker (voluntary, **no turn lost**). On faint: if any reserve alive → forced `menu==="switchForced"` (no Back); else `onEnd({kind:"fainted"})`. You only lose when ALL party mons faint.
- **Participants/XP**: `participatedRef` (seeded `[0]`=lead) tracks who entered battle; `ko`/`caught`/`trainerWin` results carry `participants:number[]`. WalkDemo awards full XP to each (idx0=starter; idx>0 → `caughtParty[idx-1]` via `levelUpCaughtMon`, cap 30, no evo).
- **Per-mon progression**: every caught creature has its own `level`/`xp` (cap 30, NO evolution for wild-caught — only the starter + Wyvrunt chain evolve). Battle stats from `partyBattleStats(maxHp, baseDmg, rarity, level)`; active moves from `defaultActiveMoves(el, level)`. Party tab shows per-mon `Lv.` + a `MoveManager` to rearrange the active 4 from the learned pool.
- **Battle XP math** — `calcBattleXp(rawXp, xpMult, baseLevel, baseXp, baseMoves)` inner fn; `handleBattleEnd` (wild) / `handleTrainerEnd` (trainer) both call `checkWyvForms()` + `checkStarterEvo()` post-XP.
- **Trainer battles (Jay & Lia, Area 3)**: `trainerEncounter` state set in the "Battle!" handler → scene "battle" → trainer block (checked before wild). `jayA3Team(wins)`/`liaA3Team(wins)` build 4-tier progressive teams; `handleTrainerEnd` caps wins at 3. Interact buttons: "!" (first) / "↺" (rematch).
- **Wyvrunt evo chain**: WYVRUNT → WYRNAK (lv18) → WYRVAST (lv30) → AUREYVANT (loyalty≥80). `wyrLoyalty` 0–100: +3 trainer win / +3 wild ko / +2 catch / +5 quest. Loyalty bar in party tab. `checkWyvForms()` preserves level/xp when swapping a caught Wyvrunt's form.
- **Cerepup evo chain**: CEREPUP → CARAGNAR (lv18, `cerepup_evo1.png`) → BIFERNON (lv30, `cerepup_evo2.png`). Volcanic type. Evolves for BOTH starter AND wild-caught (via `checkCaughtMonEvos`). Wild-caught evo patches id/name/type/color/img onto existing mon, preserving all MonSpec fields.
- **Mentyke evo chain**: MENTYKE → SANCTYKE (lv18, `mentyke_evo1.png`) → LUMAYKE (lv30, `mentyke_evo2.png`). Mind type. **Starter-only** — wild-caught mentyke does NOT evolve (not in CAUGHT_EVO_IDS). Handled by `checkStarterEvo` only.
- **Evo level gates**: `EVO_TABLE` tier-1 at `atLevel:18`; `checkStarterEvo` checks `[18, 30]`. (Standard for all evo lines: 2nd form @18, 3rd form @30.)
- **Encounter zones**: Route 1 & Area 3 share the `activeDisturbances` + hotspot tick machinery; cleared on scene entry; `pickMonForScene(rarity, scene)` selects from the scene bestiary. A3_HOTSPOTS: 8 ruin spots. Element-tinted radial burst (`encounterFlash`) fires on disturbance click before battle fade. Hotspot `r` is **render-only** (no gameplay meaning); `HOTSPOT_VIS` (0.6) scales the visible disc + mote ring at render time.
- **Starter split** (8 starters): cerepup/shockit in Route 1 (standalone `wildImg`/`playerImg`); cunbubble/pebble/foxin/burg in Area 3 (sprite-sheet frames).
- **Bestiaries**: Route 1 = 10 mons (commons Hatchick/Loth/Voltowl, uncommons Stonub/Potent/Scavencrow, rares Ghosti/Scalel, ultra Mentyke, apex Peachi + cerepup_w + shockit_wa). Area 3 = 24 mons (see code `BESTIARY_A3`).
- **Sprite sheets**: `a3-wild-sheet.png` (4r×2c, 512×384), `a3-new-sheet.png` (2r×3c, 512×512), `a3-mid-sheet-m.png` (4r×1c, 1122×350), `a3-apex-sheet.png` (2r×2c, 768×512). Frame helpers: `wldF`, `nwF`, `mmF`, `apF`. Each cell is stretched to FILL the battle box, so cell content must be **bottom-aligned (feet ~10-15px above cell bottom, centered-x, relative size preserved)** or creatures float/appear ungrounded. Re-normalize any regenerated sheet the same way — do NOT force constant height (it badly upscales/blurs genuinely-small creatures).

## Save system

- localStorage key `primeria_v3` — `PartySave` + `WorldSave`. `PartyMon = MonSpec & {level,xp}`; `caught`/`box` are `PartyMon[]`. `WorldSave` includes `wyvruntForm`, `wyrLoyalty`, `jayA3Wins`, `liaA3Wins`, `cleminusMet`, `demoComplete`. `PartySave.moves` = active move IDs (max 4), migrated by `sanitizeActiveMoves` on load. Bare-`MonSpec[]` old saves hydrated by `hydrateParty()`.
- **Bumping the save key** (e.g. `_v3`→`_v4`) wipes everyone's save for a clean slate without touching save/load logic — the old slot is orphaned and the title shows no CONTINUE.
- **💾 SAVE button** sits in the D-pad bar next to 🎒 Bag; calls `persistWorldRef.current()` (force-flush position + quest flags). Party state auto-saves via its own useEffect on every stat/level/xp/party change — the button is just visible confirmation (`justSaved` flips green ✓ "SAVED" for 1.6s).

## Audio

- `audioManager.ts` singleton: `playTrack(src,vol)` crossfades looping BGM; `playJingle(src,vol)` ducks BGM/plays once/resumes; `stopAll()` fades out.
- **Tracks**: overworld/home/lab/npc → `primeria_town.mp3`; route1/route2/area3 → `primeria_route.mp3`; battle → `primeria_battle.mp3`; title/menu → `primeria_title.mp3` (starts on first title tap).
- **Jingles**: catch → `primeria_catch.mp3`; KO win + trainer win → `primeria_victory.mp3`.
- Browser autoplay: music starts on first user gesture (title tap). Earlier calls fail silently and clear bgSrc so the next call retries.

## Architecture notes

- **Sprite sheet clipping** — `sheetBgStyle(SpriteSheet)` returns percentage `background-size/position` (`bsX=(sheetW/frameW)*100%`, `bpX=x/(sheetW-frameW)*100%`, 0% if single column) — works at any container size. Party/storage icons instead use explicit pixel scale (`Math.min(size/w, size/h)`) to keep native aspect ratio in a fixed box.
- **Encounter render** uses an IIFE to bind a local `hs` var inside JSX.
- `calcBattleXp`, `applyLevelUp`, `checkWyvForms`, `checkStarterEvo` are plain inner fns (not useCallback) — they close over current render values and MUST be called from within the same render-cycle callback (handleBattleEnd / handleTrainerEnd).

## Product

Primeria is a browser-native monster-tamer RPG where you explore ruins, bond with Tayanari creatures, evolve them through loyalty and battle, and challenge rival Keepers in progressive trainer battles.

## User preferences

- Always run `remove_image_background_tool` on every character/NPC sprite before using it — all directions (front, back, side). AI-generated sprites have warm gradient backgrounds (NOT black); BFS/threshold pixel tricks don't reliably work, so proper transparent PNGs are the only fix. After removal, `drawSprite` just calls `ctx.drawImage` (no pixel manipulation).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
