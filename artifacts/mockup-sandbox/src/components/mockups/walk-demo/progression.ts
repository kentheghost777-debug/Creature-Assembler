// ═══════════════════════════════════════════════════════════════════════════
//  PRIMERIA — PROGRESSION SYSTEM SCAFFOLD
// ═══════════════════════════════════════════════════════════════════════════
//  Per the bible, evolution is NOT triggered by level alone. It is the long-
//  term outcome of how a Tayanari is raised — driven by:
//    1. SHELL          (passive, long-term influence — affinity, growth bias,
//                       alignment drift, second-typing potential)
//    2. RUNES          (active customization socketed into the shell,
//                       including the Evolution/Destiny rune family)
//    3. SIGILS         (permanent earned imprints — Experience, Emotional,
//                       Trial, Monolith, Destiny)
//    4. ALIGNMENT      (-100 Chaos … +100 Loyalty score accumulated through
//                       play style)
//
//  After Form 3 the path branches by alignment:
//    CHAOS  → Chaos Form → one major Sigil Awakening
//    LOYALTY → Loyalty Form → 4th Destiny Evo → optional 5th Resonance Evo
// ═══════════════════════════════════════════════════════════════════════════

// ── Elements (Tayanari typings) ────────────────────────────────────────────
export type Element =
  | "Nature"      | "Volcanic"   | "Oceanic"    | "Frostformed"
  | "Stormproven" | "Earthbound" | "Skyborne"   | "Spirit"
  | "Mind"        | "Alchemy"    | "Abyss"      | "Armored"
  | "Chaos"       | "Radiant";

export const ELEMENT_COLOR: Record<Element, string> = {
  Nature:      "#5ac070",
  Volcanic:    "#ff6020",
  Oceanic:     "#3a90ff",
  Frostformed: "#7ddeff",
  Stormproven: "#ffd040",
  Earthbound:  "#c89060",
  Skyborne:    "#a8d8ff",
  Spirit:      "#b890e0",
  Mind:        "#c080ff",
  Alchemy:     "#90c060",
  Abyss:       "#604080",
  Armored:     "#909098",
  Chaos:       "#9b4dff",
  Radiant:     "#fff176",
};

// ── Shells ─────────────────────────────────────────────────────────────────
export type ShellTier = "basic" | "advanced" | "awakened";

// Literal-union IDs declared up-front (no string typos at use sites).
export type ShellId =
  | "spira_leaflet" | "thornspire" | "coralcrest" | "dunespire" | "tidecaller" | "sungem"
  | "stonecoil"     | "pearlbreath"| "meadowmoll" | "emberconch"| "frostwhorl" | "zephyrwing"
  | "mossguard"     | "voltcoil"   | "quillspire" | "obsidianeye"|"verdanturn" | "aetherspire";

export type ShellTag =
  | "verdant_loyal" | "thorned_warrior" | "reef_chorus"   | "wandering_dune" | "lunar_tide"
  | "radiant_solar" | "stone_guardian"  | "purity_spirit" | "abundant_bloom" | "ember_forged"
  | "glacial_edge"  | "swift_aether"    | "root_warden"   | "voltaic_wild"   | "quill_scholar"
  | "obsidian_seer" | "renewal_cycle"   | "aether_chosen";

export type Shell = {
  id: ShellId;
  name: string;
  flavor: string;
  tier: ShellTier;
  runeSlots: 1 | 2 | 3;
  primary: Element;
  secondary?: Element;
  alignmentLean: number;
  statGrowthBias: Partial<Record<"hp"|"atk"|"def"|"spd", number>>;
  xpMod: number;
  evolutionTag: ShellTag;
  notes?: string;
};

