# Primeria systems implementation — 2026-10-03

Branch: `primeria/recovery-and-september-updates`. Based on the structured Creature-Assembler catalog/refactor branch. This supplements `PRIMERIA_RECOVERY.md` and records implemented behavior, verification, and remaining canon work. Image files and asset placement are excluded from this pass.

## Sources and conflict decisions

Recovered September 15–17 user discussions, `Master_Project_Canon_2026-09-17.txt`, and `Battle_System_Architecture_2026-09-17.txt` were compared with the live code. The explicit September 15 four-role decision takes precedence over conflicting older class lists. A description in an assistant proposal is not treated as a finalized numerical rule.

Confirmed: Keeper, Hopeful, Wanderer, Herbalist; six Tayanari moves and eventually six Keeper spells; separate Keeper, Tayanari and Resonance progression; one active Tayanari; Keeper and Tayanari actions in either order; bonus Resonance tied to the original starter; Prime consumes both normal actions; separate persistent Loyalty/Chaos histories; 100 unlocks a choice rather than forcing a change; normal combat is bond-neutral; in-battle revival rewards Loyalty, ending fainted adds Chaos; book/Satchel/Guide Soul separation; custom Hearth & Kin connections; physical Guide Stones; five camp tiers that expand activities/space; elemental-shell crafting and noncraftable Balance vessels.

## Working behavior

| Area | Implemented behavior |
| --- | --- |
| Chronicle presentation | Page-turn animation and leather/parchment frame for launch menu, character selection and intro; chapter/dialogue transitions and journal pages replay it. Reduced-motion preference is respected. |
| Three objects | Book opens Chronicles, field guide/Dex, map and licenses; Satchel opens bag, shells and equipment; Guide Soul opens companion/storage and mastery controls. Save remains available from the Book and field controls. |
| Custom path | Saved name and Jay/Lia/Ellio/Maya/Professor Irwyn connection; family-dependent starting home, introductory/NPC dialogue and Chronicle identity. Existing Kinju art serves as a temporary custom-character visual. |
| Roles | Keeper bond XP/offense/shell-finding; Hopeful capture/speed/rarity benefit; Wanderer 10% discount/defense/speed; Herbalist stronger field berries and extra harvest. |
| Battle rounds | Independent Keeper/Tayanari normal actions in either order, explicit Keeper pass, free pre-action switch, no extra normal action from Resonance. Failed escape immediately gives the opponent the round. |
| Keeper spells | Offensive, defensive/debuff and support spells; MP, loadout editing, six-slot limit, revival and PP restoration. Opposing Keepers also spend MP on support/ward/offensive-channel actions. |
| Prime | A compatible equipped elemental damage move fuses with Keeper magic; spends MP and both normal actions. |
| Mastery | Keeper XP and Guide Stone tier gates; Tayanari 3/5/7 branch distribution (1/1/1, 2/1/2, 3/1/3); separate Resonance XP with Attack/Support/Control nodes. Force/Guard/Flow choices affect combat stats. |
| Advanced Resonance | Support heals living companions; Control debuffs; unlocked Bench/Chain allies appear sequentially and deal individual hits. Loyalty protection and Chaos debuffs are higher-order unlocks. |
| Bonds | Per-instance identity, independent meters, care cooldown/diminishing returns, feeding cost, revival/ending-fainted events, explicit threshold/path choice. Matching/mismatched shells establish different initial histories. Both histories survive party moves and evolution. |
| Shells | Fresh elemental vessels crafted from a natural shell plus essence with a Keeper rune available; saved inventory, battle vessel selector, matching/mismatch/quality/HP/will/failure-resistance capture modifiers. Successful crafting/capture consumes the appropriate resources; failed crafted capture keeps its vessel. No Balance crafting. |
| Equipment | Headband/chest/belt/wristbands/gloves/feet/ring/amulet plus existing pack utility. Gear XP, defense, catch and Resonance bonuses are connected to runtime. Wristband rune sockets affect Keeper spells/Resonance. |
| Camp | Five progressively expanded camp areas, selected-companion care, shelter/supplies/worktable/hearth/party spaces; field-only camp setup and day/night choice, night tint, hearth journal activity. Jerbs' Realm remains separate. |
| Persistence | Old saves gain default systems; party/world/role writes preserve new state. Three slots isolate progression and equipment/inventory. Full lead specification, shell/runes and instance identity survive promotion and resuming. |
| Progression | Creature and Keeper levels support 150; the old 25/30 creature hard caps are removed. Existing species signatures and evolution definitions remain. |
| Escape | Active companion recalls into its actual bonded vessel; Keeper turns once and carries it away. Works across party members. |

## Explicit demo tuning, not finalized canon

`journeySystems.ts` centralizes initial costs/progression/capture/care values. Spell names and small generic effects, Guide Stone reward milestones, points, camp expansion gates, Prime damage/cost, accessory prices/effects, shell essence rewards and the incomplete capture equation are implementation defaults. They must not be cited as decisions Kenneth made. Four Guide Stone awards currently exercise the five demo tiers; the total lore count is undecided.

The path-selection charge resets after use to require new treatment before switching back; unlocked history stays saved. This is a provisional transition rule, not a recovered exact rule. Generic Loyalty/Chaos branch effects are functional, but do not substitute for authored species-specific special evolution designs.

## Remaining canon/content work

This is a substantial working systems pass, **not a claim that every discussed world/story system is finished**. Still requires authored design and implementation: species-specific Loyalty/Chaos evolution forms and hidden stones; Prismatic Wyvrunt/Two Truths and its final Devoid story guarantee; complete Astraga/Divine/Devoid narrative; the full advanced Chaos network targeting/locks/forced-swaps and Loyalty cleanse combinations; all final Bench capacities/tutorials/costs; full camp crafting/training activities; family photograph content; final damage/rarity economy and exact capture status/family/help modifiers. The current shell quality table is data-ready, but the new crafting route produces Fresh vessels; other quality acquisition routes still use the legacy content.

These omissions are tracked explicitly because the recovered notes do not supply complete playable scenes, species definitions or final rules for them. No missing rule is silently represented as locked canon or a completed feature.

## Validation and reproduction

- Application TypeScript check.
- 17 Node tests cover move migration, catalog/evolution indexing, independent bonds, care cooldown, threshold choices, Guide gating, capture modifiers, crafting, malformed optional state, slot isolation and legacy saves.
- Production Vite build. The existing large main-bundle warning remains nonfatal.
- Playwright tests cover custom name/family/book flow, Tayanari-first and Keeper-first rounds, Keeper spells, Prime, bonus Support Resonance and separate XP, reserve chain appearances, Keeper capture/flee prohibitions, forced replacement/revival/Loyalty, no Chaos after revival, failed-flee consumption, actual-shell recall, crafted capture/depletion and browser exceptions.

```sh
npm ci
npm run typecheck --workspace artifacts/mockup-sandbox
npm run test --workspace artifacts/mockup-sandbox
npm run build
npx playwright install chromium
npm run verify:browser
```

`verify:browser` starts and stops its own dev server on port 3000. Optional `CHROMIUM_EXECUTABLE` and JSON `CHROMIUM_ARGS` allow an existing Chromium installation. It uses a local fixture for repeatable combat edge cases and checks the real launcher/custom-save flow. Browser checks do not assert that excluded image placements or every late story scene are correct.

## Google handoff

Import this branch into the linked editing environment, retain its package lock and run the commands above. Keep both recovery/implementation documents with the code. Review the remaining-canon section before interpreting a working demo default as a finalized design. No Google connection or deployment has been performed by this change.
