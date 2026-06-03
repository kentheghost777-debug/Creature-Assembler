---
name: Story deepening plan — full NPC/intro overhaul
description: Planned narrative improvements discussed and approved; awaiting implementation after doorway session. DO NOT implement piecemeal — do all at once.
---

# Story Deepening Plan (approved, not yet implemented)

All changes must be applied to BOTH WalkDemo files (mockup + primeria) in sync.

---

## 1. Character-aware home spawn + partner NPC placement

- **Bug to fix**: `partnerId` is always `"jess"` if character is not jess, else `"kinju"`. When playing Jess, partner is Kinju — but `kinjuAtHome` flag only triggers for Rowan. Kinju needs to render correctly in the home for Jess runs too.
- **Auto-fire first-spawn dialogue**: On very first game start (new flag `firstHomeGreeting` defaulting false, stored in WorldSave), partner NPC speaks automatically — no "!" needed. One beat after spawn, partner says something like "You're finally up. Irwyn's been at the lab since before sunrise." Sets quest direction without UI chip alone.
- **Dialogue must be character-aware**: What the partner says varies by which character the player picked (Kinju/Jess/Rowan) and fits their established relationship.
- **Walk cycle note**: Kinju, Jess, Rowan all have walk cycles (jess uses `dirFrames("jess", 5)` — only 5 side frames). Maya, Lia, Ellio do NOT have walk cycles — any movement for them must use their single idle/front sprite only (subtle bob/sway CSS, no frame animation).

## 2. NPC jump/reaction animation on room entry

- When player enters Jay's house, Ellio's house, Lia's house, or approaches Maya — NPC does a brief reaction animation fitting their character before the "!" appears.
- Jay: quick confident head-raise / little bounce (he was ready, knew you were coming)
- Ellio: slight jump of surprise then settles into merchant composure
- Lia: Draco stirs first, then Lia turns — she's unbothered but Draco reacts
- Maya (overworld doorway): a small wave or lean-forward as player approaches
- Implementation: CSS keyframe (`npcReact`) triggered once on proximity entry via a `reactedNPC` flag per scene. Simple translateY bounce, ~300ms, once only.

## 3. NPC cross-reference dialogue (village feels like a community)

- **Farm + overworld = same town** — NPCs reference Old Hollis and the farm as part of their community ("Old Hollis was up at the market this morning, talking about you")
- **Tayanari under Irwyn's guidance** — the wild area isn't just "wild." Irwyn has worked to understand/manage it. NPCs reference this: "The professor's been out on the eastern path most mornings — says the Tayanari are restless but not dangerous yet"
- **One cross-reference per NPC** (weave naturally into existing dialogue, not forced):
  - Maya → references Jay or Ellio knowing each other
  - Jay → mentions Lia taught him something ("Lia's the one who told me about rune slots first")
  - Ellio → references Old Hollis ("Hollis trades with half our suppliers — salt and grain and creature feed")
  - Lia → references Prof. Irwyn ("Irwyn's been watching the eastern edge more carefully this season. He doesn't say why.")
  - Old Hollis → references the village warmly ("whole town's been buzzing since Irwyn announced the Trial selection")

## 4. Starter-pick moment: creature reacts first

- One extra Irwyn line in the lab BEFORE handing over the starter.
- After player picks their Tayanari: "Interesting. It moved toward you before I called it. That doesn't happen often. The bond has already begun."
- Don't over-explain — one line only, keeps pace tight.
- NOTE: User also wants to discuss the pre-game Prof intro (GameLauncher) to reduce "Pokemon feel" without losing what works. HOLD that discussion separately — don't touch GameLauncher intro yet.

## 5. Jess path intercept: Wyvrunt seed

- In `jess_path_d1` or `jess_path_d2`, add one casual mention of the Wyvrunt:
- Something like: "Old Hollis mentioned something strange this morning — said he spotted a Wyvrunt half-frozen by his east fence. Never seen one that far into town territory. Just... be aware."
- Wyvrunt name lands in casual conversation before player ever encounters it on Route 2 — payoff feels earned when they see it.

## 6. Maya's shells — rug correction

- **Current (wrong)**: Maya's d4 says shells are "in a table by the window" (or similar). Pickup zone `MAYA_SHELL` is already on the rug (rect `[385,400,455,460]`).
- **Fix dialogue**: Maya should say she dropped them inside when she came in, meant to hand them to you at the door, but they're on the rug now — "Go inside and grab them off the rug." The background of her story (father's legacy) stays intact, just corrects the spatial mismatch. Her asking you to go in and pick them up also adds a small beat of physical agency for the player.

---

## 7. FUTURE (hold — costly, needs sprites + planning)

**Ambient village NPCs + lore flavor** (do NOT implement until after doorway session + further discussion):

### World lore to weave in:
- Primeria is a **Leaf Tribe with tech vibe** — first game is "back in history, not the beginning"
- A **Monolith** exists but is NOT mentioned yet by name. Its chaos energy is making Tayanari act differently — not bad, but getting stranger, slowly worsening. Nobody knows why.
- The player as the chosen for the **Elder Trial** has the responsibility to investigate/fix this — flavored to their role (Keeper, Merchant path, etc.)
- Two other roles besides Keeper need NPC counterparts with role-specific dialogue

### NPC dialogue should branch on:
- Which character (Kinju/Jess/Rowan) was chosen
- Which starter was chosen (creature type changes how NPCs react — elemental flavor)
- Which role (Keeper/Merchant/Scholar or equivalent) — Ellio's path = Merchant, Rowan's = Scholar/Researcher

### Placement rules when building:
- 2–3 ambient townspeople max to start (cost-aware)
- Maybe 1–2 "trusted Tayanari" visible in the village (bonded ones, calm, fitting the leaf-tech aesthetic)
- No mention of the Monolith — only hints: "restless," "acting different," "Irwyn's been watchful"
- Do not place in a way that requires new walk cycles unless sprites already exist

---

## Implementation order (when ready):
1. Fix partner NPC home placement (Kinju for Jess-run)
2. First-spawn auto-dialogue (partner greets player)
3. Maya dialogue + rug correction
4. Jess path intercept Wyvrunt seed
5. Starter reacts first (one Irwyn line)
6. NPC cross-references (4 dialogue edits)
7. NPC entry reaction animations (CSS, no new assets)
8. [Later] Ambient townspeople + role/starter-aware dialogue