export const SHELLS: readonly Shell[] = [
  // ───── Row 1 ─────
  { id: "spira_leaflet",  name: "Spira Leaflet",  flavor: "Whispers of growth and gentle loyalty.",
    tier:"basic", runeSlots:1, primary:"Nature",
    alignmentLean:+2, statGrowthBias:{ hp:+2, def:+1 }, xpMod:1.00,
    evolutionTag:"verdant_loyal", notes:"Gentle starter shell; quietly nudges toward Loyalty." },

  { id: "thornspire",     name: "Thornspire",     flavor: "Built of courage, shaped by trials.",
    tier:"basic", runeSlots:1, primary:"Armored", secondary:"Volcanic",
    alignmentLean:-1, statGrowthBias:{ atk:+2 }, xpMod:1.00,
    evolutionTag:"thorned_warrior", notes:"Combat-forward; rewards aggression." },

  { id: "coralcrest",     name: "Coralcrest",     flavor: "Echoes of the reef, memory of community.",
    tier:"advanced", runeSlots:2, primary:"Oceanic", secondary:"Spirit",
    alignmentLean:+2, statGrowthBias:{ hp:+1, spd:+1 }, xpMod:1.05,
    evolutionTag:"reef_chorus", notes:"Stabilising resonance; encourages support roles." },

  { id: "dunespire",      name: "Dunespire",      flavor: "Carried on winds, forged in deserts.",
    tier:"basic", runeSlots:1, primary:"Earthbound", secondary:"Skyborne",
    alignmentLean:0, statGrowthBias:{ def:+1, spd:+1 }, xpMod:1.00,
    evolutionTag:"wandering_dune", notes:"Neutral-balanced; suits long journeys." },

  { id: "tidecaller",     name: "Tidecaller",     flavor: "Draws the rhythm of ocean and moon.",
    tier:"advanced", runeSlots:2, primary:"Oceanic", secondary:"Spirit",
    alignmentLean:+1, statGrowthBias:{ atk:+1, spd:+1 }, xpMod:1.05,
    evolutionTag:"lunar_tide", notes:"Tidal cycles — bonus on full-moon overworld nights." },

  { id: "sungem",         name: "Sungem",         flavor: "Holds the light of ancient days.",
    tier:"advanced", runeSlots:2, primary:"Skyborne", secondary:"Spirit",
    alignmentLean:+3, statGrowthBias:{ hp:+2, atk:+1 }, xpMod:1.10,
    evolutionTag:"radiant_solar", notes:"Strong Loyalty pull; light-aligned destinies." },

  // ───── Row 2 ─────
  { id: "stonecoil",      name: "Stonecoil",      flavor: "Stillness and endurance harden the soul.",
    tier:"basic", runeSlots:1, primary:"Earthbound", secondary:"Armored",
    alignmentLean:+1, statGrowthBias:{ hp:+2, def:+2 }, xpMod:0.95,
    evolutionTag:"stone_guardian", notes:"Defensive bedrock; slow but very durable growth." },

  { id: "pearlbreath",    name: "Pearlbreath",    flavor: "Pure of heart, clear of purpose.",
    tier:"basic", runeSlots:1, primary:"Spirit",
    alignmentLean:+3, statGrowthBias:{ hp:+1, def:+1 }, xpMod:1.00,
    evolutionTag:"purity_spirit", notes:"Cleansing resonance — strong Loyalty drift." },

  { id: "meadowmoll",     name: "Meadowmoll",     flavor: "Blessed by fields, alive with abundance.",
    tier:"advanced", runeSlots:2, primary:"Nature", secondary:"Spirit",
    alignmentLean:+2, statGrowthBias:{ hp:+2, def:+1 }, xpMod:1.10,
    evolutionTag:"abundant_bloom", notes:"Flora-blessed; passive recovery between battles." },

  { id: "emberconch",     name: "Emberconch",     flavor: "Born of heat, tempered in fire.",
    tier:"advanced", runeSlots:2, primary:"Volcanic", secondary:"Armored",
    alignmentLean:-2, statGrowthBias:{ atk:+3 }, xpMod:1.05,
    evolutionTag:"ember_forged", notes:"High raw power — drifts toward Chaos." },

  { id: "frostwhorl",     name: "Frostwhorl",     flavor: "Chilled resolve, silent and sharp.",
    tier:"basic", runeSlots:1, primary:"Frostformed",
    alignmentLean:0, statGrowthBias:{ atk:+1, spd:+1 }, xpMod:1.00,
    evolutionTag:"glacial_edge", notes:"Cool, precise; neutral alignment." },

  { id: "zephyrwing",     name: "Zephyrwing",     flavor: "Light as wind, swift as thought.",
    tier:"advanced", runeSlots:2, primary:"Skyborne", secondary:"Mind",
    alignmentLean:0, statGrowthBias:{ spd:+3, atk:+1 }, xpMod:1.05,
    evolutionTag:"swift_aether", notes:"Speed-focused growth; favours aerial evolutions." },

  // ───── Row 3 ─────
  { id: "mossguard",      name: "Mossguard",      flavor: "Ancient and steady, guardian of roots.",
    tier:"advanced", runeSlots:2, primary:"Nature", secondary:"Earthbound",
    alignmentLean:+2, statGrowthBias:{ hp:+3, def:+2 }, xpMod:0.95,
    evolutionTag:"root_warden", notes:"Tank-leaning Nature; guardian destinies." },

  { id: "voltcoil",       name: "Voltcoil",       flavor: "Crackling potential, untamed energy.",
    tier:"advanced", runeSlots:2, primary:"Stormproven",
    alignmentLean:-2, statGrowthBias:{ atk:+2, spd:+2 }, xpMod:1.10,
    evolutionTag:"voltaic_wild", notes:"Untamed energy; pulls toward Chaos." },

  { id: "quillspire",     name: "Quillspire",     flavor: "Pricks of wisdom, jackets of thought.",
    tier:"basic", runeSlots:1, primary:"Armored", secondary:"Mind",
    alignmentLean:+1, statGrowthBias:{ def:+2, spd:+1 }, xpMod:1.00,
    evolutionTag:"quill_scholar", notes:"Defensive + cerebral; unusual hybrid path." },

  { id: "obsidianeye",    name: "Obsidianeye",    flavor: "Sees what others cannot perceive.",
    tier:"advanced", runeSlots:2, primary:"Abyss", secondary:"Mind",
    alignmentLean:-1, statGrowthBias:{ atk:+1, spd:+2 }, xpMod:1.10,
    evolutionTag:"obsidian_seer", notes:"Hidden vision — unlocks rare Abyss evolutions." },

  { id: "verdanturn",     name: "Verdanturn",     flavor: "Cycles of renewal, ever turning.",
    tier:"advanced", runeSlots:2, primary:"Nature", secondary:"Spirit",
    alignmentLean:+2, statGrowthBias:{ hp:+2, spd:+1 }, xpMod:1.05,
    evolutionTag:"renewal_cycle", notes:"Cyclic recovery; faint Spirit drift." },

  { id: "aetherspire",    name: "Aetherspire",    flavor: "Touched by the sky, blessed by the unknown.",
    tier:"awakened", runeSlots:3, primary:"Spirit", secondary:"Skyborne",
    alignmentLean:+1, statGrowthBias:{ hp:+2, atk:+2, def:+1, spd:+2 }, xpMod:1.20,
    evolutionTag:"aether_chosen", notes:"Mythic shell — opens Destiny Catalyst paths." },
];

