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
  /** When the starter has evolved, stores the evolved form's identity so the
   *  correct name + sprite is restored on resume. The base spec (type/color)
   *  is always read from the STARTERS table via starterId. */
  starterFormOverride?: { id: string; name: string; img: string } | null;
  level: number;
  xp: number;
  stats: StarterStats;
  moves: string[];
  caught: MonSpec[];
  box: MonSpec[];
  shells: number;
};

/**
 * Snapshot of where the player physically is in the world plus every quest /
 * progression flag. Persisting this is what lets a player close the game and
 * resume in the exact same spot, mid-quest, on their next visit.
 */
export type WorldSave = {
  scene: string;            // current scene id (overworld / route1 / home / ...)
  posX: number;             // world-space position within that scene
  posY: number;
  // Town errands
  shellsCollected: boolean;
  hasHealingRune: boolean;
  healingRuneEquipped: boolean;
  hasResonanceStone: boolean;
  resonanceStoneEquipped: boolean;
  hasHearthberries: boolean;
  hasSatchel: boolean;
  // NPC arc completion (clears their "!" bubble)
  jessDone: boolean;
  jayDone: boolean;
  mayaInitDone: boolean;
  mayaDone: boolean;
  ellioDone: boolean;
  liaDone: boolean;
  // Route 2 / Wyvrunt arc
  route1Visited: boolean;
  wifeOnPath: boolean;
  wifeIntercepted: boolean;
  route2Greeted: boolean;
  profRoute2Done: boolean;
  hasObsidianRealmShell: boolean;
  wyvruntCaught: boolean;
  // Declared path — chosen in the lab when you receive your starter (not at
  // character creation). Until then the role badge stays hidden.
  roleChosen: boolean;
  // Encounter pacing
  checksStreak: number;
};

export type SaveData = {
  ts: number;
  characterId: CharId;
  roleId: RoleId;
  party: PartySave | null;
  world: WorldSave | null;
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
      world: data.world ?? null,
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

/** Begin a fresh game with the chosen character + declared role; clears any prior party + world. */
export function startNewSave(characterId: CharId, roleId: RoleId = "keeper"): void {
  writeSave({ ts: Date.now(), characterId, roleId, party: null, world: null });
}

/** Persist party progress, preserving the stored character id + role + world. */
export function updateParty(party: PartySave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kael",
    roleId: cur?.roleId ?? "keeper",
    party,
    world: cur?.world ?? null,
  });
}

/** Persist world position + quest flags, preserving the stored character/role/party. */
export function updateWorld(world: WorldSave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kael",
    roleId: cur?.roleId ?? "keeper",
    party: cur?.party ?? null,
    world,
  });
}

/** Persist the declared role (chosen in the lab), preserving character/party/world. */
export function updateRole(roleId: RoleId): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kael",
    roleId,
    party: cur?.party ?? null,
    world: cur?.world ?? null,
  });
}
