// September mechanics. Numeric progression/costs below are tuning defaults,
// deliberately separated from canon until final balance is approved.
export const SYSTEM_TUNING = {
  baseCapture: 0.35,
  matchingBondLoyalty: 3,
  mismatchedBondChaos: 15,
  masteryXp: 100,
  careCooldownMs: 60_000,
  careGain: 3,
  faintChaos: 4,
  reviveLoyalty: 4,
  spellCost: 8,
  primeCost: 18,
  guideMilestones: [1, 3, 6, 10, 15],
};
export type FamilyId = "jay" | "lia" | "ellio" | "maya" | "irwyn";
export const FAMILIES: { id: FamilyId; name: string; home: string }[] = [
  { id: "jay", name: "Jay", home: "jay" },
  { id: "lia", name: "Lia", home: "lia" },
  { id: "ellio", name: "Ellio", home: "ellio" },
  { id: "maya", name: "Maya", home: "maya" },
  { id: "irwyn", name: "Professor Irwyn", home: "lab" },
];
export type Bond = {
  loyalty: number;
  chaos: number;
  lastCare: number;
  careCount: number;
  unlocked: ("loyalty" | "chaos")[];
  path: "loyalty" | "chaos" | null;
};
export const SHELL_QUALITIES = [
  { name: "Weathered", mult: 1, slots: 0 },
  { name: "Preserved", mult: 1.05, slots: 0 },
  { name: "Spivaro", mult: 1.1, slots: 1 },
  { name: "Fresh", mult: 1.2, slots: 1 },
  { name: "Alpha", mult: 1.35, slots: 2 },
  { name: "Exotic", mult: 1.5, slots: 3 },
] as const;
export type Vessel = {
  id: string;
  element: string;
  quality: number;
  count: number;
};
export type Journey = {
  essences: Record<string, number>;
  vessels: Vessel[];
  keeperRunes: string[];
  attunement: string | null;
  version: 1;
  name: string;
  family: FamilyId;
  keeperXp: number;
  resonanceXp: number;
  guideStones: number;
  campTier: number;
  spells: string[];
  spellNodes: string[];
  resonanceNodes: string[];
  tayanariNodes: Record<string, string[]>;
  bonds: Record<string, Bond>;
  chronicles: { key: string; text: string }[];
  time: "day" | "night";
};
export type Spell = {
  id: string;
  name: string;
  branch: "Offense" | "Defense" | "Support";
  tier: number;
  effect: "strike" | "guard" | "heal" | "weaken" | "revive" | "restore";
};
export const SPELLS: Spell[] = [
  {
    id: "elemental_pulse",
    name: "Elemental Pulse",
    branch: "Offense",
    tier: 1,
    effect: "strike",
  },
  {
    id: "living_ward",
    name: "Living Ward",
    branch: "Defense",
    tier: 1,
    effect: "guard",
  },
  {
    id: "mending_light",
    name: "Mending Light",
    branch: "Support",
    tier: 1,
    effect: "heal",
  },
  {
    id: "unravel",
    name: "Unravel",
    branch: "Defense",
    tier: 2,
    effect: "weaken",
  },
  {
    id: "recall_breath",
    name: "Recall Breath",
    branch: "Support",
    tier: 2,
    effect: "revive",
  },
  {
    id: "wellspring",
    name: "Wellspring",
    branch: "Support",
    tier: 3,
    effect: "restore",
  },
];
export const RESONANCE_NODES = [
  { id: "attack", name: "Elemental Echo", branch: "Attack", tier: 1 },
  { id: "support", name: "Shared Shelter", branch: "Support", tier: 1 },
  { id: "control", name: "Quiet Current", branch: "Control", tier: 1 },
  { id: "prime", name: "Prime", branch: "Attack", tier: 2 },
  { id: "bench", name: "Bench Assist", branch: "Attack", tier: 3 },
  { id: "chain", name: "Party Chain", branch: "Attack", tier: 4 },
  { id: "loyalty", name: "Loyalty Network", branch: "Support", tier: 4 },
  { id: "chaos", name: "Chaos Network", branch: "Control", tier: 4 },
];
export function newJourney(): Journey {
  return {
    essences: {},
    vessels: [],
    keeperRunes: [],
    attunement: null,
    version: 1,
    name: "Keeper",
    family: "jay",
    keeperXp: 0,
    resonanceXp: 0,
    guideStones: 0,
    campTier: 1,
    spells: ["elemental_pulse", "living_ward", "mending_light"],
    spellNodes: ["elemental_pulse", "living_ward", "mending_light"],
    resonanceNodes: [],
    tayanariNodes: {},
    bonds: {},
    chronicles: [],
    time: "day",
  };
}
const clamp = (n: number) =>
  Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));
