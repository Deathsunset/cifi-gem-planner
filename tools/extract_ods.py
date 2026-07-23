import json
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "office": "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    "table": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "text": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}


def q(prefix, name):
    return f"{{{NS[prefix]}}}{name}"


def column_name(number):
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def cell_text(cell):
    texts = []
    for paragraph in cell.findall(".//text:p", NS):
        value = "".join(paragraph.itertext()).strip()
        if value:
            texts.append(value)
    return "\n".join(texts)


def main(source, destination):
    with zipfile.ZipFile(source) as archive:
        root = ET.fromstring(archive.read("content.xml"))

    output = {"source": str(source), "named_ranges": [], "sheets": {}}
    for named in root.findall(".//table:named-range", NS):
        output["named_ranges"].append({
            "name": named.get(q("table", "name")),
            "range": named.get(q("table", "cell-range-address")),
            "base": named.get(q("table", "base-cell-address")),
        })

    for sheet in root.findall(".//table:table", NS):
        name = sheet.get(q("table", "name"))
        sparse = {}
        row_number = 0
        for row in sheet.findall("table:table-row", NS):
            row_repeat = int(row.get(q("table", "number-rows-repeated"), "1"))
            template_cells = []
            column_number = 0
            for cell in list(row):
                if cell.tag not in {q("table", "table-cell"), q("table", "covered-table-cell")}:
                    continue
                col_repeat = int(cell.get(q("table", "number-columns-repeated"), "1"))
                formula = cell.get(q("table", "formula"))
                value_type = cell.get(q("office", "value-type"))
                value = (
                    cell.get(q("office", "value"))
                    or cell.get(q("office", "date-value"))
                    or cell.get(q("office", "time-value"))
                    or cell.get(q("office", "boolean-value"))
                    or cell.get(q("office", "string-value"))
                )
                text = cell_text(cell)
                for offset in range(min(col_repeat, 512)):
                    column_number += 1
                    if formula or value is not None or text:
                        template_cells.append((column_number, {
                            "text": text,
                            "value": value,
                            "type": value_type,
                            "formula": formula,
                        }))
            for _ in range(min(row_repeat, 2000)):
                row_number += 1
                if template_cells:
                    for column, payload in template_cells:
                        sparse[f"{column_name(column)}{row_number}"] = payload
        output["sheets"][name] = {"rows": row_number, "cells": sparse}

    Path(destination).write_text(json.dumps(output, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({
        "sheets": {name: {"rows": data["rows"], "nonempty": len(data["cells"])} for name, data in output["sheets"].items()},
        "named_ranges": len(output["named_ranges"]),
        "destination": str(destination),
    }, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
