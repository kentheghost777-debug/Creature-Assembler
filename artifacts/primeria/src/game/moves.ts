// ── Combat move system ──────────────────────────────────────────────────────
// Pure data + math for Primeria's battle system. No React here.
//
// A "move" is either a damaging elemental technique or a utility technique
// (heal / raise attack / shield). Every Tayanari has a per-element LEARNSET
// that unlocks moves as it levels up; the active loadout is a chosen subset of
// up to 4 learned moves (rearrangeable out of battle).
//
// Move/element NAMES here are intentionally simple placeholders — they're easy
// to rename later without touching any battle logic.

import { type Element } from "./progression";

export type MoveCategory = "damage" | "heal" | "buff" | "shield";

// Animation motif tag. Each element maps to a damage motif; utility moves use
// their own dedicated motifs (mend / sharpen / bulwark).
export type MoveAnim =
  | "leaf" | "ember" | "splash" | "shard" | "bolt" | "rock" | "gust"
  | "wisp" | "glyph" | "bubble" | "void" | "plate" | "glitch"
  | "mend" | "sharpen" | "bulwark";

export type Move = {
  id: string;
  name: string;
  /** Damage moves carry an element (drives STAB + type effectiveness). Utility
   *  moves are element-neutral (tinted by the caster's own element at render). */
  element?: Element;
  category: MoveCategory;
  /** Base power for damage moves; 0 for utility. */
  power: number;
  /** Hit chance, 0..100. */
  accuracy: number;
  /** Uses available per battle. */
  pp: number;
  anim: MoveAnim;
  desc: string;
  // ── Utility effects ──
  /** Heal fraction of max HP (heal moves). */
  heal?: number;
  /** Flat attack added for the rest of the battle (buff moves). */
  atkBuff?: number;
  /** Flat defense added for the rest of the battle (shield moves). */
  defBuff?: number;
};

// ── Element → damage animation motif ────────────────────────────────────────
export const ELEMENT_ANIM: Record<Element, MoveAnim> = {
  Nature: "leaf", Volcanic: "ember", Oceanic: "splash", Frostformed: "shard",
  Stormproven: "bolt", Earthbound: "rock", Skyborne: "gust", Spirit: "wisp",
  Mind: "glyph", Alchemy: "bubble", Abyss: "void", Armored: "plate",
  Chaos: "glitch",
};

const ALL_ELEMENTS = Object.keys(ELEMENT_ANIM) as Element[];

// ── Damage power tiers (placeholders, tuned to the HP ranges in play) ────────
const TIER = { t1: 7, t2: 11, t3: 15, sig: 20 } as const;
const TIER_NAME = { t1: "Jab", t2: "Strike", t3: "Barrage", sig: "Overload" } as const;
const TIER_PP   = { t1: 25, t2: 15, t3: 10, sig: 5 } as const;
const TIER_ACC  = { t1: 100, t2: 95, t3: 90, sig: 85 } as const;

function dmgMoveId(el: Element, tier: keyof typeof TIER): string {
  return `${el.toLowerCase()}_${tier}`;
}

function buildDamageMoves(el: Element): Move[] {
  return (Object.keys(TIER) as (keyof typeof TIER)[]).map(tier => ({
    id: dmgMoveId(el, tier),
    name: `${el} ${TIER_NAME[tier]}`,
    element: el,
    category: "damage" as const,
    power: TIER[tier],
    accuracy: TIER_ACC[tier],
    pp: TIER_PP[tier],
    anim: ELEMENT_ANIM[el],
    desc: `A ${tier === "sig" ? "devastating" : tier === "t3" ? "heavy" : tier === "t2" ? "focused" : "quick"} ${el.toLowerCase()} technique.`,
  }));
}

// ── Universal utility moves (any Tayanari can learn these) ───────────────────
export const UTILITY_MOVES: Move[] = [
  { id: "u_mend", name: "Mend", category: "heal", power: 0, accuracy: 100, pp: 10,
    anim: "mend", heal: 0.4, desc: "Channels bond energy to restore 40% of max HP." },
  { id: "u_sharpen", name: "Sharpen", category: "buff", power: 0, accuracy: 100, pp: 12,
    anim: "sharpen", atkBuff: 3, desc: "Sharpens instinct — raises Attack for the rest of the battle." },
  { id: "u_bulwark", name: "Bulwark", category: "shield", power: 0, accuracy: 100, pp: 12,
    anim: "bulwark", defBuff: 3, desc: "Hardens the body — raises Defense for the rest of the battle." },
];

// ── Catalog (id → Move) ─────────────────────────────────────────────────────
export const MOVES: Record<string, Move> = (() => {
  const out: Record<string, Move> = {};
  for (const el of ALL_ELEMENTS) for (const m of buildDamageMoves(el)) out[m.id] = m;
  for (const m of UTILITY_MOVES) out[m.id] = m;
  return out;
})();

export function getMove(id: string): Move | undefined { return MOVES[id]; }
export function moveName(id: string): string { return MOVES[id]?.name ?? id; }