const strings = (v: unknown, fallback: string[] = []): string[] =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string"))]
    : fallback;
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const number = (v: unknown, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, v))
    : 0;
export function normalizeJourney(raw?: Partial<Journey> | null): Journey {
  const d = newJourney();
  if (!raw || typeof raw !== "object") return d;
  const spellNodes = strings(raw.spellNodes, d.spellNodes).filter((id) =>
    SPELLS.some((s) => s.id === id),
  );
  const bonds = Object.fromEntries(
    Object.entries(record(raw.bonds)).map(([key, value]) => {
      const b = record(value);
      return [
        key,
        {
          loyalty: clamp(number(b.loyalty)),
          chaos: clamp(number(b.chaos)),
          lastCare: number(b.lastCare),
          careCount: number(b.careCount),
          unlocked: strings(b.unlocked).filter(
            (v) => v === "loyalty" || v === "chaos",
          ),
          path: b.path === "loyalty" || b.path === "chaos" ? b.path : null,
        },
      ];
    }),
  ) as Record<string, Bond>;
  return {
    ...d,
    keeperRunes: strings(raw.keeperRunes).slice(0, 3),
    attunement: typeof raw.attunement === "string" ? raw.attunement : null,
    version: 1,
    name: typeof raw.name === "string" ? raw.name.slice(0, 32) : d.name,
    family: FAMILIES.some((f) => f.id === raw.family) ? raw.family! : d.family,
    keeperXp: number(raw.keeperXp),
    resonanceXp: number(raw.resonanceXp),
    guideStones: Math.floor(number(raw.guideStones, 4)),
    campTier: Math.max(1, Math.floor(number(raw.campTier, 5))),
    spellNodes,
    spells: strings(raw.spells, d.spells)
      .filter((id) => spellNodes.includes(id))
      .slice(0, 6),
    resonanceNodes: strings(raw.resonanceNodes).filter((id) =>
      RESONANCE_NODES.some((n) => n.id === id),
    ),
    tayanariNodes: Object.fromEntries(
      Object.entries(record(raw.tayanariNodes)).map(([key, nodes]) => [
        key,
        strings(nodes).filter((id) => /^[0-2]-[0-2]$/.test(id)),
      ]),
    ),
    bonds,
    essences: Object.fromEntries(
      Object.entries(record(raw.essences)).map(([el, n]) => [
        el,
        Math.floor(number(n)),
      ]),
    ),
    vessels: (Array.isArray(raw.vessels) ? raw.vessels : [])
      .filter(
        (v) => v && typeof v.id === "string" && typeof v.element === "string",
      )
      .map((v) => ({
        ...v,
        count: Math.floor(number(v.count)),
        quality: Math.floor(number(v.quality, 5)),
      })),
    chronicles: (Array.isArray(raw.chronicles) ? raw.chronicles : [])
      .filter(
        (c) => c && typeof c.key === "string" && typeof c.text === "string",
      )
      .slice(-100),
    time: raw.time === "night" ? "night" : "day",
  };
}
export function masteryLevel(xp: number): number {
  return Math.min(
    150,
    1 + Math.floor(Math.max(0, xp) / SYSTEM_TUNING.masteryXp),
  );
}
export function guideTier(j: Journey): number {
  return Math.min(5, 1 + j.guideStones);
}
export function emptyBond(): Bond {
  return {
    loyalty: 0,
    chaos: 0,
    lastCare: 0,
    careCount: 0,
    unlocked: [],
    path: null,
  };
}
export function bondEvent(
  j: Journey,
  key: string,
  event: "care" | "fainted" | "revive",
  now = Date.now(),
): Journey {
  const b = { ...emptyBond(), ...j.bonds[key] };
  if (event === "care" && now - b.lastCare < SYSTEM_TUNING.careCooldownMs)
    return j;
  if (event === "care") {
    b.loyalty = clamp(
      b.loyalty +
        Math.max(1, SYSTEM_TUNING.careGain - Math.floor(b.careCount / 3)),
    );
    b.lastCare = now;
    b.careCount++;
  } else if (event === "revive")
    b.loyalty = clamp(b.loyalty + SYSTEM_TUNING.reviveLoyalty);
  else b.chaos = clamp(b.chaos + SYSTEM_TUNING.faintChaos);
  b.unlocked = [
    ...new Set([
      ...b.unlocked,
      ...(b.loyalty >= 100 ? ["loyalty" as const] : []),
      ...(b.chaos >= 100 ? ["chaos" as const] : []),
    ]),
  ];
  return { ...j, bonds: { ...j.bonds, [key]: b } };
}
export function finishBattle(j: Journey, xp: number, won: boolean): Journey {
  if (!won) return j;
  const next = { ...j, keeperXp: j.keeperXp + xp };
  const earned = SYSTEM_TUNING.guideMilestones
    .slice(1)
    .filter((n) => masteryLevel(next.keeperXp) >= n).length;
  next.guideStones = Math.max(next.guideStones, earned);
  return next;
}
export function recordChronicle(
  j: Journey,
  key: string,
  text: string,
): Journey {
  return j.chronicles.some((c) => c.key === key)
    ? j
    : { ...j, chronicles: [...j.chronicles, { key, text }].slice(-100) };
}
export function tayanariBranches(form: number): number[] {
  return form >= 3 ? [3, 1, 3] : form === 2 ? [2, 1, 2] : [1, 1, 1];
}
export function captureChance(a: {
  hpFraction: number;
  quality?: number;
  match?: number;
  status?: number;
  help?: number;
  role?: number;
  will?: number;
  failures?: number;
}): number {
  if (a.will === Infinity) return 0;
  const hp =
    a.hpFraction <= 0.01
      ? 3
      : a.hpFraction <= 0.1
        ? 2.5
        : a.hpFraction <= 0.25
          ? 2
          : a.hpFraction <= 0.5
            ? 1.5
            : a.hpFraction <= 0.75
              ? 1.2
              : 1;
  return Math.max(
    0.01,
    Math.min(
      0.95,
      ((100 / (a.will ?? 100)) *
        SYSTEM_TUNING.baseCapture *
        hp *
        (a.quality ?? 1) *
        (a.match ?? 1) *
        (a.status ?? 1) *
        (a.help ?? 1) *
        (a.role ?? 1)) /
        (1 + Math.min(0.3, (a.failures ?? 0) * 0.05)),
    ),
  );
}

