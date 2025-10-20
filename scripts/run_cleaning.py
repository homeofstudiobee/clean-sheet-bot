#!/usr/bin/env python3
# DC Data Quality – unified cleaner for plans & budgets
# - Reads input/raw/plans_*.xlsx and budgets_*.xlsx
# - Applies rules in rules/validation_rules.yaml
# - Uses taxonomy/*.csv (brands, campaigns, vendors, channels, fx_rates, cbht)
# - Outputs:
#     output/Plans_Clean_<YYYY-MM-DD>.xlsx (sheet: fact_media_plan)
#     output/Plans_QA_<YYYY-MM-DD>.xlsx (Exceptions, MappingDiffs)
#     output/Exceptions.csv
#     output/Budgets_Clean_<YYYY-MM-DD>.xlsx
#     output/Budgets_QA_<YYYY-MM-DD>.xlsx
#
# Requirements (once):  pip install pandas openpyxl xlsxwriter pyyaml tqdm

import os, re, io
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np
import yaml
from tqdm import tqdm

# ---- Paths ----
BASE    = Path(__file__).resolve().parents[1]
IN_DIR  = BASE / "input" / "raw"
OUT_DIR = BASE / "output"
TAX_DIR = BASE / "taxonomy"
RULES_YAML = BASE / "rules" / "validation_rules.yaml"
TODAY = datetime.now().strftime("%Y-%m-%d")

# ---- IO helpers ----
def read_excel_first(path: Path) -> pd.DataFrame:
    xls = pd.ExcelFile(path, engine="openpyxl")
    df0 = xls.parse(xls.sheet_names[0], header=None)
    header_row = None
    for i in range(min(30, len(df0))):
        row = [str(x).strip().lower() for x in df0.iloc[i].tolist() if str(x) != "None"]
        if any(k in " ".join(row) for k in ["plan", "market", "brand", "start", "end", "currency", "vendor"]):
            header_row = i; break
    df = xls.parse(xls.sheet_names[0], header=header_row)

    # normalise & de-dup column names
    cols, seen = [], {}
    for c in df.columns.astype(str):
        cc = re.sub(r"\s+", " ", c.strip())
        if cc in seen:
            seen[cc] += 1
            cc = f"{cc}__{seen[cc]}"
        else:
            seen[cc] = 0
        cols.append(cc)
    df.columns = cols
    return df

def safe_read_csv(path: Path, usecols=None):
    encs = ["utf-8-sig", "utf-8", "cp1252", "latin1"]
    for e in encs:
        try:
            return pd.read_csv(path, dtype=str, usecols=usecols, encoding=e).fillna("")
        except Exception:
            pass
    s = path.read_bytes().decode("utf-8", "replace")
    return pd.read_csv(io.StringIO(s), dtype=str, usecols=usecols).fillna("")

