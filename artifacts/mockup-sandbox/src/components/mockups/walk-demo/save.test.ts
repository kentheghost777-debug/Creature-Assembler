import test from "node:test";
import assert from "node:assert/strict";
import {
  startNewSave,
  readSave,
  readSlot,
  updateJourney,
  updateParty,
  updateWorld,
  updateRole,
  updateInventory,
  setActiveSlot,
} from "./save.ts";
import { newJourney } from "./journeySystems.ts";
const values = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  },
  configurable: true,
});
test("new state survives party, world and role writes and remains slot isolated", () => {
  values.clear();
  startNewSave("custom", "herbalist", 1);
  const j = newJourney();
  j.name = "Ghost";
  j.keeperXp = 500;
  updateJourney(j);
  updateInventory({
    gear: { ring: "tb_ring" },
    ownedGear: ["tb_ring"],
    clearbellShells: [],
    clearbellRunes: [],
    berries: { fullbloom: 2 },
  });
  updateParty({
    starterId: null,
    level: 1,
    xp: 0,
    stats: { hp: 30, atk: 10, def: 10, spd: 8 },
    moves: [],
    caught: [],
    box: [],
    shells: 5,
  });
  updateWorld({ scene: "home", posX: 400, posY: 670 } as any);
  updateRole("wanderer");
  assert.equal(readSave()?.journey?.keeperXp, 500);
  assert.equal(readSave()?.characterId, "custom");
  startNewSave("jess", "keeper", 2);
  assert.equal(readSave()?.journey?.keeperXp, 0);
  assert.equal(readSlot(1)?.journey?.name, "Ghost");
  setActiveSlot(1);
  assert.equal(readSave()?.roleId, "wanderer");
  assert.equal(readSave()?.inventory?.gear.ring, "tb_ring");
  assert.equal(readSlot(2)?.inventory?.ownedGear.length, 0);
});
test("legacy saves migrate without losing party or world", () => {
  values.clear();
  values.set(
    "primeria_v3",
    JSON.stringify({
      ts: 1,
      characterId: "rowan",
      roleId: "hopeful",
      party: { level: 12 },
      world: { scene: "route1" },
    }),
  );
  assert.equal(readSave()?.party?.level, 12);
  assert.equal(readSave()?.world?.scene, "route1");
  assert.equal(readSave()?.journey?.keeperXp, 0);
});