export const SHELLS_BY_ID: Readonly<Record<ShellId, Shell>> =
  Object.fromEntries(SHELLS.map(s => [s.id, s])) as Record<ShellId, Shell>;

// ── Alignment ──────────────────────────────────────────────────────────────
export type AlignmentBand = "chaos" | "leaning_chaos" | "neutral" | "leaning_loyalty" | "loyalty";

export function alignmentBand(score: number): AlignmentBand {
  if (score <= -60) return "chaos";
  if (score <= -20) return "leaning_chaos";
  if (score <   20) return "neutral";
  if (score <   60) return "leaning_loyalty";
  return "loyalty";
}

export function clampAlignment(n: number): number {
  return Math.max(-100, Math.min(100, n));
}

// ── Sigils ─────────────────────────────────────────────────────────────────
export type SigilFamily = "experience" | "emotional" | "trial" | "monolith" | "destiny";

export type SigilId =
  | "sig_veteran" | "sig_protector" | "sig_loyal" | "sig_feral"
  | "sig_trialist"| "sig_monolith"  | "sig_destiny";

export type Sigil = {
  id: SigilId;
  family: SigilFamily;
  name: string;
  description: string;
};

export const SIGILS: readonly Sigil[] = [
  { id:"sig_veteran",   family:"experience", name:"Veteran Mark",     description:"Won 10 battles without fainting." },
  { id:"sig_protector", family:"experience", name:"Protector Sigil",  description:"Survived a fatal hit at 1 HP." },
  { id:"sig_loyal",     family:"emotional",  name:"Loyal Bond",       description:"Reached +60 Loyalty alignment." },
  { id:"sig_feral",     family:"emotional",  name:"Feral Edge",       description:"Reached -60 Chaos alignment." },
  { id:"sig_trialist",  family:"trial",      name:"Trialist Mark",    description:"Completed a Keeper Trial." },
  { id:"sig_monolith",  family:"monolith",   name:"Fractured Sigil",  description:"Survived a Monolith Fracture." },
  { id:"sig_destiny",   family:"destiny",    name:"Destiny Catalyst", description:"Unlocks legendary evolution states." },
];

// ── Runes ──────────────────────────────────────────────────────────────────
export type RuneFamily =
  | "combat" | "defense" | "spiritual" | "battleflow" | "economy"
  | "shellSync" | "evolution" | "monolith";

export type RuneId =
  | "rune_path" | "rune_shift" | "rune_catalyst"
  | "rune_ascension" | "rune_destiny" | "rune_fate";

export type Rune = {
  id: RuneId;
  family: RuneFamily;
  name: string;
  tier: "common" | "uncommon" | "rare" | "ancient" | "divine";
  description: string;
  evolutionTendency?: number;
  secondTypingChance?: number;
  enablesAdvancedEvo?: boolean;
  enablesDestinyCatalyst?: boolean;
  alignmentInfluence?: number;
};

export const RUNES: readonly Rune[] = [
  { id:"rune_path",      family:"evolution", name:"Path Rune",     tier:"common",
    description:"Slightly influences evolution tendencies.", evolutionTendency:+1 },
  { id:"rune_shift",     family:"evolution", name:"Shift Rune",    tier:"uncommon",
    description:"Boosts secondary typing resonance chance.", secondTypingChance:0.15 },
  { id:"rune_catalyst",  family:"evolution", name:"Catalyst Rune", tier:"rare",
    description:"Hidden evolution compatibility.", evolutionTendency:+3 },
  { id:"rune_ascension", family:"evolution", name:"Ascension Rune", tier:"ancient",
    description:"Enables advanced resonance evolutions.", enablesAdvancedEvo:true },
  { id:"rune_destiny",   family:"evolution", name:"Destiny Rune",  tier:"divine",
    description:"Interacts with Legendary Sigils; enables Destiny Catalyst states.",
    enablesDestinyCatalyst:true },
  { id:"rune_fate",      family:"spiritual", name:"Fate Rune",     tier:"rare",
    description:"Influences hidden alignment evolutions.", alignmentInfluence:+2 },
];

const RUNES_BY_ID: Readonly<Record<RuneId, Rune>> =
  Object.fromEntries(RUNES.map(r => [r.id, r])) as Record<RuneId, Rune>;

// ── Party member runtime state ─────────────────────────────────────────────
export type PartyMember = {
  speciesId: string;              // links to Species form-chain (validated at lookup)
  formIdx: number;                // index into species.forms (0 = Form 1)
  nickname?: string;
  level: number;
  xp: number;
  stats: { hp: number; atk: number; def: number; spd: number };
  moves: string[];
  bondedShellId: ShellId;         // typed: no shell typos
  equippedRuneIds: RuneId[];      // typed: no rune typos
  sigilIds: SigilId[];            // typed: no sigil typos
  alignment: number;              // -100..+100
  secondTypeUnlocked: boolean;    // persists the second-typing resolution
};

// Validator — true iff equippedRuneIds count is within the bonded shell's slots.
export function runesFitShell(p: PartyMember): boolean {
  const shell = SHELLS_BY_ID[p.bondedShellId];
  return p.equippedRuneIds.length <= shell.runeSlots;
}

// ── Species + Form chains ─────────────────────────────────────────────────
export type EvolveGate = {
  minLevel?: number;
  alignmentMin?: number;
  alignmentMax?: number;
  shellTag?: ShellTag;            // typed against catalogued shell tags
  shellTier?: ShellTier;
  requiredSigils?: SigilId[];     // typed against catalogued sigils
  requiredRunes?: RuneId[];       // typed against catalogued runes
  requiresAdvancedEvo?: boolean;
  requiresDestinyCatalyst?: boolean;
  requiresSecondTypeUnlocked?: boolean;
};

