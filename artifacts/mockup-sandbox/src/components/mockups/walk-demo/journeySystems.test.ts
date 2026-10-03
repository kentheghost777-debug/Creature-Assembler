import test from "node:test";
import assert from "node:assert/strict";
import {
  newJourney,
  bondEvent,
  emptyBond,
  chooseBondPath,
  finishBattle,
  guideTier,
  craftVessel,
  captureChance,
  tayanariBranches,
  normalizeJourney,
  initializeBond,
} from "./journeySystems.ts";

test("care cooldown and diminishing returns preserve separate histories", () => {
  let j = newJourney();
  j = bondEvent(j, "a", "care", 100000);
  assert.equal(j.bonds.a.loyalty, 3);
  assert.equal(bondEvent(j, "a", "care", 100001), j);
  j = bondEvent(j, "a", "fainted");
  assert.equal(j.bonds.a.loyalty, 3);
  assert.equal(j.bonds.a.chaos, 4);
  j = bondEvent(j, "a", "revive");
  assert.equal(j.bonds.a.loyalty, 7);
  assert.equal(j.bonds.a.chaos, 4);
  assert.equal(j.bonds.b, undefined);
});
test("bond thresholds unlock choices rather than force evolution or instant swapping", () => {
  let j = newJourney();
  j.bonds.a = { ...emptyBond(), loyalty: 99, chaos: 100 };
  j = bondEvent(j, "a", "care", 100000);
  assert.deepEqual(j.bonds.a.unlocked, ["loyalty", "chaos"]);
  assert.equal(j.bonds.a.path, null);
  j = chooseBondPath(j, "a", "loyalty");
  assert.equal(j.bonds.a.path, "loyalty");
  assert.equal(j.bonds.a.loyalty, 0);
  assert.equal(j.bonds.a.chaos, 100);
  j = chooseBondPath(j, "a", "chaos");
  assert.equal(j.bonds.a.path, "chaos");
  assert.equal(chooseBondPath(j, "a", "loyalty"), j);
});
test("Guide Stones gate deeper systems and ordinary battle never changes bonds", () => {
  const j = newJourney();
  const next = finishBattle(j, 500, true);
  assert.equal(guideTier(next), 3);
  assert.deepEqual(next.bonds, {});
  assert.equal(finishBattle(j, 500, false), j);
  assert.deepEqual(tayanariBranches(1), [1, 1, 1]);
  assert.deepEqual(tayanariBranches(2), [2, 1, 2]);
  assert.deepEqual(tayanariBranches(3), [3, 1, 3]);
});
test("crafting consumes essence once and never creates Balance vessels", () => {
  const j = newJourney();
  j.essences = { Nature: 2, Balance: 10 };
  const next = craftVessel(j, "Nature");
  assert.equal(next.essences.Nature, 1);
  assert.equal(next.vessels[0].count, 1);
  assert.equal(craftVessel(next, "Nature").vessels[0].count, 2);
  assert.equal(craftVessel(j, "Balance"), j);
});
test("capture responds to health, mismatch, resistance and infinite will", () => {
  const full = captureChance({ hpFraction: 1 });
  assert.ok(captureChance({ hpFraction: 0.1 }) > full);
  assert.ok(captureChance({ hpFraction: 1, match: 0.35 }) < full);
  assert.ok(captureChance({ hpFraction: 1, failures: 10 }) < full);
  assert.equal(captureChance({ hpFraction: 0.01, will: Infinity }), 0);
});
test("loadout migration excludes unknown spells and respects six slots", () => {
  assert.deepEqual(
    normalizeJourney({ spells: ["missing", "mending_light", "mending_light"] })
      .spells,
    ["mending_light"],
  );
});

test("elemental shells establish distinct starting bond histories", () => {
  const j = newJourney();
  assert.equal(initializeBond(j, "a", "neutral").bonds.a.chaos, 0);
  assert.ok(initializeBond(j, "a", "matched").bonds.a.loyalty > 0);
  assert.ok(initializeBond(j, "a", "mismatch").bonds.a.chaos > 0);
});
test("malformed optional progression fields cannot destroy a legacy save", () => {
  const j = normalizeJourney({
    spells: "oops",
    bonds: { a: { loyalty: Infinity, chaos: 500, unlocked: "bad" } },
    vessels: "oops",
    chronicles: null,
    keeperXp: Infinity,
  } as any);
  assert.equal(j.keeperXp, 0);
  assert.equal(j.bonds.a.chaos, 100);
  assert.equal(j.bonds.a.loyalty, 0);
  assert.deepEqual(j.vessels, []);
  assert.equal(j.spells.length, 3);
});
