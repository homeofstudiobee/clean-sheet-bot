#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
from datetime import datetime

BASE    = Path(__file__).resolve().parents[1]
OUT_DIR = BASE / "output"
TAX_DIR = BASE / "taxonomy"

def main():
    exc = OUT_DIR / "Exceptions.csv"
    if not exc.exists():
        print("No Exceptions.csv found. Run run_cleaning.py first."); return
    ex = pd.read_csv(exc, dtype=str).fillna("")

    # Create per-domain fix CSVs listing unique items to classify
    # Brands needing mapping
    unmapped_brand = ex[ex["Issue_Type"]=="brand_unmapped"]
    if not unmapped_brand.empty:
        cols = ["Market","Region","Plan_Name","Brand","Variant"]
        todo = unmapped_brand.merge(unmapped_brand, how="left")  # just clone to keep columns
        todo = todo.rename(columns={"Brand":"raw_brand","Variant":"raw_variant"})
        todo = todo[["Market","raw_brand","raw_variant"]].drop_duplicates()
        (OUT_DIR/"todo_brands.csv").write_text(todo.to_csv(index=False, encoding="utf-8-sig"))

    # Vendors
    unmapped_vendor = ex[ex["Issue_Type"]=="vendor_unmapped"]
    if not unmapped_vendor.empty:
        todo = unmapped_vendor.rename(columns={"Current_Value":"raw_vendor"})
        todo = todo[["raw_vendor"]].drop_duplicates()
        (OUT_DIR/"todo_vendors.csv").write_text(todo.to_csv(index=False, encoding="utf-8-sig"))

    # Channels
    unmapped_chan = ex[ex["Issue_Type"]=="channel_unmapped"]
    if not unmapped_chan.empty:
        todo = unmapped_chan[["Current_Value"]].drop_duplicates()
        todo[["Channel","Sub-Channel"]] = todo["Current_Value"].str.split("|", n=1, expand=True)
        (OUT_DIR/"todo_channels.csv").write_text(todo.to_csv(index=False, encoding="utf-8-sig"))

    # CBHT
    miss_cbht = ex[ex["Issue_Type"]=="cbht_missing"]
    if not miss_cbht.empty:
        todo = miss_cbht.rename(columns={"Current_Value":"brand"})
        todo = todo[["brand","Market","FX_Year"]].drop_duplicates()
        (OUT_DIR/"todo_cbht.csv").write_text(todo.to_csv(index=False, encoding="utf-8-sig"))

    print("Fix-pack CSVs created in output/ (todo_*.csv)")

if __name__ == "__main__":
    main()