export type EvolveBranch = {
  toFormIdx: number;
  gate: EvolveGate;
  /** Higher priority wins when multiple gates pass. Default 0.
   *  Convention: 0 = generic fallback, 10 = Chaos/Loyalty path, 20 = Destiny. */
  priority?: number;
  label?: string;
};

export type FormDef = {
  name: string;
  element: Element;
  /** Secondary type that THIS form starts with. Use `unlockableSecond`
   *  for a type a player can earn via shells/runes/alignment. */
  secondElement?: Element;
  unlockableSecond?: Element;
  branches?: EvolveBranch[];
};

export type Species = {
  id: string;
  baseName: string;
  forms: FormDef[];
};

// Bounds-check every branch in a species at startup.
export function validateSpecies(s: Species): string[] {
  const errs: string[] = [];
  s.forms.forEach((f, i) => {
    f.branches?.forEach((b, bi) => {
      if (b.toFormIdx < 0 || b.toFormIdx >= s.forms.length) {
        errs.push(`${s.id} form[${i}] branch[${bi}]: toFormIdx ${b.toFormIdx} out of range`);
      }
    });
  });
  return errs;
}

// ── Gate evaluation ────────────────────────────────────────────────────────
export function gatePasses(p: PartyMember, gate: EvolveGate): boolean {
  if (gate.minLevel     !== undefined && p.level     < gate.minLevel)     return false;
  if (gate.alignmentMin !== undefined && p.alignment < gate.alignmentMin) return false;
  if (gate.alignmentMax !== undefined && p.alignment > gate.alignmentMax) return false;

  const shell = SHELLS_BY_ID[p.bondedShellId];
  if (gate.shellTag  !== undefined && shell.evolutionTag !== gate.shellTag)  return false;
  if (gate.shellTier !== undefined && shell.tier         !== gate.shellTier) return false;

  if (gate.requiredSigils?.some(id => !p.sigilIds.includes(id)))       return false;
  if (gate.requiredRunes ?.some(id => !p.equippedRuneIds.includes(id))) return false;

  if (gate.requiresSecondTypeUnlocked && !p.secondTypeUnlocked) return false;

  if (gate.requiresAdvancedEvo || gate.requiresDestinyCatalyst) {
    const equipped = p.equippedRuneIds.map(id => RUNES_BY_ID[id]);
    if (gate.requiresAdvancedEvo &&
        !equipped.some(r => r.enablesAdvancedEvo)) return false;
    if (gate.requiresDestinyCatalyst &&
        !equipped.some(r => r.enablesDestinyCatalyst)) return false;
  }
  return true;
}

/**
 * Deterministic branch arbitration:
 *  1. Filter to passing branches.
 *  2. Pick the highest `priority` (default 0).
 *  3. Tie-break by listed order (earlier wins).
 *  Returns null if no branch passes.
 */
export function evolveCheck(
  p: PartyMember,
  species: Species,
): { toFormIdx: number; label?: string } | null {
  const form = species.forms[p.formIdx];
  if (!form?.branches?.length) return null;
  const passing = form.branches
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => gatePasses(p, b.gate));
  if (!passing.length) return null;
  passing.sort((a, z) => {
    const pa = a.b.priority ?? 0, pz = z.b.priority ?? 0;
    if (pz !== pa) return pz - pa;
    return a.i - z.i;
  });
  const winner = passing[0].b;
  return { toFormIdx: winner.toFormIdx, label: winner.label };
}

// ── Second-typing unlock resolution ────────────────────────────────────────
/**
 * Resolves the candidate second type for this party member and the chance
 * of unlocking it. Two-stage logic:
 *
 *  1. CANDIDATE SELECTION
 *     - The form must declare `unlockableSecond` (species permission).
 *     - The bonded shell must resonate with that type — i.e. the shell's
 *       `primary` OR `secondary` element equals `form.unlockableSecond`.
 *     - If neither stage passes, returns { chance: 0 } (no candidate).
 *
 *  2. CHANCE ACCUMULATION (only if a candidate exists)
 *     - Sum of Shift Rune `secondTypingChance` values.
 *     - +0.10 baseline if alignment is strongly polarised (|score| >= 60).
 *     - +0.15 if the shell's secondary directly matches the candidate
 *       (stronger resonance than only the primary matching).
 *     - Destiny Catalyst rune forces guaranteed (chance = 1).
 *     - Clamped to [0, 1].
 *
 * Caller decides whether to roll RNG against `chance` or treat ≥1 as
 * guaranteed. Persist the result to `PartyMember.secondTypeUnlocked`.
 */
export function resolveSecondTyping(
  p: PartyMember,
  species: Species,
): { chance: number; type?: Element } {
  const form = species.forms[p.formIdx];
  const candidate = form?.unlockableSecond;
  if (!candidate) return { chance: 0 };

  const shell = SHELLS_BY_ID[p.bondedShellId];
  const shellMatchesPrimary   = shell.primary   === candidate;
  const shellMatchesSecondary = shell.secondary === candidate;
  if (!shellMatchesPrimary && !shellMatchesSecondary) return { chance: 0 };

  const equipped = p.equippedRuneIds.map(id => RUNES_BY_ID[id]);
  let chance = equipped.reduce((acc, r) => acc + (r.secondTypingChance ?? 0), 0);
  if (Math.abs(p.alignment) >= 60) chance += 0.10;
  if (shellMatchesSecondary)       chance += 0.15;
  if (equipped.some(r => r.enablesDestinyCatalyst)) chance = 1;
  return { chance: Math.max(0, Math.min(1, chance)), type: candidate };
}

