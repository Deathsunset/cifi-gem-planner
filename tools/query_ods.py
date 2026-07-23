import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")


def split_address(address):
    match = re.fullmatch(r"([A-Z]+)(\d+)", address)
    column = 0
    for char in match.group(1):
        column = column * 26 + ord(char) - 64
    return column, int(match.group(2))


data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if sys.argv[2] == "named":
    print(json.dumps(data["named_ranges"], indent=2, ensure_ascii=False))
else:
    sheet, row_start, row_end, col_start, col_end = sys.argv[2], *map(int, sys.argv[3:7])
    cells = data["sheets"][sheet]["cells"]
    selected = []
    for address, payload in cells.items():
        column, row = split_address(address)
        if row_start <= row <= row_end and col_start <= column <= col_end:
            selected.append({"address": address, **payload})
    selected.sort(key=lambda item: (split_address(item["address"])[1], split_address(item["address"])[0]))
    print(json.dumps(selected, indent=2, ensure_ascii=False))