def save_excel(path: Path, sheets: dict[str, pd.DataFrame]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(path, engine="xlsxwriter", options={"strings_to_numbers": False}) as xw:
        for name, df in sheets.items():
            df.to_excel(xw, sheet_name=name[:31], index=False)

# ---- Coercion ----
def coerce_dates(df: pd.DataFrame, cols):
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_datetime(df[c], errors="coerce", dayfirst=True)
    return df

def coerce_numeric_cols(df: pd.DataFrame):
    # infer numeric-like by column name
    pat = r"(cost|spend|views|impressions|fee|percent|rate|eur|dkk|cpm|vcr|reach|frequency|budget)"
    num_like = [c for c in df.columns if re.search(pat, c, re.I)]
    for c in num_like:
        s = df[c].astype(str)
        s = s.str.replace(r"[,%€$£ ]", "", regex=True)
        s = s.str.replace(r"[^\d\.\-]", "", regex=True)
        df[c] = pd.to_numeric(s, errors="coerce")
    return df

def add_fx_year_from_filename(df: pd.DataFrame, filename: str):
    m = re.search(r"(20\d{2})", filename)
    if m and "FX_Year" not in df.columns:
        df["FX_Year"] = int(m.group(1))
    return df

# ---- Rules & QA ----
def load_rules() -> dict:
    with open(RULES_YAML, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def qa_event(row, field, issue, current="", suggested="", owner="Analytics", priority="P3", extra=None):
    d = {
        "Market": row.get("Market",""),
        "Region": row.get("Region",""),
        "FX_Year": row.get("FX_Year",""),
        "Plan_ID": row.get("Plan ID",""),
        "Plan_Name": row.get("Plan Name",""),
        "Field": field,
        "Issue_Type": issue,
        "Current_Value": current,
        "Suggested_Value": suggested,
        "Priority": priority,
        "Owner": owner,
        "Notes": ""
    }
    if extra: d.update(extra)
    return d

# ---- Mapping utils ----
def brands_map(plans: pd.DataFrame, rules: dict, brands_df: pd.DataFrame, qa):
    out = plans.copy()

    # ensure *_clean columns exist
    for c in ["Brand_clean","Brand_Type","Category_clean","SubCategory_clean","Variant_clean"]:
        if c not in out.columns: out[c] = ""

    # prepare keys from input
    out["_raw_brand"]   = out.get("Brand","").astype(str).str.strip()
    out["_raw_variant"] = out.get("Variant","").astype(str).str.strip()
    out["_market"]      = out.get("Market","").astype(str).str.strip()

    # normalise taxonomy
    b = brands_df.copy()
    for c in ["raw_brand","raw_variant","market","region","brand_clean","brand_type","variant","category","subcategory"]:
        if c not in b.columns: b[c] = ""
        b[c] = b[c].astype(str).str.strip()

    precedence = rules.get("brand_mapping",{}).get("precedence",[])
    outputs    = rules.get("brand_mapping",{}).get("outputs",{})

    # iterative merge by precedence
    for keys in precedence:
        left_on, right_on = [], []
        for k in keys:
            if   k=="raw_brand":   left_on.append("_raw_brand")
            elif k=="raw_variant": left_on.append("_raw_variant")
            elif k=="market":      left_on.append("_market")
            else:                  left_on.append(k)
            right_on.append(k)

        m = out.merge(b, how="left", left_on=left_on, right_on=right_on, suffixes=("","_m"))

        for src, dst in outputs.items():
            if src not in m.columns: m[src] = ""
            fill = out[dst].astype(str).str.strip()==""
            out[dst] = np.where(fill, m[src].reindex(out.index).fillna(""), out[dst])

    # QA unmapped
    miss = out["Brand_clean"].astype(str).str.strip()==""
    for _, r in out.loc[miss].iterrows():
        qa.append(qa_event(r, "Brand", "brand_unmapped", current=r.get("Brand",""), owner="Analytics", priority="P2"))

    # plan-name brand conflict via hints
    hints = rules.get("brand_mapping",{}).get("conflict_hints",{}).get("brand_regex",{})
    out["__hint"] = ""
    if "Plan Name" in out.columns:
        for k, rgx in hints.items():
            hit = out["Plan Name"].astype(str).str.contains(rgx, regex=True, na=False)
            out.loc[hit & (out["__hint"]==""), "__hint"] = k
    conflict = (out["__hint"]!="") & (out["Brand_clean"].astype(str)!=out["__hint"].astype(str))
    for _, r in out.loc[conflict].iterrows():
        qa.append(qa_event(r, "Brand", "brand_conflict_with_plan_name",
                           current=r.get("Brand_clean",""), suggested=r.get("__hint",""),
                           owner="Analytics", priority="P2"))
    return out.drop(columns=["__hint"], errors="ignore")

def campaigns_map(plans: pd.DataFrame, rules: dict, camp_df: pd.DataFrame, qa):
    out = plans.copy()
    for c in ["Campaign_clean","Campaign_Type","Campaign_SubType"]:
        if c not in out.columns: out[c] = ""

    out["_raw_campaign"] = out.get("Campaign Name","").astype(str).str.strip()
    out["_market"]       = out.get("Market","").astype(str).str.strip()
    out["_brand"]        = out.get("Brand_clean","").astype(str).str.strip()

    c = camp_df.copy()
    for col in ["raw_campaign","raw_plan_name","market","brand","campaign_clean","campaign_type","campaign_subtype"]:
        if col not in c.columns: c[col] = ""
        c[col] = c[col].astype(str).str.strip()

    precedence = rules.get("campaign_mapping",{}).get("precedence",[])
    outputs    = rules.get("campaign_mapping",{}).get("outputs",{})

    for keys in precedence:
        left_on, right_on = [], []
        for k in keys:
            if   k=="raw_campaign": left_on.append("_raw_campaign")
            elif k=="market":       left_on.append("_market")
            elif k=="brand":        left_on.append("_brand")
            else:                   left_on.append(k)
            right_on.append(k)

        m = out.merge(c, how="left", left_on=left_on, right_on=right_on, suffixes=("","_cm"))
        for src, dst in outputs.items():
            if src not in m.columns: m[src] = ""
            mask = out[dst].astype(str).str.strip()==""
            # --- patched for index alignment ---
            if not isinstance(mask, pd.Series):
                mask = pd.Series(mask, index=out.index, dtype=bool)
            _aligned_m = m.reindex(out.index)
            out.loc[mask, dst] = _aligned_m.loc[mask, src].fillna("")
            # --- end patch ---
    # fallback to raw Campaign Name if still blank
    miss = out["Campaign_clean"].astype(str).str.strip()==""
    out.loc[miss, "Campaign_clean"] = out.loc[miss, "Campaign Name"].astype(str)
    for _, r in out.loc[miss].iterrows():
        qa.append(qa_event(r, "Campaign Name", "campaign_unmapped", current=r.get("Campaign Name",""), owner="Analytics", priority="P3"))
    return out

def vendors_map(plans: pd.DataFrame, rules: dict, vend_df: pd.DataFrame, qa):
    out = plans.copy()
    for c in ["Vendor_clean","Vendor_House","Vendor_Type"]:
        if c not in out.columns: out[c] = ""

    out["_raw_vendor"] = out.get("Vendor","").astype(str).str.strip()
    v = vend_df.copy()
    for col in ["raw_vendor","vendor_clean","vendor_house","vendor_type"]:
        if col not in v.columns: v[col] = ""
        v[col] = v[col].astype(str).str.strip()

    m = out.merge(v, how="left", left_on="_raw_vendor", right_on="raw_vendor", suffixes=("","_v"))
    for src, dst in [("vendor_clean","Vendor_clean"), ("vendor_house","Vendor_House"), ("vendor_type","Vendor_Type")]:
        fill = out[dst].astype(str).str.strip()==""
        # --- patched for index alignment ---
        if not isinstance(fill, pd.Series):
            fill = pd.Series(fill, index=out.index, dtype=bool)
        _aligned_m = m.reindex(out.index)
        out.loc[fill, dst] = _aligned_m.loc[fill, src].fillna("")
        # --- end patch ---
    # QA for unmapped vendors → _Placeholder
    miss = out["Vendor_clean"].astype(str).str.strip()==""
    out.loc[miss, "Vendor_clean"] = "_Placeholder"
    for _, r in out.loc[miss].iterrows():
        qa.append(qa_event(r, "Vendor", "vendor_unmapped", current=r.get("Vendor",""), suggested="_Placeholder", owner="Partnerships", priority="P2"))
    return out

def channels_map(plans: pd.DataFrame, rules: dict, ch_df: pd.DataFrame, qa):
    out = plans.copy()
    for c in ["Channel_clean","SubChannel_clean","ChannelFinanceGroup_clean","ExComChannel"]:
        if c not in out.columns: out[c] = ""

    cfg = rules.get("channel_rules",{})
    prefer = cfg.get("prefer_key","Sub-Channel")

    c = ch_df.copy()
    c = c.rename(columns={"ChannelFinanceGroup":"Channel Finance Group"})
    for col in ["Channel Finance Group","Channel","Sub-Channel","ExComChannel"]:
        if col not in c.columns: c[col] = ""
        c[col] = c[col].astype(str).str.strip()

    # 1st pass by preferred key
    if prefer in ["Sub-Channel","Channel"]:
        key = prefer
        m = out.merge(c, how="left", left_on=key, right_on=key, suffixes=("","_c"))
        out["Channel_clean"]             = np.where(out["Channel_clean"].eq(""), m["Channel"].fillna(""), out["Channel_clean"])
        out["SubChannel_clean"]          = np.where(out["SubChannel_clean"].eq(""), m["Sub-Channel"].fillna(""), out["SubChannel_clean"])
        out["ChannelFinanceGroup_clean"] = np.where(out["ChannelFinanceGroup_clean"].eq(""), m["Channel Finance Group"].fillna(""), out["ChannelFinanceGroup_clean"])
        out["ExComChannel"]              = np.where(out["ExComChannel"].eq(""), m["ExComChannel"].fillna(""), out["ExComChannel"])

        # fallback by the other key
        other = "Channel" if key=="Sub-Channel" else "Sub-Channel"
        miss = out["ChannelFinanceGroup_clean"].astype(str).str.strip()==""
        if miss.any():
            m2 = out.merge(c, how="left", left_on=other, right_on=other, suffixes=("","_c2"))
            out.loc[miss, "Channel_clean"]             = np.where(out.loc[miss, "Channel_clean"].eq(""),             m2.loc[miss, "Channel"].fillna(""), out.loc[miss, "Channel_clean"])
            out.loc[miss, "SubChannel_clean"]          = np.where(out.loc[miss, "SubChannel_clean"].eq(""),          m2.loc[miss, "Sub-Channel"].fillna(""), out.loc[miss, "SubChannel_clean"])
            out.loc[miss, "ChannelFinanceGroup_clean"] = np.where(out.loc[miss, "ChannelFinanceGroup_clean"].eq(""), m2.loc[miss, "Channel Finance Group"].fillna(""), out.loc[miss, "ChannelFinanceGroup_clean"])
            out.loc[miss, "ExComChannel"]              = np.where(out.loc[miss, "ExComChannel"].eq(""),              m2.loc[miss, "ExComChannel"].fillna(""), out.loc[miss, "ExComChannel"])

    # QA any unresolved channel parts
    miss_any = (out["ChannelFinanceGroup_clean"].astype(str).str.strip()=="") | \
               (out["Channel_clean"].astype(str).str.strip()=="") | \
               (out["SubChannel_clean"].astype(str).str.strip()=="")
    for _, r in out.loc[miss_any].iterrows():
        qa.append(qa_event(r, "Channel", "channel_unmapped",
                           current=f"{r.get('Channel','')}|{r.get('Sub-Channel','')}", owner="Analytics", priority="P3"))
    return out

def region_check(plans: pd.DataFrame, rules: dict, fx_df: pd.DataFrame, qa):
    if not rules.get("region_check",{}).get("enabled", False):
        return plans
    out = plans.copy()
    fx = fx_df.copy()
    for c in ["market","region"]:
        if c not in fx.columns: fx[c]=""
        fx[c]=fx[c].astype(str).str.strip()
    map_reg = fx.drop_duplicates(subset=["market"]).set_index("market")["region"].to_dict()
    for _, r in out.iterrows():
        mkt = str(r.get("Market","")).strip()
        reg = str(r.get("Region","")).strip()
        exp = map_reg.get(mkt, "")
        if exp and reg and exp!=reg:
            qa.append(qa_event(r, "Region", "region_mismatch", current=reg, suggested=exp, owner="Analytics", priority="P3"))
        if mkt and (mkt not in map_reg):
            qa.append(qa_event(r, "Market", "market_unknown", current=mkt, owner="Analytics", priority="P3"))
    return out

def actualisation_backfill(plans: pd.DataFrame, rules: dict, qa):
    cfg = rules.get("actualisation_backfill",{})
    if not cfg.get("enabled", True):
        return plans
    out = plans.copy()
    thresh = int(cfg.get("age_days_threshold",30))

    today = pd.Timestamp(datetime.now().date())
    end = out.get("End Date")
    start = out.get("Start Date")
    when = end.where(end.notna(), start)
    days_old = (today - when.dt.floor("D")).dt.days
    old_mask = days_old >= thresh

    for scope in ["local","global"]:
        sc = cfg.get(scope,{})
        a = sc.get("actual_col"); p = sc.get("planned_col"); flag=sc.get("qa_flag","missing_actualisation")
        if a in out.columns and p in out.columns:
            miss = old_mask & ((out[a].isna()) | (pd.to_numeric(out[a], errors="coerce").fillna(0)==0))
            out.loc[miss, a] = pd.to_numeric(out.loc[miss, p], errors="coerce").fillna(0)
            for _, r in out.loc[miss].iterrows():
                qa.append(qa_event(r, a, flag, current="0/blank", suggested=str(r.get(p,0)), owner="Analytics", priority="P2",
                                   extra={"Days_Since_End": int(days_old.get(r.name, np.nan))}))
    return out

def fx_merge_and_derive(plans: pd.DataFrame, rules: dict, fx_df: pd.DataFrame, qa):
    out = plans.copy()
    fx = fx_df.copy()

    out["_Market"]   = out.get("Market","").astype(str).str.strip()
    out["_Currency"] = out.get("Currency","").astype(str).str.strip().str.upper()
    out["_Year"]     = out.get("FX_Year","").astype(str).str.strip()

    for c in ["market","currency","fx_year","fx_to_eur","fx_to_dkk","region"]:
        if c not in fx.columns: fx[c]=""
        fx[c] = fx[c].astype(str).str.strip()
    fx["_Market"]   = fx["market"]
    fx["_Currency"] = fx["currency"].str.upper()
    fx["_Year"]     = fx["fx_year"]

    m = out.merge(fx[["_Market","_Currency","_Year","fx_to_eur","fx_to_dkk","region"]],
                  how="left", on=["_Market","_Currency","_Year"], suffixes=("","_fx"))
    out["fx_to_eur"] = pd.to_numeric(m["fx_to_eur"], errors="coerce")
    out["fx_to_dkk"] = pd.to_numeric(m["fx_to_dkk"], errors="coerce")

    miss = out["fx_to_eur"].isna() | out["fx_to_dkk"].isna()
    for _, r in out.loc[miss].iterrows():
        qa.append(qa_event(r, "FX", "fx_missing", current=f"{r.get('Market','')}/{r.get('Currency','')}/{r.get('FX_Year','')}", owner="Analytics", priority="P1"))

    # derive DKK/EUR columns
    pairs = rules.get("fx_rules",{}).get("compute_pairs",{})
    for cur, mapping in pairs.items():
        rate_col = "fx_to_dkk" if cur.lower()=="dkk" else "fx_to_eur"
        rate = pd.to_numeric(out[rate_col], errors="coerce").fillna(0)
        for local_col, out_col in mapping:
            if local_col in out.columns:
                out[out_col] = pd.to_numeric(out[local_col], errors="coerce").fillna(0) * rate

    # audit EUR vs provided global
    audit = rules.get("fx_rules",{}).get("audit_global_vs_eur",{})
    if audit.get("enabled", True):
        tol = float(audit.get("tolerance_ratio", 0.02))
        checks = [
            ("Total Cost to Client (Global)","Planned_Spend_EUR"),
            ("Total Cost to Client Actual (Global)","Actualised_Spend_EUR"),
            ("Net Media Cost (Global)","Net_Media_EUR"),
        ]
        for given_col, calc_col in checks:
            if given_col in out.columns and calc_col in out.columns:
                given = pd.to_numeric(out[given_col], errors="coerce").fillna(0)
                calc  = pd.to_numeric(out[calc_col], errors="coerce").fillna(0)
                bad = (given>0) & ((np.abs(given-calc) / np.where(given!=0, given, 1)) > tol)
                for _, r in out.loc[bad].iterrows():
                    qa.append(qa_event(r, calc_col, "eur_mismatch",
                                       current=str(r.get(given_col,0)), suggested=str(r.get(calc_col,0)),
                                       owner="Analytics", priority="P3"))
    return out

# ---- CBHT ----
def cbht_join(plans: pd.DataFrame, rules: dict, cb_df: pd.DataFrame, qa):
    out = plans.copy()
    if "CBHT_Brand_League" not in out.columns: out["CBHT_Brand_League"] = ""

    cb = cb_df.copy()
    for c in ["brand","market","fx_year","brand_league"]:
        if c not in cb.columns: cb[c]=""
        cb[c]=cb[c].astype(str).str.strip()

    order = rules.get("cbht_rules",{}).get("join_keys_order",[
        ["Brand_clean","Market","FX_Year"],
        ["Brand_clean","Market"],
        ["Brand_clean"],
    ])

    for keys in order:
        # map left keys to cbht cols
        lkmap = {"Brand_clean":"brand","Market":"market","FX_Year":"fx_year"}
        right_on = [lkmap.get(k,k) for k in keys]
        m = out.merge(cb[["brand","market","fx_year","brand_league"]],
                      how="left", left_on=keys, right_on=right_on, suffixes=("","_cb"))
        fill = out["CBHT_Brand_League"].astype(str).str.strip()==""
        out.loc[fill, "CBHT_Brand_League"] = m.loc[fill, "brand_league"].fillna("")

    miss_cb = out["CBHT_Brand_League"].astype(str).str.strip()==""
    for _, r in out.loc[miss_cb].iterrows():
        qa.append(qa_event(r, "CBHT_Brand_League","cbht_missing", current=r.get("Brand_clean",""), owner="Insights", priority="P2"))
    return out

# ---- Plans pipeline ----
def process_plans(rules: dict):
    paths = sorted(list(IN_DIR.glob("plans_*.xlsx")) + list(IN_DIR.glob("Plans_*.xlsx")))
    if not paths: return pd.DataFrame(), {}, pd.DataFrame(), pd.DataFrame()

    frames, qa = [], []
    fx_df   = safe_read_csv(TAX_DIR/"fx_rates.csv")
    brands  = safe_read_csv(TAX_DIR/"brands.csv")
    vendors = safe_read_csv(TAX_DIR/"vendors.csv")
    camps   = safe_read_csv(TAX_DIR/"campaigns.csv")
    chans   = safe_read_csv(TAX_DIR/"channels.csv")
    cbht    = safe_read_csv(TAX_DIR/"cbht.csv")

    for p in tqdm(paths, desc="Reading plans"):
        df = read_excel_first(p)
        df = add_fx_year_from_filename(df, p.name)

        # normalise expected columns
        needed = ["FX_Year","Currency","Region","Market","Brand","Variant","Channel","Sub-Channel","Channel Finance Group",
                  "Vendor","Campaign Name","Objective","Buying Model","Innovation","Inventory Buy","Creative Source",
                  "Start Date","End Date","Plan ID","Plan Name","Plan Status"]
        for c in needed:
            if c not in df.columns: df[c] = ""

        # coerce types
        df = coerce_dates(df, ["Start Date","End Date"])
        df = coerce_numeric_cols(df)

        # Plan Status defaults & drop cancelled
        if "Plan Status" in df.columns:
            blank = df["Plan Status"].astype(str).str.strip()==""
            if blank.any():
                df.loc[blank, "Plan Status"] = rules.get("defaults",{}).get("Plan Status","Planned")
                for _, r in df.loc[blank].iterrows():
                    qa.append(qa_event(r, "Plan Status","status_defaulted", suggested="Planned", owner="Offshore Ops", priority="P3"))
            cancelled = df["Plan Status"].astype(str).str.lower().isin(["cancelled","canceled"])
            for _, r in df.loc[cancelled].iterrows():
                qa.append(qa_event(r, "Plan Status","row_dropped_cancelled"))
            df = df.loc[~cancelled].copy()

        # Date placeholders & drop truly empty metric rows
        ph = rules.get("date_placeholders",{})
        metric_pat = r"(cost|spend|views|impressions|fee|eur|dkk|cpm|vcr|reach|frequency|budget)"
        metric_cols = [c for c in df.columns if re.search(metric_pat, c, re.I)]
        for idx, r in df.iterrows():
            s = r.get("Start Date"); e = r.get("End Date")
            nums = pd.to_numeric(pd.Series({c:r.get(c) for c in metric_cols}), errors="coerce").fillna(0)
            all_zero = float(nums.abs().sum()) == 0.0
            if pd.isna(s) and pd.isna(e) and all_zero:
                df.loc[idx,"__drop"] = True
                qa.append(qa_event(r, "Row","row_dropped_empty"))
            else:
                fx_year = r.get("FX_Year", datetime.now().year)
                if pd.isna(s) and ph.get("start_if_missing"):
                    df.loc[idx,"Start Date"] = pd.to_datetime(ph["start_if_missing"].format(FX_Year=int(fx_year)), dayfirst=True)
                    qa.append(qa_event(r, "Start Date","date_placeholder_applied", suggested=str(df.loc[idx,"Start Date"].date())))
                if pd.isna(e) and ph.get("end_if_missing"):
                    df.loc[idx,"End Date"] = pd.to_datetime(ph["end_if_missing"].format(FX_Year=int(fx_year)), dayfirst=True)
                    qa.append(qa_event(r, "End Date","date_placeholder_applied", suggested=str(df.loc[idx,"End Date"].date())))
        if "__drop" in df.columns:
            df = df.loc[df["__drop"]!=True].drop(columns="__drop")

        # Defaults / temporary fills
        for field, default_val in [
            ("Objective", rules.get("temporary_fills",{}).get("Objective","Awareness")),
            ("Buying Model", rules.get("defaults",{}).get("Buying Model","Fixed Cost")),
            ("Innovation", rules.get("defaults",{}).get("Innovation","No")),
            ("Inventory Buy", rules.get("defaults",{}).get("Inventory Buy","No")),
            ("Creative Source", rules.get("defaults",{}).get("Creative Source","Locally Produced Asset")),
        ]:
            miss = df[field].astype(str).str.strip()==""
            if miss.any():
                df.loc[miss, field] = default_val
                for _, r in df.loc[miss].iterrows():
                    qa.append(qa_event(r, field, f"{field.replace(' ','_').lower()}_defaulted", suggested=default_val))

        # Objective whitelist
        allowed = set(rules.get("allowed_objectives",[]))
        if allowed:
            bad = ~df["Objective"].astype(str).isin(allowed)
            if bad.any():
                for _, r in df.loc[bad].iterrows():
                    qa.append(qa_event(r, "Objective","objective_normalised", current=r.get("Objective",""), suggested="Awareness"))
                df.loc[bad, "Objective"] = "Awareness"

        # Region QA vs fx_rates
        df = region_check(df, rules, fx_df, qa)

        # Deterministic enrichment
        df = brands_map(df, rules, brands, qa)
        df = vendors_map(df, rules, vendors, qa)
        df = channels_map(df, rules, chans, qa)
        df = campaigns_map(df, rules, camps, qa)

        # Backfill actualisation (older than N days)
        df = actualisation_backfill(df, rules, qa)

        # FX merge & compute derived EUR/DKK columns
        df = fx_merge_and_derive(df, rules, fx_df, qa)

        # CBHT
        df = cbht_join(df, rules, cbht, qa)

        frames.append(df)

    plans = pd.concat(frames, ignore_index=True).drop_duplicates()

    # QA outputs
    qa_df = pd.DataFrame(qa)
    map_cols = ["Plan ID","Market","Plan Name","Brand","Brand_clean","Variant","Variant_clean","Vendor","Vendor_clean","Campaign Name","Campaign_clean"]
    mapping_diffs = plans[[c for c in map_cols if c in plans.columns]].drop_duplicates()

    # Keep raw + *_clean + derived
    fact = plans.copy()

    return fact, {"Exceptions": qa_df, "MappingDiffs": mapping_diffs}, plans, qa_df

# ---- Budgets pipeline ----
def process_budgets(rules: dict):
    paths = sorted(list(IN_DIR.glob("budgets_*.xlsx")) + list(IN_DIR.glob("Budgets_*.xlsx")))
    if not paths: return pd.DataFrame(), {}

    frames, qa = [], []
    fx_df = safe_read_csv(TAX_DIR/"fx_rates.csv")
    chans = safe_read_csv(TAX_DIR/"channels.csv")

    for p in tqdm(paths, desc="Reading budgets"):
        df = read_excel_first(p)
        df = add_fx_year_from_filename(df, p.name)

        for c in ["Market","Region","Brand","ChannelFinanceGroup","Sub-Channel","Channel"]:
            if c not in df.columns: df[c]=""

        df = channels_map(df, rules, chans, qa)  # fills Channel*_clean where possible
        df = coerce_numeric_cols(df)

        # FX conversion if currency present (some budget extracts may lack it)
        if "Currency" in df.columns:
            df = fx_merge_and_derive(df, rules, fx_df, qa)

        frames.append(df)

    bud = pd.concat(frames, ignore_index=True).drop_duplicates()
    qa_df = pd.DataFrame(qa)
    return bud, ({"Exceptions": qa_df} if not qa_df.empty else {})

# ---- Entrypoint ----
def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rules = load_rules()

    print("Scanning input…")
    plans_clean, plans_qa_tabs, plans_full, exceptions = process_plans(rules)
    budgets_clean, budgets_qa_tabs = process_budgets(rules)

    pc_path = OUT_DIR / f"Plans_Clean_{TODAY}.xlsx"
    pq_path = OUT_DIR / f"Plans_QA_{TODAY}.xlsx"
    bc_path = OUT_DIR / f"Budgets_Clean_{TODAY}.xlsx"
    bq_path = OUT_DIR / f"Budgets_QA_{TODAY}.xlsx"

    if not plans_clean.empty:
        save_excel(pc_path, {"fact_media_plan": plans_clean})
    if plans_qa_tabs:
        if "Exceptions" in plans_qa_tabs and isinstance(plans_qa_tabs["Exceptions"], pd.DataFrame) and not plans_qa_tabs["Exceptions"].empty:
            plans_qa_tabs["Exceptions"].to_csv(OUT_DIR / "Exceptions.csv", index=False, encoding="utf-8-sig")
        sheets = {k:v for k,v in plans_qa_tabs.items() if isinstance(v, pd.DataFrame) and not v.empty}
        if sheets: save_excel(pq_path, sheets)

    if not budgets_clean.empty:
        save_excel(bc_path, {"budgets_clean": budgets_clean})
    if budgets_qa_tabs:
        sheets_b = {k:v for k,v in budgets_qa_tabs.items() if isinstance(v, pd.DataFrame) and not v.empty}
        if sheets_b: save_excel(bq_path, sheets_b)

    print("Done.")
    print(f"Plans rows: {len(plans_clean)}; Plans exceptions: {len(exceptions)}; Budgets rows: {len(budgets_clean)}")

if __name__ == "__main__":
    main()
