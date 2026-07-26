import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("uses the correct CIFI names for AP and MP", () => {
  assert.match(pageSource, /label: "Academy Points"/);
  assert.match(pageSource, /label: "Mod Points"/);
  assert.doesNotMatch(pageSource, /Ascension Points?|Matter Points?/);
});
