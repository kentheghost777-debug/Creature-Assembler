import test from "node:test";
import assert from "node:assert/strict";
import { MAX_ACTIVE_MOVES, learnedMoveIds, sanitizeActiveMoves, defaultActiveMoves } from "./moves.ts";

test("six learned moves survive save sanitization; invalid and duplicate IDs do not", () => {
  const learned = learnedMoveIds("Nature", 150);
  const equipped = learned.slice(0, MAX_ACTIVE_MOVES);
  assert.equal(equipped.length, 6);
  assert.deepEqual(sanitizeActiveMoves("Nature", 150, [...equipped, equipped[0], "missing"]), equipped);
});

test("old four-move saves retain their choices and ordering", () => {
  const old = learnedMoveIds("Oceanic", 150).slice(0, 4).reverse();
  assert.deepEqual(sanitizeActiveMoves("Oceanic", 150, old), old);
});

test("default loadouts respect learning level and six-slot limit", () => {
  for (const level of [1, 5, 18, 30, 150]) {
    const learned = new Set(learnedMoveIds("Spirit", level));
    const loadout = defaultActiveMoves("Spirit", level);
    assert.ok(loadout.length <= 6);
    assert.ok(loadout.every(id => learned.has(id)));
  }
});
