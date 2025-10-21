#!/usr/bin/env python3
from pathlib import Path
import pandas as pd

IN_FILE  = Path("plans_cleaned.xlsx")
OUT_FILE = Path("plans_cleaned_daily.xlsx")

# Daily-prorated numeric columns (present -> prorated, missing -> ignored)
PRORATE_COLS = [
    "Impressions_Estimate",
    "Views",
    "Completed_Views",
    "Agency_Fee",
    "Total_Cost_to_Client_Actual_Local",
    "Total_Cost_to_Client_Actual_Global",
    "Total_Cost_to_Client_Local",
    "Total_Cost_to_Client_Global",
    "Net_Media_Cost_Local",
    "Net_Media_Cost_Global",
    "Media_Cost_Gross_Local",
    "Non_Media_Cost_Local",
    "Production_Costs_Local",
    "Net_Media_DKK",
    "Planned_Spend_DKK",
    "Actualised_Spend_DKK",
]

START_COL = "Start_Date"
END_COL   = "End_Date"

def to_float_safe(v):
    if pd.isna(v):
        return v
    s = str(v).replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return v  # leave untouched if not numeric

def main():
    df = pd.read_excel(IN_FILE, sheet_name=0, dtype="object")

    # Validate date columns
    for c in (START_COL, END_COL):
        if c not in df.columns:
            raise SystemExit(f"Missing column: {c}")
    df[START_COL] = pd.to_datetime(df[START_COL], errors="coerce")
    df[END_COL]   = pd.to_datetime(df[END_COL], errors="coerce")

    out_rows = []

    for _, r in df.iterrows():
        s = r[START_COL]
        e = r[END_COL]

        # If no valid dates, pass-through row with Date = NaT
        if pd.isna(s) or pd.isna(e):
            rr = r.copy()
            rr["Date"] = pd.NaT
            out_rows.append(rr)
            continue

        # Inclusive daily range
        days = pd.date_range(s.normalize(), e.normalize(), freq="D")
        n = max(1, len(days))

        base = r.copy()

        # Prorate only the columns that exist in the file
        for c in PRORATE_COLS:
            if c in base.index:
                base[c] = to_float_safe(base[c])
                if isinstance(base[c], (int, float)) or (
                    isinstance(base[c], float) and not pd.isna(base[c])
                ):
                    base[c] = base[c] / n

        for d in days:
            rr = base.copy()
            rr["Date"] = d
            out_rows.append(rr)

    out = pd.DataFrame(out_rows)

    # Insert Date after End_Date
    orig_cols = list(df.columns)
    if END_COL in orig_cols:
        idx = orig_cols.index(END_COL) + 1
        cols = orig_cols[:idx] + ["Date"] + orig_cols[idx:]
    else:
        cols = ["Date"] + orig_cols  # fallback

    out = out.reindex(columns=cols)

    with pd.ExcelWriter(OUT_FILE, engine="xlsxwriter", datetime_format="yyyy-mm-dd") as xw:
        out.to_excel(xw, index=False, sheet_name="fact_media_plan_daily")

    print(f"Wrote {OUT_FILE.resolve()} with {len(out):,} rows.")

if __name__ == "__main__":
    main()