// ── Per-level passive shell effects ───────────────────────────────────────
export function applyShellDrift(p: PartyMember): PartyMember {
  const shell = SHELLS_BY_ID[p.bondedShellId];
  const fateBonus = p.equippedRuneIds
    .map(id => RUNES_BY_ID[id])
    .reduce((acc, r) => acc + (r.alignmentInfluence ?? 0), 0);
  return { ...p, alignment: clampAlignment(p.alignment + shell.alignmentLean + fateBonus) };
}

export function applyShellGrowthBias(
  baseGains: Partial<Record<"hp"|"atk"|"def"|"spd", number>>,
  shellId: ShellId,
): Partial<Record<"hp"|"atk"|"def"|"spd", number>> {
  const shell = SHELLS_BY_ID[shellId];
  const out = { ...baseGains };
  for (const k of Object.keys(shell.statGrowthBias) as Array<keyof typeof shell.statGrowthBias>) {
    out[k] = (out[k] ?? 0) + (shell.statGrowthBias[k] ?? 0);
  }
  return out;
}

// ── Prism Stones ──────────────────────────────────────────────────────────────
// Cosmetic items that tint a Tayanari's sprite to a unique shiny hue when
// slotted into a Prism Shell. One slot occupied per stone. No stat effect.

export type PrismStoneId =
  | "prism_ruby"    | "prism_sapphire" | "prism_emerald" | "prism_amber"
  | "prism_amethyst"| "prism_crystal"  | "prism_obsidian"| "prism_rose"
  | "prism_umbra"   | "prism_solaris"  | "prism_neon";

export type PrismStoneItem = {
  id: PrismStoneId;
  name: string;
  color: string;
  hue: number;
  sat: number;
  bri: number;
  sepia: number;
  icon: string;
  desc: string;
  price: number;
  rarity: "rare" | "ultra" | "apex";
  dropChance: number;
};

export const PRISM_STONES: readonly PrismStoneItem[] = [
  { id:"prism_ruby",      name:"Ruby Prism",      icon:"💎", color:"#e03040", rarity:"rare",
    hue:0,   sat:2.4, bri:1.0, sepia:0.8,
    desc:"Crimson-tinted sheen. Burns like embers.",            price:120, dropChance:0.012 },
  { id:"prism_sapphire",  name:"Sapphire Prism",  icon:"🔷", color:"#2060e0", rarity:"rare",
    hue:200, sat:2.2, bri:0.95, sepia:0.6,
    desc:"Deep ocean blue. Cool as midnight tides.",            price:120, dropChance:0.012 },
  { id:"prism_emerald",   name:"Emerald Prism",   icon:"💚", color:"#20b040", rarity:"rare",
    hue:120, sat:2.5, bri:1.0, sepia:0.7,
    desc:"Vivid forest green. Smells faintly of rain.",         price:120, dropChance:0.012 },
  { id:"prism_amber",     name:"Amber Prism",     icon:"🟡", color:"#e09020", rarity:"rare",
    hue:30,  sat:2.2, bri:1.05, sepia:0.75,
    desc:"Warm golden glow. Ancient light trapped in glass.",   price:120, dropChance:0.012 },
  { id:"prism_amethyst",  name:"Amethyst Prism",  icon:"💜", color:"#9040c0", rarity:"rare",
    hue:280, sat:2.0, bri:0.95, sepia:0.65,
    desc:"Violet shimmer. Feels like a held secret.",           price:120, dropChance:0.012 },
  { id:"prism_crystal",   name:"Crystal Prism",   icon:"🔵", color:"#b0e8ff", rarity:"rare",
    hue:185, sat:0.4, bri:1.35, sepia:0.0,
    desc:"Pale icy white. Refracts light into rainbows.",       price:120, dropChance:0.010 },
  { id:"prism_obsidian",  name:"Obsidian Prism",  icon:"⬛", color:"#505060", rarity:"rare",
    hue:240, sat:0.3, bri:0.45, sepia:0.2,
    desc:"Dark as a starless sky. Absorbs light.",              price:120, dropChance:0.010 },
  { id:"prism_rose",      name:"Rose Prism",      icon:"🌸", color:"#e060a0", rarity:"rare",
    hue:330, sat:2.0, bri:1.0, sepia:0.7,
    desc:"Soft pink bloom. Rare as a blossoming Tayanari.",     price:120, dropChance:0.010 },
  { id:"prism_umbra",     name:"Umbra Prism",     icon:"🌑", color:"#3d1a6a", rarity:"ultra",
    hue:270, sat:1.8, bri:0.30, sepia:0.5,
    desc:"Shadow-forged. The mon fades into living dusk.",      price:0,   dropChance:0.004 },
  { id:"prism_solaris",   name:"Solaris Prism",   icon:"☀️",  color:"#ffe080", rarity:"ultra",
    hue:45,  sat:1.2, bri:1.70, sepia:0.3,
    desc:"Holy radiance. The mon blazes like a second sun.",    price:0,   dropChance:0.004 },
  { id:"prism_neon",      name:"Neon Prism",      icon:"⚡", color:"#00ffcc", rarity:"apex",
    hue:165, sat:4.0, bri:1.20, sepia:0.0,
    desc:"Electric neon glow. Impossible to look away from.",   price:0,   dropChance:0.001 },
];

export const PRISM_STONES_BY_ID: Record<PrismStoneId, PrismStoneItem> =
  Object.fromEntries(PRISM_STONES.map(s => [s.id, s])) as Record<PrismStoneId, PrismStoneItem>;

