import json
import math
import re
from pathlib import Path


SOURCE = Path(__file__).with_name("ods_extract.json")
DESTINATION = Path(__file__).parents[1] / "app" / "source-gem-data.json"
NODE_DESTINATION = Path(__file__).parents[1] / "app" / "source-gem-nodes.json"

CONFIG = {
    "Exodus": {
        "sheet": "ExodusData", "rows": range(9, 17),
        "ids": ["quality", "cells", "shards", "rp", "mp", "ap", "mats", "orbs"],
    },
    "Temporal": {
        "sheet": "TemporalData", "rows": range(18, 25),
        "ids": ["quality", "lms", "ticks", "zag-ranks", "lm-max", "zag-crew", "lrs"],
    },
    "Innovation": {
        "sheet": "InnovationData", "rows": range(26, 36),
        "ids": ["quality", "studies", "cells", "mp", "shards", "rp", "ap", "mats", "blueprints", "cores"],
    },
    "Attraction": {
        "sheet": "AttractionData", "rows": range(37, 44),
        "ids": ["quality", "borge", "ozzy", "catch-up", "gu1", "gu2", "gu3"],
    },
    "Creation": {
        "sheet": "CreationData", "rows": range(45, 57),
        "ids": ["quality", "mech-cap", "hardware", "software", "cells", "mp", "shards", "rp", "trinkets", "borge", "ozzy", "knox"],
    },
    "Power": {
        "sheet": "PowerData", "rows": range(58, 68),
        "ids": ["quality", "cradle", "aux", "zag", "hephaestus", "demeter", "koios", "zeus", "blueprints", "cores"],
    },
    "Evolution": {
        "sheet": "EvoData", "rows": range(69, 74),
        "ids": ["quality", "gens", "lp", "stability", "resonance"],
    },
}


def column_name(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def numeric(payload, fallback=0):
    if not payload or payload.get("value") in (None, ""):
        return fallback
    try:
        value = float(payload["value"])
        return value if math.isfinite(value) else 1e308
    except (TypeError, ValueError):
        return fallback


def cost_curve(cells, pair_index):
    if pair_index == 0:
        level_column, cost_column = 2, 3
    else:
        level_column = 7 + (pair_index - 1) * 4
        cost_column = level_column + 1
    levels = []
    for row in range(9, 2001):
        level = cells.get(f"{column_name(level_column)}{row}")
        cost = cells.get(f"{column_name(cost_column)}{row}")
        if not level or not cost:
            continue
        level_number = numeric(level, -1)
        cost_number = numeric(cost, -1)
        if level_number < 0 or cost_number < 0 or level_number != int(level_number):
            continue
        level_number = int(level_number)
        while len(levels) <= level_number:
            levels.append(None)
        levels[level_number] = min(cost_number, 1e308)
    while levels and levels[-1] is None:
        levels.pop()
    return [value if value is not None else 1e308 for value in levels]


source = json.loads(SOURCE.read_text(encoding="utf-8"))
main = source["sheets"]["MainSheet"]["cells"]
result = {}
for gem, config in CONFIG.items():
    data_cells = source["sheets"][config["sheet"]]["cells"]
    for pair_index, (row, short_id) in enumerate(zip(config["rows"], config["ids"])):
        key = f"{gem.lower()}-{short_id}"
        formula = (main.get(f"K{row}") or {}).get("formula") or ""
        requirement = re.search(r"(?:Exo|Temp|Inno|Att|Cre|Power|Evo)Level\s*>=\s*(\d+)", formula, re.IGNORECASE)
        curve = cost_curve(data_cells, pair_index)
        default_level = int(numeric(main.get(f"P{row}"), 0))
        sheet_rank_cost = numeric(main.get(f"AI{row}"), curve[default_level] if default_level < len(curve) else 0)
        reference_cost = curve[default_level] if default_level < len(curve) else sheet_rank_cost
        source_score = numeric(main.get(f"AG{row}"), 0)
        bonus_cell = main.get(f"AB{row}") or {}
        bonus_lines = [line.strip() for line in (bonus_cell.get("text") or "").splitlines() if line.strip()]
        bonus_text = bonus_lines[-1] if bonus_lines else ""
        if source_score > 0 and sheet_rank_cost > 0 and reference_cost > 0:
            source_score *= sheet_rank_cost / reference_cost
        result[key] = {
            "defaultLevel": default_level,
            "requiredLevel": int(requirement.group(1)) if requirement else 0,
            "costs": curve,
            "sourceScore": source_score,
            "referenceCost": reference_cost,
            "bonusText": bonus_text,
            "sourceRow": row,
        }

DESTINATION.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
locker = source["sheets"]["StorageLocker"]["cells"]
nodes = []
node_row = 9
for gem in ["Exodus", "Temporal", "Innovation", "Attraction", "Creation", "Power", "Evolution"]:
    for index in range(1, 7):
        nodes.append({
            "id": f"node-{gem.lower()}-{index}",
            "gem": gem,
            "index": index,
            "cost": numeric(locker.get(f"I{node_row}"), 0),
            "sourceOwned": bool(numeric(locker.get(f"J{node_row}"), 0)),
        })
        node_row += 1
NODE_DESTINATION.write_text(json.dumps(nodes, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
reconciled = [item for item in result.values() if item["defaultLevel"] < len(item["costs"]) and item["referenceCost"] > 0]
mismatches = [key for key, item in result.items() if item in reconciled and abs(item["costs"][item["defaultLevel"]] - item["referenceCost"]) / item["referenceCost"] > 1e-8]
print(json.dumps({
    "upgrades": len(result),
    "total_cost_points": sum(len(item["costs"]) for item in result.values()),
    "largest_curve": max(len(item["costs"]) for item in result.values()),
    "reconciled_next_costs": len(reconciled),
    "next_cost_mismatches": len(mismatches),
    "mismatch_ids": mismatches,
    "gem_nodes": len(nodes),
    "node_cost_total": sum(node["cost"] for node in nodes),
    "destination": str(DESTINATION),
}, indent=2))
