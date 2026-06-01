# Primeria

A monster-tamer RPG (Pokémon-style) built entirely in the browser — explore an overworld, bond with Tayanari creatures, evolve them, and battle rival Keepers.

## Run & Operate

- `pnpm --filter @workspace/mockup-sandbox run dev` — run the game (preview path `/preview/walk-demo/GameLauncher`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Vite + React 19 (mockup-sandbox)
- Build: Vite dev server

## Where things live

- Game "Primeria" (monster-tamer RPG): `artifacts/mockup-sandbox/src/components/mockups/walk-demo/`
  - `GameLauncher.tsx` — title/menu/character-reveal/intro flow → mounts the game (role/path is declared in-game at the lab)
    - **New Game flow**: NEW GAME → `char_reveal` (pick character first) → `beginJourney()` creates save → `intro` (character-tailored Prof. Irwyn speech) → game.
    - **Characters**: `CHARACTERS` array carries `id`, `name`, `tag`, `sprite`, `desc`, `stats` per char. `CHAR_INTRO_LINES` is a `Record<CharId, string[]>` with 5 character-specific lines each.
    - **Playable characters**: Kinju (id `"kinju"`, sunlit wanderer — horizon-seeker), Jess (wildheart roamer — instinct/nature), Rowan (seasoned traveler — knowledge/discovery). Image files still use `"kael"` prefix for Kinju (mapped via `CHAR_IMG_KEY` in WalkDemo).
    - **CHAR_IMG_KEY**: `Record<CharId, string>` in WalkDemo maps `kinju → "kael"` for image lookups until new Kinju sprites ship.
  - `WalkDemo.tsx` — overworld engine (scenes: overworld/home/lab/route1/route2/area3/maya/jay/ellio/lia, movement, doors, NPCs, quests, inventory UI).
    - Area 3 = Westwood Reaches (west of overworld via corridor at y≈290-360). Encounter transition flourish: element-tinted radial burst (`encounterFlash` state + `@keyframes encounterFlash`) fires on disturbance click before the battle fade.
    - `MoveManager` component lets the player rearrange their active 4 moves from the full learned pool in the party tab.
    - **Progression gates**: Lab door → requires `allTownItems` (all 5 town errands done) before giving starter (bounce: "Say your goodbyes first"). Route 1 → requires `starter && allTownItems`. Route 2 → requires `wifeIntercepted` (triggers after Route 1 visit + all items). Area 3 → requires `starter && route1Visited && route2Greeted` (progressive toast messages).
    - **Door positions**: Player home `[545,820,605,850]` + up-key; Lia `[890,780,950,810]`; Ellio `[244,778,296,808]` + up-key; Jay `[240,400,308,448]`; Maya `[895,383,960,445]`.
    - **Area 3 corridor**: Gap in Jay's west fence at y=400-440 (building bottom to south fence). Left forest block `[0,0,155,400]` + `[0,445,155,900]` — gap at y=400-445. `OW_AREA3_EXIT=[0,398,22,447]`. Return spawn `(170, 423)` — Jay's SW courtyard.
    - **PH↔Lia path widened**: PH north fence right trimmed to x=750, Lia north fence left starts at x=800 → 50px gap (was 24px).
    - **Wyvrunt evo chain**: WYVRUNT → WYRNAK (lv16) → WYRVAST (lv30) → AUREYVANT (wyrLoyalty≥80). Loyalty bar shown in party tab. WYV_FORMS array + wyvruntForm state + checkWyvForms() helper.
    - **Jay & Lia (Area 3 trainers)**: JAY_A3_POS/LIA_A3_POS, jayA3Team(wins)/liaA3Team(wins) build 4-tier progressive teams. Interact buttons show "!" (first time) / "↺" (rematch). handleTrainerEnd() callback handles XP, loyalty, form-evo, win counter.
    - **Level cap**: MAX_LEVEL=25 normally; wyvrunt chain (forms 0-2) cap=30; Aureyvant uncapped. Enforced in calcBattleXp() inner loop.
    - Route 1 BESTIARY (10 mons): commons Hatchick/Loth/Voltowl, uncommons Stonub/Potent/Scavencrow, rares Ghosti/Scalel, ultra Mentyke, apex Peachi + cerepup_w (Volcanic apex) + shockit_wa (Storm ultra)
    - Area 3 BESTIARY_A3 (24 mons): commons Sprigget/Ashcrawl/Finwing/Stoneback, uncommons Driftpaw×2/Stoneback_m/Gloomcap, rares Silkfae×2/Murkspine×2/Fernclaw×2 (from a3-new-sheet), ultras Verdwulf/Scorchrex/Tidalfang/Aetherwing (from a3-mid-sheet-m), apexes Verdanthos/Voidtide (from a3-apex-sheet) + cunbubble_wa/pebble_wa/foxin_wa apexes + burg_wa ultra
    - Sprite sheets: `a3-wild-sheet.png` (4r×2c, 512×384/frame), `a3-new-sheet.png` (2r×3c, 512×512/frame), `a3-mid-sheet-m.png` (4r×1c, 1122×350/frame), `a3-apex-sheet.png` (2r×2c, 768×512/frame). Frame helper fns: `wldF(col,row)`, `nwF(col,row)`, `mmF(row)`, `apF(col,row)`
    - `SpriteSheet` type + `sheetBgStyle(s)` exported from `BattleScene.tsx` — percentage-based CSS background clipping works at any container size. Party/storage icons use exact-pixel clip (maintain aspect ratio).
    - A3_HOTSPOTS: 8 ruin spots in courtyard + clearing. Disturbance tick clears on scene entry and picks from scene-appropriate bestiary via `pickMonForScene(rarity, scene)`.
  - `BattleScene.tsx` — turn-based battle + capture + XP. Exports `SpriteSheet`, `sheetBgStyle`, `MonSpec`. Trainer battle support: `keeperTeam`/`keeperMonLevels` props, `trainerMonIdx` cycling, `trainerWin` BattleResult kind.
  - `progression.ts` — XP curve, SHELLS/RUNES item data, element colors
  - `moves.ts` — combat data + pure math: `MOVES` catalog (per-element damage tiers + utility heal/sharpen/bulwark), validated `STRONG_AGAINST` type chart, `effectiveness`, `computeDamage` (STAB/eff/crit/defense soak, ±15% variance), learnsets (`learnedMoveIds`/`movesLearnedAt`/`defaultActiveMoves`/`sanitizeActiveMoves`), wild stat/level helpers
  - `battleFx.tsx` — `<MoveFx>` per-element/utility battle animations + `MOVE_FX_KEYFRAMES` (mobile-light: transform/opacity, ≤10 particles)
  - `save.ts` — localStorage save (key `primeria_v2`): `PartySave` + `WorldSave`. WorldSave includes: `wyvruntForm`, `wyrLoyalty`, `jayA3Wins`, `liaA3Wins`, `cleminusMet`, `demoComplete`. `PartySave.moves` stores active move IDs (max 4); migrated by `sanitizeActiveMoves` on load.
    - **Cleminus "Jerbs"** — demo-end mystery NPC. Jerbeen elder who appears via portal at the far-west ruin corridor (JERBS_POS={x:235,y:380}, trigger x<215 in area3). Phases: `jerbs_appear → jerbs_d1/d2/d3 → jerbs_cards (overlay) → jerbs_d4 → demo_end`. Branch at jerbs_d3: if jayA3Wins>0 && liaA3Wins>0 → cards; else → jerbs_remind. `cleminusMet` persists his NPC in world; `demoComplete` marks playthrough finished.
    - **Trial Cards overlay** (phase `jerbs_cards`) — fullscreen black overlay showing Keeper Trial Card + Elder Trial Card side by side. Player front-idle sprite composited into photo slot of Keeper card (slot at ≈x:88,y:233,w:283,h:320 on 1024px card → scaled to 180px display width). Accept Licenses → `jerbs_d4`.
    - **Demo Complete screen** (phase `demo_end`) — fullscreen overlay with `demo_complete.png`. "Continue Exploring" → `setDemoComplete(true)`, returns to world as `jerbs_a3_idle`. "Thank You" → walk.
    - **Portal animation** — `jerbs_portal.png` (1536×1024, 5 cols×2 rows, 10 frames at 120ms/frame). CSS background-position step: size 700×460px, position -(frame%5)×140 / -floor(frame/5)×230. Loops via `setInterval` while `portalOpen`.
    - **Jerbs sprite** — `jerbs_sprite.png` (1024×1536, 5 cols×3 rows). Canvas draws col 2, row 1 (front-standing). Dialog portrait: CSS background-size 180px auto, backgroundPosition -72px / -90px.
  - `STANDALONE_BUILD.md` — exact steps to package a downloadable web/APK/desktop build
- Game images: `artifacts/mockup-sandbox/public/images/` (referenced as `/__mockup/images/...`)
- Play it at preview path `/preview/walk-demo/GameLauncher`

## Architecture decisions

- **Sprite sheet clipping** — `sheetBgStyle(SpriteSheet)` returns `background-size/position` as percentages. Formula: `bsX=(sheetW/frameW)*100%`, `bpX = x/(sheetW-frameW)*100%` (0% if single column). Works at any responsive container size. Party/storage icons use a different approach (explicit pixel scale via `Math.min(size/w, size/h)`) to preserve the frame's native aspect ratio inside a fixed-px box.
- **Encounter zones** — both Route 1 and Area 3 share the same `activeDisturbances` + hotspot tick machinery. On scene entry the state is cleared; `pickMonForScene(rarity, scene)` selects from the scene-appropriate bestiary. The render block uses an IIFE (`(() => { const hs = …; return <>…</>; })()`) to bind a local `hs` variable inside JSX.
- **Starter split** — 8 starters split across two encounter zones: cerepup/shockit in Route 1 (forest/fire/storm feel), cunbubble/pebble/foxin/burg in Area 3 (oceanic/earthbound/spirit/frost — ruins vibes). Route 1 starters use standalone `wildImg`/`playerImg`; Area 3 native mons use sprite sheet frames.
- **Save key** — `primeria_v2` (localStorage). `PartySave.moves` stores active move IDs (max 4); migrated by `sanitizeActiveMoves` on load.
- **Battle XP math** — shared via `calcBattleXp(rawXp, xpMult, baseLevel, baseXp, baseMoves)` inner function (renders fresh closure per call). `handleBattleEnd` handles wild; `handleTrainerEnd` handles trainer. Both call `checkWyvForms()` and `checkStarterEvo()` helpers post-XP.
- **Trainer battles** — trainerEncounter state `{ trainer:"jay"|"lia", name, team, levels }` is set in the "Battle!" dialog button handler; scene transitions to "battle"; the trainer-battle render block checks `scene==="battle" && trainerEncounter` (checked before wild battle block). `handleTrainerEnd` caps jayA3Wins/liaA3Wins at 3 (tier ceiling).
- **Wyvrunt loyalty** — wyrLoyalty: 0–100. Gains: +3 trainer win / +3 wild ko-win / +2 catch / +5 quest (manual). Form 0→1 at lv16, 1→2 at lv30, 2→3 at loyalty≥80. checkWyvForms() reads wyvruntForm from closure (stale-safe since it's in the same render as the battle callbacks).
- **Evo level gates** — EVO_TABLE uses `atLevel:16` for tier-1 evolutions (previously 14). checkStarterEvo checks `[16, 30]`.
- **Jerbs trigger** — fires when `worldPos.x < 215` in area3 while phase==="walk" and `!cleminusMetRef.current`. Locks player at x=215, sets `portalOpen=true`, phase→`jerbs_appear`. After the intro dialogue Next click: `portalOpen=false`, `cleminusMet=true`, chain continues. On return (cleminusMet=true), nearJerbs check (dist<110) shows interact button: "?" if !beatBoth, "!" if beatBoth && !demoComplete, "…" if demoComplete.
- **Jerbs ambient** — `jerbs_a3_idle` handled by the ambient chat box (speaker `{name:"JERBS", color:"#e8b840"}`). `showCardIndex` state available for future card-by-card reveal (currently unused; both cards shown simultaneously).

## Product

Primeria is a browser-native monster-tamer RPG where you explore ruins, bond with Tayanari creatures, evolve them through loyalty and battle, and challenge rival Keepers in progressive trainer battles.

## User preferences

- Always run `remove_image_background_tool` on every character/NPC sprite before using it in the game — all directions (front, back, side/profile). Sprites from AI generators have gradient backgrounds that break transparency tricks. Proper transparent PNGs are the only reliable fix.

## Save button
- 💾 SAVE button sits in the D-pad bar next to 🎒 Bag. Calls `persistWorldRef.current()` (force-flushes position + all quest flags). Party state auto-saves via its own useEffect on every stat/level/xp/party change — the button just gives player-visible confirmation.
- `justSaved` state flips to `true` for 1.6 s, turning the button green with a ✓ / "SAVED" label. Transitions back to 💾 / "SAVE" automatically.

## Audio

- `audioManager.ts` — singleton module (survives re-renders): `playTrack(src, vol)` crossfades looping BGM; `playJingle(src, vol)` ducks BGM, plays once, resumes; `stopAll()` fades everything out.
- **Track map**: overworld/home/lab/npc scenes → `primeria_town.mp3`; route1/route2/area3 → `primeria_route.mp3`; battle scene → `primeria_battle.mp3`. Title/menu → `primeria_title.mp3` (starts on first title-screen tap in GameLauncher).
- **Jingles**: catch → `primeria_catch.mp3`; KO win + trainer win → `primeria_victory.mp3`.
- Audio files live in `public/audio/` in both artifacts (served as `/__mockup/audio/` in mockup-sandbox, `./audio/` in primeria).
- Browser autoplay: music starts on first user gesture (title screen click). Calls before that fail silently and clear bgSrc so the next call retries.
- **Sync note**: audioManager.ts is copied verbatim (no path replacement needed). WalkDemo/GameLauncher sed command: `'s|/__mockup/images/|./images/|g; s|/__mockup/audio/|./audio/|g'`.
- **⚠️ primeria runtime path**: `artifacts/primeria/src/main.tsx → App.tsx → ./game/GameLauncher` — the LIVE primeria runtime is `artifacts/primeria/src/game/*`. Always sync canonical code to `artifacts/primeria/src/game/<file>` (NOT `src/` root). A stale orphaned duplicate set of game files (GameLauncher/WalkDemo/BattleScene/battleFx/EvoScene/moves/progression/save/audioManager) previously lived in `src/` root and was removed — do not recreate them. Note: the primeria runtime char_reveal has diverged from the canonical mockup version (it uses the small `activeChar.sprite` pixel sprite, not `hdImg`/`hero-art.png`), so a blind sed-sync would overwrite that divergence — review before resyncing GameLauncher/WalkDemo.
- **Shared assets**: `public/images/` and `public/audio/` are per-artifact copies; image/audio fixes must be written to BOTH `artifacts/mockup-sandbox/public/` and `artifacts/primeria/public/`, then bump `artifacts/primeria/public/sw.js` CACHE_VERSION + ASSET_CACHE so the service worker refetches.

## Gotchas

- Sprite images from AI generators have warm gradient backgrounds, NOT black. BFS/threshold pixel tricks do not reliably work. Always pre-process sprites with background removal first.
- After background removal, `drawSprite` just calls `ctx.drawImage` — no pixel manipulation needed.
- `calcBattleXp`, `applyLevelUp`, `checkWyvForms`, `checkStarterEvo` are plain inner functions (not useCallback) — they close over current render values and must be called from within the same render-cycle callback (handleBattleEnd / handleTrainerEnd).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