export function prismFilter(stone: PrismStoneItem): string {
  return `sepia(${stone.sepia}) hue-rotate(${stone.hue}deg) saturate(${stone.sat}) brightness(${stone.bri})`;
}

// ── Battle Shells & Runes (Primeria Farm equip system) ───────────────────────

export type BattleShellId =
  | "bshell_moss"   | "bshell_ember"  | "bshell_tide"   | "bshell_storm"
  | "bshell_dusk"   | "bshell_frost"  | "bshell_spirit" | "bshell_alch"
  | "bshell_prism2" | "bshell_prism3";

export type BattleRuneId =
  | "brune_warden"    | "brune_resonance" | "brune_swift"     | "brune_power"
  | "brune_lifesteal" | "brune_barrier"   | "brune_evasion"   | "brune_soulforge";

export type BattleRuneEffect =
  | "defense_boost" | "resonance_fill" | "swift"    | "power_boost"
  | "lifesteal"     | "barrier"        | "evasion"  | "xp_boost";

export type BattleShellItem = {
  id: BattleShellId;
  name: string;
  element: Element;
  color: string;
  icon: string;
  desc: string;
  prismSlots?: number;
};

export type BattleRuneItem = {
  id: BattleRuneId;
  name: string;
  effect: BattleRuneEffect;
  color: string;
  icon: string;
  desc: string;
};

export const BATTLE_SHELLS: readonly BattleShellItem[] = [
  { id:"bshell_moss",   name:"Mosscap Shell",  element:"Nature",      color:"#5ac070", icon:"🌿", desc:"Woven from living forest moss. Soft, grounding, and patient." },
  { id:"bshell_ember",  name:"Embershell",     element:"Volcanic",    color:"#ff6020", icon:"🔥", desc:"Forged in Cerepup embers. Still faintly warm to the touch." },
  { id:"bshell_tide",   name:"Tideshell",      element:"Oceanic",     color:"#3a90ff", icon:"🌊", desc:"Pulled from the shallows. Hums with the memory of tides." },
  { id:"bshell_storm",  name:"Stormhusk",      element:"Stormproven", color:"#ffd040", icon:"⚡", desc:"Crackles faintly when held. Wild and unchained energy." },
  { id:"bshell_dusk",   name:"Duskhollow",     element:"Abyss",       color:"#604080", icon:"◉",  desc:"Cool even in summer. Carries the silence of deep places." },
  { id:"bshell_frost",  name:"Crystalcap",     element:"Frostformed", color:"#7ddeff", icon:"❄",  desc:"Etched with ancient frost-rune patterns. Unmelting, unyielding." },
  { id:"bshell_spirit", name:"Veilshell",      element:"Spirit",      color:"#b890e0", icon:"✦",  desc:"Shimmers at the edge of sight. Whispers when the world goes quiet." },
  { id:"bshell_alch",   name:"Alchemband",     element:"Alchemy",     color:"#90c060", icon:"⚗",  desc:"Smells faintly of transmutation salts. Shifts under moonlight." },
  { id:"bshell_prism2",  name:"Prism Shell",      element:"Spirit",      color:"#d0a0ff", icon:"◈",  desc:"A dual-slotted shell etched with refraction runes. Holds one rune and one Prism Stone.", prismSlots:1 },
  { id:"bshell_prism3",  name:"Grand Prism Shell", element:"Spirit",     color:"#f0c0ff", icon:"✦",  desc:"Three slots — one rune, two Prism Stones. Rarest of bonding vessels.", prismSlots:2 },
];

export const BATTLE_SHELLS_BY_ID: Record<BattleShellId, BattleShellItem> =
  Object.fromEntries(BATTLE_SHELLS.map(s => [s.id, s])) as Record<BattleShellId, BattleShellItem>;

export const BATTLE_RUNES: readonly BattleRuneItem[] = [
  { id:"brune_warden",    name:"Warden Rune",     effect:"defense_boost",  color:"#60d080", icon:"🛡", desc:"Hardens your Tayanari's defenses. Damage taken reduced by 55% this battle." },
  { id:"brune_resonance", name:"Resonance Rune",  effect:"resonance_fill", color:"#c0a0ff", icon:"◈",  desc:"Resonance floods to full at battle start. Use it wisely." },
  { id:"brune_swift",     name:"Swiftwood Rune",  effect:"swift",          color:"#80ffcc", icon:"💨", desc:"Preternatural speed. Your Tayanari strikes first every turn." },
  { id:"brune_power",     name:"Thornpower Rune", effect:"power_boost",    color:"#ff8040", icon:"⚔",  desc:"Raw striking force surges through every blow. +40% damage dealt." },
  { id:"brune_lifesteal", name:"Bloodvine Rune",  effect:"lifesteal",      color:"#ff6060", icon:"❤",  desc:"Each hit you land heals 15% of damage dealt back to your Tayanari." },
  { id:"brune_barrier",   name:"Aegis Rune",      effect:"barrier",        color:"#a0d0ff", icon:"💠", desc:"An invisible shield absorbs the first hit your Tayanari takes. Once." },
  { id:"brune_evasion",   name:"Mistveil Rune",   effect:"evasion",        color:"#c0e080", icon:"🌫", desc:"Become part-shadow. 25% chance to evade each incoming attack." },
  { id:"brune_soulforge", name:"Soulforge Rune",  effect:"xp_boost",       color:"#ffd060", icon:"✧",  desc:"+40% XP earned from this battle. The forge remembers every victory." },
];

export const BATTLE_RUNES_BY_ID: Record<BattleRuneId, BattleRuneItem> =
  Object.fromEntries(BATTLE_RUNES.map(r => [r.id, r])) as Record<BattleRuneId, BattleRuneItem>;

