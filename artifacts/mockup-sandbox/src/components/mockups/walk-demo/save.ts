import type { MonSpec, StarterStats } from "./BattleScene";

export type CharId = "kael" | "rowan";

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
      characterId: data.characterId === "rowan" ? "rowan" : "kael",
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

/** Begin a fresh game with the chosen character; clears any prior party. */
export function startNewSave(characterId: CharId): void {
  writeSave({ ts: Date.now(), characterId, party: null });
}

/** Persist party progress, preserving the stored character id. */
export function updateParty(party: PartySave): void {
  const cur = readSave();
  writeSave({
    ts: Date.now(),
    characterId: cur?.characterId ?? "kael",
    party,
  });
}
