#!/usr/bin/env python3
from pathlib import Path
import pandas as pd
import re
import unicodedata

IN_FILE  = Path("budgets_cleaned.xlsx")
OUT_FILE = Path("budgets_daily.xlsx")
DEBUG_FILE = Path("planned_debug.csv")

START_COL = "Min Start Date"
END_COL   = "Max End Date"
FX_YEAR_COL = "FX Year"
PLANNED_COL = "Planned (Local)"

PRORATE_COLS = [
    "Budget (Local - Updated)",
    "Budget (Local)",
    "Planned (Local)",
    "Actualised (Local)",
    "Budget (EUR)",
    "Planned (EUR)",
    "Actualised (EUR)",
    "Budget (DKK)",
    "Planned (DKK)",
    "Actualised (DKK)",
]

# remove control/unicode whitespace, normalize
def clean_header(s):
    if pd.isna(s):
        return s
    s = str(s)
    s = unicodedata.normalize("NFKC", s)
    # replace non-breaking spaces and other unicode spaces with normal spaces
    s = re.sub(r"\s+", " ", s)
    return s.strip()

# tolerant numeric parser with many edge cases
_num_re = re.compile(r"[^\d\-\.\(\)]+")

def parse_number(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    if s == "":
        return None
    s = unicodedata.normalize("NFKC", s)
    s = s.replace("\xa0", "")  # NBSP
    # common placeholders -> treat as missing
    if s in ("-", "—", "–", "NA", "N/A", "n/a", "na", "--"):
        return None
    # remove currency symbols and commas but keep parentheses/minus/dot
    s = _num_re.sub("", s)
    if s == "":
        return None
    if s.startswith("(") and s.endswith(")"):
        s = "-" + s[1:-1]
    try:
        return float(s)
    except Exception:
        return None

def main():
    df_raw = pd.read_excel(IN_FILE, sheet_name=0, dtype="object")

    # normalize headers
    df_raw.columns = [clean_header(c) for c in df_raw.columns]
    df = df_raw.copy()

    # ensure PRORATE_COLS use normalized names if variants exist
    mapped_prorate = []
    for col in PRORATE_COLS:
        col_n = clean_header(col)
        if col_n in df.columns:
            mapped_prorate.append(col_n)
    # ensure planned col normalized
    planned_col = clean_header(PLANNED_COL)

    # validate date cols
    if clean_header(START_COL) not in df.columns or clean_header(END_COL) not in df.columns:
        raise SystemExit(f"Missing required date columns after header normalisation. Found: {list(df.columns)}")
    START = clean_header(START_COL)
    END = clean_header(END_COL)

    df[START] = pd.to_datetime(df[START], errors="coerce")
    df[END]   = pd.to_datetime(df[END], errors="coerce")

    out_rows = []
    debug_rows = []

    total_input_planned_count = 0
    total_emitted_planned_positive = 0

    for ix, row in df.iterrows():
        s = row[START]
        e = row[END]

        if pd.isna(s) or pd.isna(e):
            fy = row.get(clean_header(FX_YEAR_COL))
            try:
                y = int(float(str(fy)))
                s = pd.Timestamp(y, 1, 1)
                e = pd.Timestamp(y, 12, 31)
            except Exception:
                base = row.copy()
                for col in mapped_prorate:
                    base[col] = 0.0
                base["Date"] = pd.NaT
                out_rows.append(base)
                # collect debug if original had planned-like content
                orig_planned = row.get(planned_col) if planned_col in row.index else None
                if orig_planned not in (None, "", pd.NA) and str(orig_planned).strip() != "":
                    debug_rows.append(dict(row))
                continue

        days = pd.date_range(s.normalize(), e.normalize(), freq="D")
        n = max(1, len(days))
        base = row.copy()

        # before prorating, record if original planned had content
        orig_planned_val = row.get(planned_col) if planned_col in row.index else None
        orig_parsed = parse_number(orig_planned_val) if orig_planned_val is not None else None
        if orig_parsed is not None:
            total_input_planned_count += 1

        for col in mapped_prorate:
            val = parse_number(base[col]) if col in base.index else None
            if val is None:
                base[col] = 0.0
            else:
                base[col] = val / n

        # after prorating, check emitted planned positive (sum across days will equal original)
        if planned_col in base.index:
            # if original had value, count emitted positive (non-zero)
            if orig_parsed is not None and orig_parsed != 0:
                total_emitted_planned_positive += 1

        for d in days:
            rr = base.copy()
            rr["Date"] = d
            out_rows.append(rr)

    out = pd.DataFrame(out_rows)

    # Insert Date after Max End Date
    orig_cols = list(df.columns)
    if END in orig_cols:
        idx = orig_cols.index(END) + 1
        cols = orig_cols[:idx] + ["Date"] + orig_cols[idx:]
    else:
        cols = ["Date"] + orig_cols

    final_cols = [c for c in cols if c in out.columns] + [c for c in out.columns if c not in cols]
    out = out.reindex(columns=final_cols)

    # write outputs
    with pd.ExcelWriter(OUT_FILE, engine="xlsxwriter", datetime_format="yyyy-mm-dd") as xw:
        out.to_excel(xw, index=False, sheet_name="fact_budget_daily")

    if debug_rows:
        pd.DataFrame(debug_rows).to_csv(DEBUG_FILE, index=False)

    print(f"Wrote {OUT_FILE.resolve()} with {len(out):,} rows.")
    print(f"Original rows with parseable '{PLANNED_COL}': {total_input_planned_count}")
    print(f"Rows where parsed planned existed and were emitted (counted): {total_emitted_planned_positive}")
    if DEBUG_FILE.exists():
        print(f"Saved problem rows to {DEBUG_FILE.resolve()} (non-empty original planned but fallback path used).")

if __name__ == "__main__":
    main()