// ── Keeper Gear System (Clearbell Town shops) ─────────────────────────────────

export type GearSlot = "headband" | "armor" | "wristband" | "shoes" | "backpack";

export type GearSet = "trailblazer" | "resonant" | "ironclad";

export type GearEffect = {
  xpMult?:       number;   // multiplier on all XP earned (1.10 = +10%)
  resonanceMult?: number;  // multiplier on Resonate ability power
  defBonus?:     number;   // flat DEF bonus in battle
  catchBonus?:   number;   // flat catch rate bonus
  bagSlots?:     number;   // extra item carry slots
};

export type GearItem = {
  id: string;
  name: string;
  slot: GearSlot;
  set: GearSet;
  price: number;           // in PrimeriaCoin
  flavor: string;
  effect: GearEffect;
  icon: string;
};

export const GEAR_ITEMS: readonly GearItem[] = [
  // ── Trailblazer Set (XP boost) ──────────────────────────
  { id:"tb_headband",  name:"Trailblazer Headband", slot:"headband",  set:"trailblazer", price:80,
    flavor:"Worn by those who sprint toward every horizon.", icon:"🎯",
    effect:{ xpMult:1.10 } },
  { id:"tb_armor",     name:"Trailblazer Vest",     slot:"armor",     set:"trailblazer", price:120,
    flavor:"Light enough to never slow the chase.",          icon:"🧥",
    effect:{ xpMult:1.15 } },
  { id:"tb_wristband", name:"Trailblazer Wraps",    slot:"wristband", set:"trailblazer", price:70,
    flavor:"Etched with the sigil of ten thousand steps.",   icon:"🪬",
    effect:{ xpMult:1.10 } },
  { id:"tb_shoes",     name:"Trailblazer Treads",   slot:"shoes",     set:"trailblazer", price:90,
    flavor:"Soles never truly wear out. Keepers call them lucky.", icon:"👟",
    effect:{ xpMult:1.12 } },
  { id:"tb_backpack",  name:"Trailblazer Pack",     slot:"backpack",  set:"trailblazer", price:150,
    flavor:"Holds more than it should. Feels lighter by sunset.", icon:"🎒",
    effect:{ xpMult:1.08, bagSlots:4 } },

  // ── Resonant Set (Resonate power boost) ─────────────────
  { id:"rs_headband",  name:"Resonant Crown",       slot:"headband",  set:"resonant", price:90,
    flavor:"Hums with the same frequency as a Tayanari's bond.", icon:"💜",
    effect:{ resonanceMult:1.20 } },
  { id:"rs_armor",     name:"Resonant Mantle",      slot:"armor",     set:"resonant", price:140,
    flavor:"Channels keeper energy into every stored breath.",    icon:"🌀",
    effect:{ resonanceMult:1.25 } },
  { id:"rs_wristband", name:"Resonant Bracers",     slot:"wristband", set:"resonant", price:80,
    flavor:"Vibrate gently when a Tayanari is near.",            icon:"🔮",
    effect:{ resonanceMult:1.20 } },
  { id:"rs_shoes",     name:"Resonant Walkers",     slot:"shoes",     set:"resonant", price:100,
    flavor:"Each step leaves a faint harmonic echo.",            icon:"👣",
    effect:{ resonanceMult:1.15 } },
  { id:"rs_backpack",  name:"Resonant Satchel",     slot:"backpack",  set:"resonant", price:160,
    flavor:"Woven with shell-thread. Amplifies keeper aura.",    icon:"🎒",
    effect:{ resonanceMult:1.15, bagSlots:3 } },

  // ── Ironclad Set (DEF boost) ─────────────────────────────
  { id:"ic_headband",  name:"Ironclad Helm",        slot:"headband",  set:"ironclad", price:85,
    flavor:"Forged from Primeria's northern iron veins.",        icon:"⛏",
    effect:{ defBonus:8 } },
  { id:"ic_armor",     name:"Ironclad Plate",       slot:"armor",     set:"ironclad", price:130,
    flavor:"Heavy, but the security is worth every step.",       icon:"🛡",
    effect:{ defBonus:15 } },
  { id:"ic_wristband", name:"Ironclad Gauntlets",   slot:"wristband", set:"ironclad", price:75,
    flavor:"The forge's mark never leaves the steel.",           icon:"🤜",
    effect:{ defBonus:7 } },
  { id:"ic_shoes",     name:"Ironclad Stompers",    slot:"shoes",     set:"ironclad", price:95,
    flavor:"Planted. Immovable. Nobody moves you.",              icon:"🥾",
    effect:{ defBonus:6 } },
  { id:"ic_backpack",  name:"Ironclad Pack",        slot:"backpack",  set:"ironclad", price:155,
    flavor:"Reinforced sides. Doubles as a shield if needed.",   icon:"🎒",
    effect:{ defBonus:5, bagSlots:2 } },
];

export const GEAR_BY_ID: Record<string, GearItem> =
  Object.fromEntries(GEAR_ITEMS.map(g => [g.id, g]));

// ── Clearbell Berry Shop ──────────────────────────────────────────────────────

export type BerryItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  desc: string;
  color: string;
};

