#!/usr/bin/env python3
"""
convert_clues_to_js.py

Converts clues.db into a set of clues_data_partN.js files (each kept
under GitHub's 25MB web-upload limit) plus clues_manifest.js, which
lists the part filenames so game.js can load them all in order at
startup.

Usage:
    python3 convert_clues_to_js.py clues.db [output_directory]

If output_directory is omitted, files are written to the current
directory.
"""
import json
import os
import sqlite3
import sys
from os.path import getsize as _os_path_getsize

MAX_BYTES_PER_PART = 12 * 1024 * 1024  # extra safety margin under GitHub's 25MB cap


def main():
    db_path = sys.argv[1] if len(sys.argv) > 1 else "clues.db"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "."
    os.makedirs(out_dir, exist_ok=True)

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT category, value, clue_text, answer FROM clues
        WHERE value IS NOT NULL
          AND round != 'Final Jeopardy'
          AND clue_text != ''
          AND answer != ''
        """
    ).fetchall()
    conn.close()

    clues = [
        {
            "category": row["category"],
            "value": row["value"],
            "clue": row["clue_text"],
            "answer": row["answer"],
        }
        for row in rows
    ]

    part_files = []
    current_chunk = []
    current_size = 0
    part_index = 1

    def flush_chunk():
        nonlocal current_chunk, current_size, part_index
        if not current_chunk:
            return
        filename = f"clues_data_part{part_index}.js"
        path = f"{out_dir}/{filename}"
        with open(path, "w", encoding="utf-8") as f:
            if part_index == 1:
                f.write("window.JEOPARDY_CLUES = ")
            else:
                f.write("window.JEOPARDY_CLUES = window.JEOPARDY_CLUES.concat(")
            json.dump(current_chunk, f, ensure_ascii=False, separators=(",", ":"))
            f.write(";\n" if part_index == 1 else ");\n")
        part_files.append(filename)
        actual_size_mb = _os_path_getsize(path) / 1_000_000
        print(f"Wrote {len(current_chunk)} clues ({actual_size_mb:.1f} MB on disk) to {filename}")
        current_chunk = []
        current_size = 0
        part_index += 1

    for clue in clues:
        entry_size = len(json.dumps(clue, ensure_ascii=False).encode("utf-8"))
        if current_chunk and current_size + entry_size > MAX_BYTES_PER_PART:
            flush_chunk()
        current_chunk.append(clue)
        current_size += entry_size

    flush_chunk()

    manifest_path = f"{out_dir}/clues_manifest.js"
    with open(manifest_path, "w", encoding="utf-8") as f:
        f.write("window.JEOPARDY_CLUES_PARTS = ")
        json.dump(part_files, f)
        f.write(";\n")

    print(f"\nWrote {len(part_files)} part file(s) totaling {len(clues)} clues.")
    print("Upload ALL of these to GitHub, along with clues_manifest.js:")
    for name in part_files:
        print(f"  - {name}")
    print("  - clues_manifest.js")


if __name__ == "__main__":
    main()
