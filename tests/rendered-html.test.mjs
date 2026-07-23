import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const pagesRoot = new URL("../pages-dist/", import.meta.url);

test("builds a GitHub Pages entry point with community metadata", async () => {
  const html = await readFile(new URL("index.html", pagesRoot), "utf8");

  assert.match(html, /<title>CIFI Gem Planner<\/title>/i);
  assert.match(html, /id=["']root["']/i);
  assert.match(html, /deathsunset\.github\.io\/cifi-gem-planner/i);
  assert.match(html, /og-community\.png/i);
  assert.doesNotMatch(html, /codex-preview/i);
});

test("publishes every user-facing Gem asset", async () => {
  const gems = ["creation", "evolution", "temporal", "exodus", "attraction", "innovation", "power"];

  await Promise.all([
    access(new URL("gem-planner-mark.png", pagesRoot)),
    access(new URL("og-community.png", pagesRoot)),
    ...gems.map((gem) => access(new URL(`gem-${gem}.png`, pagesRoot))),
  ]);
});

test("keeps the public disclaimer, credits and browser-only privacy note", async () => {
  const [page, readme, workflow, assetFiles] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("README.md", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
    readdir(pagesRoot),
  ]);

  assert.match(page, /Unofficial, non-commercial community tool/);
  assert.match(page, /Not affiliated with or endorsed by Octocube Games/);
  assert.match(page, /Original community Gem Planner spreadsheet/);
  assert.match(page, /Your progression stays in this browser/);
  assert.match(readme, /CIFI is created by/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.ok(assetFiles.includes(".nojekyll"));
});
