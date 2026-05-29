import type { MonSpec, StarterStats } from "./BattleScene";

export type CharId = "kael" | "rowan" | "jess";

/**
 * The path a Keeper-hopeful declares before the Elders at the start of their
 * Trial. Each role carries a single passive boon tied to its calling.
 */
export type RoleId = "keeper" | "hopeful" | "wanderer";

export type RoleDef = {
  id: RoleId;
  name: string;       // short selectable label, e.g. "Keeper"
  title: string;      // formal calling, shown on the oath screen
  calling: string;    // one-line flavor of what this path is
  buffLabel: string;  // short buff summary for the picker
  buffDetail: string; // fuller in-world description of the boon
  glyph: string;      // decorative sigil
  /** XP earned by your Tayanari is multiplied by this. */
  xpMult: number;
  /** Shell capture odds are multiplied by this (result clamped to 1.0). */
  catchMult: number;
  /** Fraction shaved off prices when trading (0.15 = 15% better deals). */
  sellDiscount: number;
};

export const ROLES: RoleDef[] = [
  {
    id: "keeper",
    name: "Keeper",
    title: "The Keeper",
    calling: "To walk beside Tayanari as equals, and grow together through every clash.",
    buffLabel: "+15% bond XP",
    buffDetail: "Your bond runs deep — your Tayanari learn faster, earning 15% more experience from every battle.",
    glyph: "❖",
    xpMult: 1.15,
    catchMult: 1.0,
    sellDiscount: 0,
  },
  {
    id: "hopeful",
    name: "Hopeful",
    title: "The Hopeful",
    calling: "To study the Tayanari and their elements — and one day take the Professor's seat.",
    buffLabel: "+15% catch rate",
    buffDetail: "You read a Tayanari's heart before the shell ever flies — bonds form 15% more readily in the field.",
    glyph: "✦",
    xpMult: 1.0,
    catchMult: 1.15,
    sellDiscount: 0,
  },
  {
    id: "wanderer",
    name: "Wanderer",
    title: "The Wanderer",
    calling: "To roam every road and market of Primeria, trading as you go.",
    buffLabel: "15% better trades",
    buffDetail: "The roads taught you the worth of everything — merchants shave 15% off their prices for you.",
    glyph: "✧",
    xpMult: 1.0,
    catchMult: 1.0,
    sellDiscount: 0.15,
  },
];

export function roleDef(id: RoleId): RoleDef {
  return ROLES.find(r => r.id === id) ?? ROLES[0];
}

export type PartySave = {
  starterId: string | null;
  level: number;
  xp: number;
  stats: StarterStats;
  moves: string[];
  caught: MonSpec[];
  box: MonSpec[];
  shells: number;
};

export type SaveData = {
  ts: number;
  characterId: CharId;
  roleId: RoleId;
  party: PartySave | null;
};

const SAVE_KEY = "primeria_v2";

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ts: typeof data.ts === "number" ? data.ts : Date.now(),
      characterId:
        data.characterId === "rowan" || data.characterId === "jess"
          ? data.characterId
          : "kael",
      roleId:
        data.roleId === "hopeful" || data.roleId === "wanderer"
          ? data.roleId
          : "keeper",
      party: data.party ?? null,
    };
  } catch {
    return null;
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota / unavailable storage */
  }
}

/** Begin a fresh game with the chosen character + declared role; clears any prior party. */
export function startNewSave(characterId: CharId, roleId: RoleId = "keeper"): void {
  writeSave({ ts: Date.now(), characterId, roleId, party: null });
}

/** Persist party progress, preserving the stored character id + role. */
export function updateParty(party: PartySave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kael",
    roleId: cur?.roleId ?? "keeper",
    party,
  });
}
