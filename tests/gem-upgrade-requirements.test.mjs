import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = JSON.parse(await readFile(new URL("../app/source-gem-data.json", import.meta.url), "utf8"));

test("keeps representative Gem upgrade requirements from the original sheet", () => {
  assert.equal(source["exodus-rp"].requiredLevel, 3);
  assert.equal(source["exodus-mp"].requiredLevel, 4);
  assert.equal(source["exodus-mats"].requiredLevel, 5);
  assert.equal(source["creation-hardware"].requiredLevel, 2);
  assert.equal(source["innovation-cells"].requiredLevel, 2);
  assert.equal(source["power-cradle"].requiredLevel, 1);
});

test("interprets the special Evolution requirement formula as level 1", () => {
  for (const id of ["evolution-gens", "evolution-lp", "evolution-stability", "evolution-resonance"]) {
    assert.equal(source[id].requiredLevel, 1, `${id} should require Evolution Gem level 1`);
  }
});
