import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("keeps the externally referenced Gem card order", () => {
  assert.match(
    pageSource,
    /const GEM_NAMES = \["Exodus", "Temporal", "Innovation", "Power", "Attraction", "Creation", "Evolution"\] as const;/,
  );
});