export const CLEARBELL_BERRIES: readonly BerryItem[] = [
  { id:"berry_heart",   name:"Heartberry",    price:18, icon:"🍓", color:"#ff6688",
    desc:"Restores 40% of max HP mid-battle. Sweet but sour at the core." },
  { id:"berry_blaze",   name:"Blazeberry",    price:22, icon:"🫐", color:"#ff7030",
    desc:"+30% ATK for 3 turns. Burns the throat going down." },
  { id:"berry_shell",   name:"Shellberry",    price:20, icon:"🍇", color:"#7060c0",
    desc:"+25% DEF for 3 turns. Tough rind, tougher bond." },
  { id:"berry_flash",   name:"Flashberry",    price:24, icon:"🍋", color:"#ffd040",
    desc:"Guarantees first-strike for one turn. Tastes electric." },
  { id:"berry_revive",  name:"Wakewort",      price:55, icon:"🌿", color:"#50c060",
    desc:"Revives a fainted Tayanari with 25% HP. Rare and bitter." },
  { id:"berry_full",    name:"Fullbloom",     price:80, icon:"🌸", color:"#ffaad0",
    desc:"Fully restores HP of one Tayanari. Smells like the old forests." },
];

// ── Clearbell Shell Shop (growth shells with 1 rune slot) ────────────────────

export type ShopShellItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  color: string;
  growthTrack: "xp" | "atk" | "def" | "spd";
  desc: string;
  flavor: string;
};

export const CLEARBELL_SHELLS: readonly ShopShellItem[] = [
  { id:"cshell_soulwing",  name:"Soulwing Shell",  price:90,  icon:"✦", color:"#ffd060", growthTrack:"xp",
    desc:"+15% XP gain for equipped Tayanari.", flavor:"Lighter than air. Grows with every victory." },
  { id:"cshell_thornfang", name:"Thornfang Shell",  price:100, icon:"⚔", color:"#ff6020", growthTrack:"atk",
    desc:"+8 ATK growth per level for equipped Tayanari.", flavor:"Smells of iron and old battles." },
  { id:"cshell_wardite",   name:"Wardite Shell",    price:100, icon:"🛡", color:"#80d0ff", growthTrack:"def",
    desc:"+8 DEF growth per level for equipped Tayanari.", flavor:"Dense as stone. Never chips." },
  { id:"cshell_zephyr",    name:"Zephyr Shell",     price:95,  icon:"💨", color:"#a0f0c0", growthTrack:"spd",
    desc:"+6 SPD growth per level for equipped Tayanari.", flavor:"Trembles in even the faintest breeze." },
];

export const CLEARBELL_SHELLS_BY_ID: Record<string, ShopShellItem> =
  Object.fromEntries(CLEARBELL_SHELLS.map(s => [s.id, s]));

// ── Clearbell Rune Shop ───────────────────────────────────────────────────────

export type ShopRuneItem = {
  id: string;
  name: string;
  price: number;
  icon: string;
  color: string;
  desc: string;
  flavor: string;
  // Stat effect applied when slotted into a Tayanari shell
  statBonus?: Partial<Record<"hp"|"atk"|"def"|"spd", number>>;
  xpBonus?: number;     // flat XP bonus per battle
};

export const CLEARBELL_RUNES: readonly ShopRuneItem[] = [
  { id:"crune_root",    name:"Root Rune",      price:40,  icon:"🌱", color:"#60c860",
    desc:"+20 max HP for the bonded Tayanari.", flavor:"Grows where planted. Holds what it loves.",
    statBonus:{ hp:20 } },
  { id:"crune_edge",    name:"Edge Rune",       price:45,  icon:"⚔", color:"#ff7040",
    desc:"+6 ATK for the bonded Tayanari.", flavor:"A rune that remembers every wound it caused.",
    statBonus:{ atk:6 } },
  { id:"crune_guard",   name:"Guard Rune",      price:45,  icon:"🛡", color:"#60a0ff",
    desc:"+6 DEF for the bonded Tayanari.", flavor:"The old smiths called it 'unflinching faith'.",
    statBonus:{ def:6 } },
  { id:"crune_swift",   name:"Swift Rune",      price:42,  icon:"💨", color:"#80ffcc",
    desc:"+4 SPD for the bonded Tayanari.", flavor:"Carve it right and the wind never leaves.",
    statBonus:{ spd:4 } },
  { id:"crune_soul",    name:"Soul Rune",        price:60,  icon:"✧", color:"#ffd060",
    desc:"+20 flat XP per battle for the bonded Tayanari.", flavor:"Remembers every fight. Feeds on experience.",
    xpBonus:20 },
  { id:"crune_nature",  name:"Nature Rune",     price:50,  icon:"🌿", color:"#5ac070",
    desc:"+8 ATK when facing Nature-type opponents.", flavor:"The forest always answers its own.",
    statBonus:{ atk:8 } },
  { id:"crune_volcanic",name:"Volcanic Rune",   price:50,  icon:"🔥", color:"#ff6020",
    desc:"+8 ATK when facing Volcanic-type opponents.", flavor:"Carved from a cinder that never cooled.",
    statBonus:{ atk:8 } },
  { id:"crune_frost",   name:"Frost Rune",      price:50,  icon:"❄", color:"#7ddeff",
    desc:"+8 ATK when facing Frostformed-type opponents.", flavor:"Bites the hand that holds it. Worth it.",
    statBonus:{ atk:8 } },
  { id:"crune_tide",    name:"Tide Rune",        price:50,  icon:"🌊", color:"#3a90ff",
    desc:"+8 ATK when facing Oceanic-type opponents.", flavor:"Pulls with the moon. Pushes with the wave.",
    statBonus:{ atk:8 } },
  { id:"crune_storm",   name:"Storm Rune",       price:50,  icon:"⚡", color:"#ffd040",
    desc:"+8 ATK when facing Stormproven-type opponents.", flavor:"Still crackles. Still hungry.",
    statBonus:{ atk:8 } },
];
