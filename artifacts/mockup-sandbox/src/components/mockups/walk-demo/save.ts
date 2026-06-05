import type { MonSpec, StarterStats } from "./BattleScene";

export type CharId = "kinju" | "rowan" | "jess";

export type RoleId = "keeper" | "hopeful" | "wanderer";

export type RoleDef = {
  id: RoleId;
  name: string;
  title: string;
  calling: string;
  buffLabel: string;
  buffDetail: string;
  glyph: string;
  xpMult: number;
  catchMult: number;
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

export type PartyMon = MonSpec & { level: number; xp: number; moves?: string[]; shellId?: string | null; runeIds?: string[] };

export type PartySave = {
  starterId: string | null;
  starterFormOverride?: { id: string; name: string; img: string } | null;
  level: number;
  xp: number;
  stats: StarterStats;
  moves: string[];
  caught: PartyMon[];
  box: PartyMon[];
  shells: number;
  shellId?: string | null;
  runeIds?: string[];
};

export type WorldSave = {
  scene: string;
  posX: number;
  posY: number;
  shellsCollected: boolean;
  hasHealingRune: boolean;
  healingRuneEquipped: boolean;
  hasResonanceStone: boolean;
  resonanceStoneEquipped: boolean;
  hasHearthberries: boolean;
  hasSatchel: boolean;
  firstHomeGreeting: boolean;
  jessDone: boolean;
  jayDone: boolean;
  mayaInitDone: boolean;
  mayaDone: boolean;
  ellioDone: boolean;
  liaDone: boolean;
  route1Visited: boolean;
  wifeOnPath: boolean;
  wifeIntercepted: boolean;
  route2Greeted: boolean;
  profRoute2Done: boolean;
  hasObsidianRealmShell: boolean;
  wyvruntCaught: boolean;
  wyvruntForm: number;
  wyrLoyalty: number;
  jayA3Wins: number;
  liaA3Wins: number;
  roleChosen: boolean;
  checksStreak: number;
  cleminusMet: boolean;
  demoComplete: boolean;
  jerbsBattleDone: boolean;
  hasCrystalFang: boolean;
  crystalFangEvo: "glacia" | "volcia" | "faelia" | null;
  catalystStones: ("glacia"|"volcia"|"faelia")[];
  hollisGifted: boolean;
  duskberries: number;
  thornberries: number;
  calmberries: number;
  brightberries: number;
  farmVisited: boolean;
  farmShellsGiven: boolean;
  farmRunesGiven: boolean;
  marenGifted: boolean;
  ownedBattleShellIds: string[];
  ownedBattleRuneIds: string[];
  hasCrucibyx: boolean;
  ownedPrismStoneIds: string[];
  slottedPrismStoneId: string | null;
  primeriaCoin: number;
  profShoreWins: number;
  profShorePaid: number;
  corvinMet: boolean;
  collectedGroundItems: string[];
  baseGearGranted: boolean;
  visitedScenes?: string[];
};

export type SaveData = {
  ts: number;
  characterId: CharId;
  roleId: RoleId;
  party: PartySave | null;
  world: WorldSave | null;
};

// ── Multi-slot system ─────────────────────────────────────────────────────────
// Slots 1-3 are stored as primeria_v3_s1 / primeria_v3_s2 / primeria_v3_s3.
// The "active slot" is stored in primeria_v3_active (number 1-3).
// Legacy saves at primeria_v3 (no slot suffix) are imported into slot 1 on
// first load and then removed, giving zero data loss on upgrade.

const SLOT_KEYS = ["primeria_v3_s1", "primeria_v3_s2", "primeria_v3_s3"] as const;
const ACTIVE_KEY = "primeria_v3_active";
const LEGACY_KEY = "primeria_v3";

export type SlotIndex = 1 | 2 | 3;
export const ALL_SLOTS: SlotIndex[] = [1, 2, 3];

function slotKey(slot: SlotIndex): string {
  return SLOT_KEYS[slot - 1];
}

/** Migrate a legacy single-slot save into slot 1 (runs once). */
function migrateLegacy(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return;
    if (!localStorage.getItem(slotKey(1))) {
      localStorage.setItem(slotKey(1), legacy);
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* ignore */ }
}

/** Read and validate a raw save from localStorage. */
function parseSlot(raw: string | null): SaveData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<SaveData>;
    return {
      ts: typeof data.ts === "number" ? data.ts : Date.now(),
      characterId:
        data.characterId === "rowan" || data.characterId === "jess" || data.characterId === "kinju"
          ? data.characterId
          : "kinju",
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

export function getActiveSlot(): SlotIndex {
  migrateLegacy();
  try {
    const v = parseInt(localStorage.getItem(ACTIVE_KEY) ?? "1", 10);
    if (v === 1 || v === 2 || v === 3) return v as SlotIndex;
  } catch { /* ignore */ }
  return 1;
}

export function setActiveSlot(slot: SlotIndex): void {
  try { localStorage.setItem(ACTIVE_KEY, String(slot)); } catch { /* ignore */ }
}

/** Read a specific slot (null = empty). */
export function readSlot(slot: SlotIndex): SaveData | null {
  migrateLegacy();
  try { return parseSlot(localStorage.getItem(slotKey(slot))); } catch { return null; }
}

/** Write to a specific slot. */
export function writeSlot(slot: SlotIndex, data: SaveData): void {
  try { localStorage.setItem(slotKey(slot), JSON.stringify(data)); } catch { /* ignore */ }
}

/** Delete a slot permanently. */
export function deleteSlot(slot: SlotIndex): void {
  try { localStorage.removeItem(slotKey(slot)); } catch { /* ignore */ }
}

// ── Active-slot helpers (used by WalkDemo to persist without knowing slot) ───

export function hasSave(): boolean {
  migrateLegacy();
  try {
    const slot = getActiveSlot();
    return !!localStorage.getItem(slotKey(slot));
  } catch {
    return false;
  }
}

export function readSave(): SaveData | null {
  return readSlot(getActiveSlot());
}

export function writeSave(data: SaveData): void {
  writeSlot(getActiveSlot(), data);
}

export function startNewSave(characterId: CharId, roleId: RoleId = "keeper", slot?: SlotIndex): void {
  const target = slot ?? getActiveSlot();
  setActiveSlot(target);
  writeSlot(target, { ts: Date.now(), characterId, roleId, party: null, world: null });
}

export function updateParty(party: PartySave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kinju",
    roleId: cur?.roleId ?? "keeper",
    party,
    world: cur?.world ?? null,
  });
}

export function updateWorld(world: WorldSave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kinju",
    roleId: cur?.roleId ?? "keeper",
    party: cur?.party ?? null,
    world,
  });
}

export function updateRole(roleId: RoleId): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kinju",
    roleId,
    party: cur?.party ?? null,
    world: cur?.world ?? null,
  });
}

/** Format a save timestamp as a short human-readable string. */
export function formatSaveTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
