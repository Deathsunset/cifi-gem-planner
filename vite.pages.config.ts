import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const publicAssets = [
  "favicon.svg",
  "gem-planner-mark.png",
  "gem-creation.png",
  "gem-evolution.png",
  "gem-temporal.png",
  "gem-exodus.png",
  "gem-attraction.png",
  "gem-innovation.png",
  "gem-power.png",
  "og-community.png",
];

export default defineConfig({
  base: "/cifi-gem-planner/",
  plugins: [
    react(),
    {
      name: "github-pages-public-assets",
      closeBundle() {
        mkdirSync("pages-dist", { recursive: true });
        for (const asset of publicAssets) copyFileSync(join("public", asset), join("pages-dist", asset));
        writeFileSync(join("pages-dist", ".nojekyll"), "");
      },
    },
  ],
  publicDir: false,
  build: {
    outDir: "pages-dist",
    emptyOutDir: true,
  },
});
