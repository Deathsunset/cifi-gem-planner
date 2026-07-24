# Gem Planner data sources

## Original community spreadsheet

Upgrade prices, current reference levels, bonuses, scores, Gem-level prerequisites, and node prices are extracted from the original community Gem Planner spreadsheet maintained by SirRed and Adam.

## Upgrade level caps

The maximum levels in `app/source-upgrade-caps.json` were transcribed on 2026-07-24 from a user-provided screenshot of an external CIFI planning tool. The screenshot displays a maximum-level badge beside every Gem upgrade.

These caps are intentionally stored separately from the spreadsheet-derived price curves. They may originate from information supplied by Octocube Games to that tool's creators, but this has not yet been confirmed. Until confirmed, treat them as a high-confidence external reference rather than official game data.

When a real cap extends beyond the available spreadsheet price curve, the web tool allows that value to be recorded as current progression but does not invent missing purchase prices or recommend purchases with an unknown price.

The Gem card order also follows the same reference: Exodus, Temporal, Innovation, Power, Attraction, Creation, and Evolution.
