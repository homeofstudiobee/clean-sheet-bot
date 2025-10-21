#!/usr/bin/env python3
from pathlib import Path
import shutil

BASE    = Path(__file__).resolve().parents[1]
OUT_DIR = BASE / "output"
TAX_DIR = BASE / "taxonomy"

# This is a simple helper that copies any user-curated "todo_*.csv"
# back into the canonical taxonomy CSVs after review (append unique).
# You can open the todo_* files, fill the canonical columns, then run this.

def append_unique(src: Path, dest: Path, key_cols):
    import pandas as pd
    if not src.exists(): return
    s = pd.read_csv(src, dtype=str).fillna("")
    if dest.exists():
        d = pd.read_csv(dest, dtype=str).fillna("")
    else:
        d = s.iloc[0:0].copy()
    # align columns
    for c in set(s.columns) - set(d.columns): d[c]=""
    for c in set(d.columns) - set(s.columns): s[c]=""
    both = pd.concat([d, s], ignore_index=True)
    both = both.drop_duplicates(subset=key_cols, keep="first")
    both.to_csv(dest, index=False, encoding="utf-8-sig")
    print(f"Updated {dest.name}: {len(both)} rows")

def main():
    append_unique(OUT_DIR/"todo_brands.csv", TAX_DIR/"brands.csv", ["market","raw_brand","raw_variant"])
    append_unique(OUT_DIR/"todo_vendors.csv", TAX_DIR/"vendors.csv", ["raw_vendor"])
    append_unique(OUT_DIR/"todo_channels.csv", TAX_DIR/"channels.csv", ["Channel","Sub-Channel"])
    append_unique(OUT_DIR/"todo_cbht.csv", TAX_DIR/"cbht.csv", ["brand","market","fx_year"])
    print("Applied fixes into taxonomy CSVs.")

if __name__ == "__main__":
    main()