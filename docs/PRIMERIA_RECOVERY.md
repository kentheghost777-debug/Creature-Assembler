# Primeria recovery and September integration

## Verified source

Inventory checked October 2, 2026 across the eight repositories accessible to `kentheghost777-debug`, including all discovered branches.

| Repository / branch | Finding |
| --- | --- |
| Creature-Assembler / refactor/tayanari-system | Most advanced structured source found. Four catalog commits ahead of main; head df3bc451877f5ecde2a413c40994345c56c5c3d0, September 2. |
| Creature-Assembler / main | Full app and assets. September 1 commit explicitly identifies Operation Moving Duck as the working project. |
| Creature-Assembler / fix/primeria-safe-polish | Three documentation commits; asset-quality notes remain relevant. |
| primeria-Monolith / main | June upload with flattened source paths; battle and launcher files are smaller than the structured app. |
| primeria-Monolith / recovery/primeria-complete-jerbs | One commit behind its main branch. |
| Final-primeria / main | README only. |
| primeria-sept-2026 / main | README only, despite its newer repository name/date. |
| attached_assets / main; more-assets / main | Separate asset collections. |
| serverclientshared / main | Separate June upload; not a complete structured Primeria app. |
| purestoryai / main | Separate product. |

This identifies the newest usable source found in the connected account, not proof that an unsynced September Google/Replit build survives elsewhere.

Working branch: `primeria/recovery-and-september-updates`, based on the catalog refactor. Main and existing branches are preserved.

## Implemented

- Repair battle helper components that referenced developer state and event handlers outside their scope; retain one developer HUD in the owning battle component.
- Repair player sprite source/filter/border errors and carry starter sprite-sheet data into battle.
- Repair the overworld ground-item/respawn drag tool using pointer capture, map zoom and local drag state.
- Install the missing TypeScript compiler, configure the module resolver, and align the workspace Drizzle CLI with its config API. Dependency declaration files are skipped; application code remains checked.
- Allow six equipped Tayanari moves through the move manager, save sanitization, level rewards and battle loadouts. Existing four-move choices retain order.
- Display Shells, Berries, Heal, Runes, Resonance and Flee commands. Capture remains under Shells.
- Existing Keeper utility actions (heal, rune, berry, shell) leave the Tayanari action available and share a once-per-round action allowance. The opponent responds after the Tayanari action. Failed escape still triggers an opponent action. Resonance remains a separate bonus action.
- Tie initial Resonance to the original starter choice; switching party members neither changes that element nor discards stored Resonance. Existing resonance-fill rune behavior remains.
- Place Tayanari status plates under their field positions, add participant portraits, and show the opposing Keeper only in Keeper battles.
- Correct capture text to Weathered Shell instead of conflating it with the Realm Shell.

## Current design authority

Read references: `Master_Project_Canon_2026-09-17.txt` (528 lines), `Battle_System_Architecture_2026-09-17.txt` (166 lines), and September 26 battle UI decisions in the supplied conversation context. New explicit decisions supersede legacy text/code.

The preserved direction is one active Tayanari per side; one Keeper action plus one Tayanari action; separate Resonance; six spells/moves; full healing after battle; Party distinct from later Bench; Prime distinct from Resonance; separate Loyalty and Chaos histories; Prismatic Wyvrunt requires both histories and gains Ancient Language. Spivaro grow/shed shells; carved runes make elemental habitats. Jerbs' Realm Shell opens a place and is not a capture shell.

## Remaining integration

This recovery patch is not the complete September game expansion. The source predates several confirmed decisions:

- Keeper spell loadout/progression, Keeper health/damage model, complete enemy Keeper actions, and final battle HUD artwork.
- Create Your Own character and persistent custom sprite-sheet selection.
- Revised named starter/evolution lines and new September creature assets; stable IDs must be migrated carefully before renaming existing catalog entries.
- Spivaro husbandry, shell crafting/habitats, updated capture mathematics and sustainable shell economy.
- Independent Loyalty/Chaos histories and advanced state transitions.
- Resonance mastery/tree, Bench unlock/tutorial/assists, Prime and Ancient Language.
- Wyvrunt story checkpoints, Astraga/Astraevus/Devoid lore updates and expanded story content.
- Integrate and validate transparent battle HUD/FX/elemental encounter atlases and the new creature art.
- Resolve missing assets and offline packaging. The existing standalone guide describes an older five-file layout and old save key.

The canon explicitly leaves Prime costs/effects, Bench capacity/unlocks/combos, advanced-state thresholds, ordinary final combat formulas, several capture modifiers, and the final class roster unresolved. Existing gameplay values are retained for the recovered demo; they must not be promoted to finalized canon. Keeper HP bars cannot be implemented honestly until a health model exists.

## Validation

Run from repository root:

```sh
npm ci
npm run typecheck --workspace=@workspace/mockup-sandbox
npm run test --workspace=@workspace/mockup-sandbox
npm run build
npm run dev
```

Node 24 was used. Seven pure-data regression tests cover catalog invariants and six-move/legacy-save behavior. Browser smoke checks and limitations are recorded in the pull request.

Browser validation passed on the actual dev server using headless Chromium: title to New Game menu; mounted wild battle; Thornberry then Tayanari action; next-round Keeper allowance reset; starter-attuned bonus Resonance; opposing Keeper identity and disabled capture/flee commands. No JavaScript page errors occurred in these checks. Desktop battle rendering was visually inspected. These fixture checks do not prove a full story playthrough, mobile layout, all assets, cloud APIs, or offline packaging.
