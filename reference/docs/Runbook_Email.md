# Runbook – Weekly Dentsu Connect Data Cleaning

## Step 1 – Pull data
- Export **Plan data all data** for 2024 + 2025 + 2026.
- Export **Budget vs Planned vs Actual** for 2024 + 2025 + 2026.
- Save files in `input/raw/` as `plans_2024.xlsx`, `plans_2025.xlsx`, `plans_2026.xlsx`, `budgets_2024.xlsx`, `budgets_2025.xlsx`, `budgets_2026.xlsx`.

## Step 2 – Run cleaning
```bash
conda activate dc_clean
python scripts/run_cleaning.py