// ── Type-effectiveness chart ────────────────────────────────────────────────
// STRONG_AGAINST[A] = elements that A deals 2× to. The matrix is derived:
//   eff(atk, def) = 2.0 if def ∈ STRONG_AGAINST[atk]
//                 = 0.5 if atk ∈ STRONG_AGAINST[def]   (reverse — atk is weak)
//                 = 1.0 otherwise
// This guarantees a contradiction-free chart (no mutual 2×). Validated for
// balance: every element has 2–3 offensive matchups and 1–3 weaknesses.
export const STRONG_AGAINST: Record<Element, Element[]> = {
  Nature:      ["Oceanic", "Earthbound"],
  Volcanic:    ["Nature", "Frostformed", "Armored"],
  Oceanic:     ["Volcanic", "Earthbound"],
  Frostformed: ["Nature", "Skyborne"],
  Stormproven: ["Oceanic", "Skyborne"],
  Earthbound:  ["Volcanic", "Stormproven", "Armored"],
  Skyborne:    ["Nature", "Alchemy"],
  Spirit:      ["Mind", "Abyss"],
  Mind:        ["Alchemy", "Skyborne"],
  Alchemy:     ["Oceanic", "Armored"],
  Abyss:       ["Mind", "Chaos"],
  Armored:     ["Frostformed", "Stormproven"],
  Chaos:       ["Spirit", "Mind"],
};

export function effectiveness(atk: Element, def: Element): number {
  if (STRONG_AGAINST[atk]?.includes(def)) return 2.0;
  if (STRONG_AGAINST[def]?.includes(atk)) return 0.5;
  return 1.0;
}

export function effLabel(mult: number): string {
  if (mult >= 2) return "It's super effective!";
  if (mult <= 0.5) return "It's not very effective…";
  return "";
}

/** Coerce a free-form type string into a known Element, or null if unknown. */
export function asElement(type: string): Element | null {
  return (ALL_ELEMENTS as string[]).includes(type) ? (type as Element) : null;
}

// ── Damage formula ──────────────────────────────────────────────────────────
// Power-dominant with a soft defensive soak so high-DEF mons resist without
// ever fully negating. STAB ×1.25, type effectiveness ×0.5/1/2, ±15% variance,
// 1/16 crit ×1.5. Always at least 1 damage.
export function computeDamage(opts: {
  power: number;
  attackerAtk: number;
  defenderDef: number;
  stab: boolean;
  effectiveness: number;
  rng?: () => number;
}): { dmg: number; crit: boolean } {
  const r = opts.rng ?? Math.random;
  const soak = opts.defenderDef / (opts.defenderDef + 18); // 0..1, soft
  let base = (opts.power + opts.attackerAtk) * (1 - soak);
  if (opts.stab) base *= 1.25;
  base *= opts.effectiveness;
  base *= 0.85 + r() * 0.30; // ±15% variance (0.85–1.15)
  const crit = r() < 1 / 16;
  if (crit) base *= 1.5;
  return { dmg: Math.max(1, Math.round(base)), crit };
}

// ── Wild / opponent combat stats ────────────────────────────────────────────
const RARITY_DEF: Record<string, number> = {
  common: 3, uncommon: 4, rare: 6, ultra: 8, apex: 10,
};
const RARITY_LEVEL: Record<string, number> = {
  common: 4, uncommon: 7, rare: 10, ultra: 13, apex: 16,
};

/** Derive an attack/defense stat block for a wild mon from its baseDmg+rarity. */
export function wildCombatStats(baseDmg: [number, number], rarity: string): { atk: number; def: number } {
  const [lo, hi] = baseDmg;
  return { atk: Math.round((lo + hi) / 2), def: RARITY_DEF[rarity] ?? 4 };
}

/** The notional level a wild mon fights at (gates its learned moveset). */
export function wildLevelFor(rarity: string): number {
  return RARITY_LEVEL[rarity] ?? 5;
}

// ── Learnsets ───────────────────────────────────────────────────────────────
// Per element: a fixed unlock schedule interleaving damage tiers with utility.
export type LearnEntry = { level: number; moveId: string };

export function learnsetFor(el: Element): LearnEntry[] {
  return [
    { level: 1,  moveId: dmgMoveId(el, "t1") },
    { level: 1,  moveId: "u_sharpen" },
    { level: 5,  moveId: dmgMoveId(el, "t2") },
    { level: 8,  moveId: "u_mend" },
    { level: 11, moveId: dmgMoveId(el, "t3") },
    { level: 14, moveId: "u_bulwark" },
    { level: 18, moveId: dmgMoveId(el, "sig") },
  ];
}

/** All move ids learnable by `level` (deduped, in unlock order). */
export function learnedMoveIds(el: Element, level: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of learnsetFor(el)) {
    if (e.level <= level && !seen.has(e.moveId)) { seen.add(e.moveId); out.push(e.moveId); }
  }
  return out;
}

/** Move ids unlocked at exactly `level` (for level-up reporting). */
export function movesLearnedAt(el: Element, level: number): string[] {
  return learnsetFor(el).filter(e => e.level === level).map(e => e.moveId);
}

/** Sensible default active loadout (≤4): strongest damage first, then a heal. */
export function defaultActiveMoves(el: Element, level: number): string[] {
  const learned = learnedMoveIds(el, level);
  const damage = learned
    .filter(id => MOVES[id]?.category === "damage")
    .sort((a, b) => (MOVES[b].power - MOVES[a].power));
  const utility = learned.filter(id => MOVES[id]?.category !== "damage");
  const ordered = [
    ...damage.slice(0, 3),
    ...utility.slice(0, 1),
    ...damage.slice(3),
    ...utility.slice(1),
  ];
  return ordered.slice(0, 4);
}

/** Keep only valid, learned ids (≤4); rebuild from default if nothing valid.
 *  Used to migrate old saves whose `moves` held cosmetic name strings. */
export function sanitizeActiveMoves(el: Element, level: number, current: string[]): string[] {
  const learnable = new Set(learnedMoveIds(el, level));
  const valid = current.filter(id => learnable.has(id));
  const deduped: string[] = [];
  for (const id of valid) if (!deduped.includes(id)) deduped.push(id);
  return deduped.length > 0 ? deduped.slice(0, 4) : defaultActiveMoves(el, level);
}
