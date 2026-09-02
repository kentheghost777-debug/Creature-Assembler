import test from "node:test";
import assert from "node:assert/strict";
import { createTayanariSystem, discoveryFor } from "./tayanariSystem.ts";

type TestMon = {
  id: string;
  name: string;
  type: string;
  rarity: string;
  wildImg: string;
};

type TestForm = {
  id: string;
  name: string;
  type: string;
};

const sprout: TestMon = {
  id: "sprout",
  name: "Sprout",
  type: "Nature",
  rarity: "common",
  wildImg: "/sprout.png",
};

const system = createTayanariSystem<TestMon, TestForm>({
  regions: [
    { key: "trail", label: "Trail", accent: "#0f0", mons: [sprout, sprout] },
  ],
  evolutions: [
    { from: "sprout", atLevel: 18, to: { id: "bloom", name: "Bloom", type: "Nature" } },
    { from: "bloom", atLevel: 30, to: { id: "grove", name: "Grove", type: "Nature" } },
  ],
});

test("regional Dex entries are unique by stable ID", () => {
  assert.deepEqual(system.uniqueRegionMons(system.regions[0]).map(mon => mon.id), ["sprout"]);
});

test("level evolution uses one exact trigger lookup", () => {
  assert.equal(system.evolutionAt("sprout", 18)?.to.id, "bloom");
  assert.equal(system.evolutionAt("sprout", 17), null);
  assert.equal(system.nextEvolution("bloom")?.to.id, "grove");
});

test("evolution chains remain ordered and cycle-safe", () => {
  assert.deepEqual(
    system.buildEvolutionChain("sprout").map(form => form.id),
    ["sprout", "bloom", "grove"],
  );
});

test("Dex discovery has a deterministic priority", () => {
  const seen = new Set(["sprout", "bloom", "grove"]);
  const caught = new Set(["bloom", "grove"]);
  const evolved = new Set(["grove"]);
  assert.equal(discoveryFor("sprout", seen, caught, evolved), "seen");
  assert.equal(discoveryFor("bloom", seen, caught, evolved), "caught");
  assert.equal(discoveryFor("grove", seen, caught, evolved), "evolved");
  assert.equal(discoveryFor("unknown", seen, caught, evolved), "unknown");
});
