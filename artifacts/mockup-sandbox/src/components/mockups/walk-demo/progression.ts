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
  | "Chaos";

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
