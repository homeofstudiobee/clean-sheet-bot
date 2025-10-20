#!/usr/bin/env python3
# dcqa_brand_two_pass.py
# Two-pass brand resolution:
#   Pass A: taxonomy alias mapping with market context
#   Pass B: title match (Plan Name + Campaign Name)
# Outputs Clean + Issues workbooks in output/

import sys, re
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
import unicodedata

# ----- paths -----
BASE = Path(__file__).resolve().parents[1]
IN_DIR  = BASE / "input" / "raw"
TAX_DIR = BASE / "taxonomy"
OUT_DIR = BASE / "output"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ----- text normalisation -----
_PUNCT = dict.fromkeys(map(ord, '“”‘’′´`"\\\'’–—‑-·•.,;:!/?()[]{}|+&@#%^*~=_'), ' ')
_SPECIALS = {'™':'', '®':'', '©':'', '℠':'', '\u00A0':' '}

def _strip_accents(s: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", s) if not unicodedata.combining(ch))

def norm(s: str) -> str:
    if s is None:
        return ""
    s = str(s)
    s = s.translate(str.maketrans(_SPECIALS))
    s = _strip_accents(s)
    s = s.translate(_PUNCT)
    s = s.casefold()
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# ----- taxonomy load -----
def load_brands_taxonomy(path: Path) -> pd.DataFrame:
    # Tolerant loader: UTF-8 with BOM or plain UTF-8; everything to string
    try:
        df = pd.read_csv(path, encoding='utf-8-sig', dtype=str, keep_default_na=False)
    except Exception:
        df = pd.read_csv(path, encoding='utf-8', dtype=str, keep_default_na=False)
    cols = {c:str(c).strip().lower() for c in df.columns}
    df = df.rename(columns=cols)
    # canonical fields
    if 'brand_canonical' not in df.columns:
        raise ValueError("brands.csv must contain 'brand_canonical'")
    if 'alias' not in df.columns:
        # try infer alias column as "name" or first unknown
        cand = next((c for c in df.columns if c not in ['brand_id','brand_canonical','market']), None)
        if cand:
            df = df.rename(columns={cand: 'alias'})
        else:
            df['alias'] = df['brand_canonical']
    if 'market' not in df.columns:
        df['market'] = ''
    df = df[['brand_canonical','market','alias']].copy()
    for c in df.columns:
        df[c] = df[c].astype(str)
    return df

def build_index(brands: pd.DataFrame):
    idx = {}
    canons = set()
    for _, r in brands.iterrows():
        canon = r['brand_canonical'].strip()
        alias = r['alias'].strip() or canon
        market = r['market'].strip()
        if not canon:
            continue
        canons.add(canon)
        key_g = (None, norm(alias))
        if key_g not in idx:
            idx[key_g] = canon
        if market:
            key_l = (norm(market), norm(alias))
            if key_l not in idx:
                idx[key_l] = canon
        # also index the canonical itself as alias
        key_g2 = (None, norm(canon))
        idx.setdefault(key_g2, canon)
        if market:
            key_l2 = (norm(market), norm(canon))
            idx.setdefault(key_l2, canon)
    return idx, sorted(canons)

# ----- title-based detection -----
def detect_from_titles(plan_name: str, campaign_name: str, market: str, idx, canon_list):
    text = f"{plan_name or ''} {campaign_name or ''}"
    t = norm(text)
    m = norm(market)
    hits = []
    # prefer market-local matches on canonical names
    for canon in canon_list:
        ncanon = norm(canon)
        if ncanon and ncanon in t and len(ncanon) >= 4:
            hits.append((canon, 'title_contains_canon'))
    # also allow alias matches
    # build alias sets
    local_aliases = [alias for (mk, alias) in idx.keys() if mk == (m or None)]
    global_aliases = [alias for (mk, alias) in idx.keys() if mk is None]
    for alias in local_aliases + global_aliases:
        if alias and alias in t and len(alias) >= 4:
            canon = idx[(m if (m, alias) in idx else None, alias)]
            hits.append((canon, 'title_contains_alias'))
    if not hits:
        return None, ''
    # de-duplicate preserving order; if multiple distinct canons, ambiguous
    seen = []
    reasons = {}
    for canon, reason in hits:
        if canon not in seen:
            seen.append(canon)
            reasons[canon] = reason
    if len(seen) == 1:
        return seen[0], reasons[seen[0]]
    # choose the longest token match to break ties, but mark ambiguous
    seen_sorted = sorted(seen, key=lambda s: len(s), reverse=True)
    return seen_sorted[0], 'title_ambiguous'

# ----- plans loader -----
def latest(pattern: str):
    files = sorted(IN_DIR.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    files = [p for p in files if not p.name.startswith('~$')]
    return files[0] if files else None

def read_xlsx_first(path: Path) -> pd.DataFrame:
    xls = pd.ExcelFile(path, engine='openpyxl')
    df = xls.parse(xls.sheet_names[0])
    return df

# ----- main pass -----
def two_pass_brand(df: pd.DataFrame, brands_df: pd.DataFrame) -> pd.DataFrame:
    # ensure columns
    for c in ['Brand','Market','Plan Name','Campaign Name']:
        if c not in df.columns:
            # best-effort: case-insensitive rename
            lc = {str(col).lower(): col for col in df.columns}
            if c.lower() in lc:
                df = df.rename(columns={lc[c.lower()]: c})
            else:
                df[c] = ''
    idx, canon_list = build_index(brands_df)

    results = []
    for i, r in df.iterrows():
        brand_raw = r.get('Brand','')
        market = r.get('Market','')
        plan = r.get('Plan Name','')
        camp = r.get('Campaign Name','')

        b = norm(brand_raw)
        m = norm(market)

        # Pass A: taxonomy mapping
        mapped = None
        reasonA = ''
        if (m or None, b) in idx:
            mapped, reasonA = idx[(m or None, b)], 'tax_exact_local'
        elif (None, b) in idx:
            mapped, reasonA = idx[(None, b)], 'tax_exact_global'
        else:
            # equality to canonical directly
            for canon in canon_list:
                if norm(canon) == b and canon_list:
                    mapped, reasonA = canon, 'tax_canonical_equal'
                    break

        # Pass B: title detection
        title_brand, reasonB = detect_from_titles(plan, camp, market, idx, canon_list)

        # Decide final + issue
        final = mapped or title_brand or ''
        issue = ''
        recommend = ''

        if mapped and title_brand and mapped != title_brand:
            issue = 'brand_conflict_title'
            recommend = f"Check Market/Brand. Taxonomy maps to '{mapped}', titles suggest '{title_brand}'."
        elif not mapped and title_brand:
            issue = 'brand_inferred_from_title'
            recommend = f"Consider '{title_brand}' (from titles). Add alias to taxonomy if correct."
        elif mapped and not title_brand:
            # if campaign and plan empty of brand reference, okay; else note missing
            issue = 'brand_ok_no_title_signal'
        elif not mapped and not title_brand:
            issue = 'brand_unmapped'
            recommend = "Add alias to taxonomy or fix Brand field."

        results.append({
            'Brand_raw': brand_raw,
            'Market': market,
            'Plan Name': plan,
            'Campaign Name': camp,
            'Brand_taxonomy': mapped or '',
            'Brand_title': title_brand or '',
            'Brand_final': final,
            'Reason_tax': reasonA,
            'Reason_title': reasonB,
            'Issue': issue,
            'Recommendation': recommend
        })
    out = pd.DataFrame(results, index=df.index)
    # merge back with original columns for Clean sheet
    clean = df.copy()
    for c in ['Brand_taxonomy','Brand_title','Brand_final','Reason_tax','Reason_title']:
        clean[c] = out[c]
    return clean, out

def main():
    brands_csv = TAX_DIR / "brands.csv"
    if not brands_csv.exists():
        print(f"Missing taxonomy file: {brands_csv}")
        sys.exit(2)
    brands_df = load_brands_taxonomy(brands_csv)

    plans = latest("plans_*.xlsx")
    if not plans:
        print(f"No plans_*.xlsx in {IN_DIR}")
        sys.exit(0)
    print(f"Loading {plans.name}")
    df = read_xlsx_first(plans)

    clean, issues = two_pass_brand(df, brands_df)

    stamp = datetime.now().strftime("%Y-%m-%d")
    x_out = OUT_DIR / f"Plans_TwoPass_{stamp}.xlsx"
    with pd.ExcelWriter(x_out, engine='openpyxl') as wb:
        clean.to_excel(wb, sheet_name='Clean', index=False)
        issues.to_excel(wb, sheet_name='Brand_Issues', index=False)
    print("Wrote", x_out)

if __name__ == "__main__":
    main()