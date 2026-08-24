import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const caps = JSON.parse(await readFile(new URL("../app/source-upgrade-caps.json", import.meta.url), "utf8"));

test("stores a real maximum level for every Gem and upgrade", () => {
  assert.equal(Object.keys(caps).length, 59);
  for (const [id, maximum] of Object.entries(caps)) {
    assert.match(id, /^[a-z]+-[a-z0-9-]+$/);
    assert.ok(Number.isInteger(maximum) && maximum > 0, `${id} should have a positive integer cap`);
  }
});

test("keeps the externally referenced exceptional caps", () => {
  assert.equal(caps["temporal-quality"], 4);
  assert.equal(caps["exodus-cells"], 999);
  assert.equal(caps["temporal-zag-ranks"], 10);
  assert.equal(caps["attraction-catch-up"], 5);
  assert.equal(caps["attraction-gu3"], 100);
  assert.equal(caps["creation-trinkets"], 80);
  assert.equal(caps["evolution-stability"], 36);
  assert.equal(caps["evolution-lp"], 250);
});