export function craftVessel(j: Journey, element: string): Journey {
  if (
    element === "Balance" ||
    element === "Radiant" ||
    element === "Chaos" ||
    (j.essences[element] ?? 0) < 1
  )
    return j;
  const id = `fresh-${element}`;
  const found = j.vessels.find((v) => v.id === id);
  return {
    ...j,
    essences: { ...j.essences, [element]: j.essences[element] - 1 },
    vessels: found
      ? j.vessels.map((v) => (v.id === id ? { ...v, count: v.count + 1 } : v))
      : [...j.vessels, { id, element, quality: 3, count: 1 }],
  };
}
export function chooseBondPath(
  j: Journey,
  key: string,
  path: "loyalty" | "chaos",
): Journey {
  const b = j.bonds[key];
  if (!b || b[path] < 100 || b.path === path) return j;
  return { ...j, bonds: { ...j.bonds, [key]: { ...b, path, [path]: 0 } } };
}

export function initializeBond(
  j: Journey,
  key: string,
  alignment: "matched" | "mismatch" | "neutral" = "neutral",
): Journey {
  if (j.bonds[key]) return j;
  return {
    ...j,
    bonds: {
      ...j.bonds,
      [key]: {
        ...emptyBond(),
        loyalty:
          alignment === "matched" ? SYSTEM_TUNING.matchingBondLoyalty : 0,
        chaos: alignment === "mismatch" ? SYSTEM_TUNING.mismatchedBondChaos : 0,
      },
    },
  };
}
