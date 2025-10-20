
---

# 📌 Product_Team_Requests.md
```markdown
# Product Team Requests – Dentsu Connect Enhancements

To reduce weekly manual cleanup, we request:

1. **Field Completeness**
   - Enforce mandatory: Market, Region, Plan ID, Plan Name, Plan Status, Start/End Dates, Currency, Objective, Buying Method, Innovation, Inventory Buy, Creative Source, Vendor.

2. **Objective Taxonomy**
   - Restrict Objectives to: Awareness, Consideration, Engagement, Loyalty, Sales/Trial.

3. **Brand & Variant**
   - Normalize Brand/Variant at point of entry (use Carlsberg taxonomy file).
   - Prevent mismatch (e.g. Plan Name says Tuborg but Brand field = Carlsberg).

4. **Vendor**
   - Normalize Vendor names.
   - Provide canonical Vendor + Vendor House + Vendor Type.

5. **CBHT**
   - Auto-attach CBHT Study/Report Source/Brand League by (Brand, Market, FX Year).

6. **FX**
   - Auto-attach FX rates by (Currency, FX Year) from Carlsberg Finance files.

7. **Data Export**
   - Ensure exports are:
     - Without totals rows
     - Stable header names (no shifts)
     - Dates in ISO (`YYYY-MM-DD`)

8. **Correction Workflow (Future)**
   - Provide API/endpoint to accept corrected values back from QA pipeline.
   - Auto-ingest taxonomy updates and reduce manual VLOOKUPs.

---

These changes would significantly reduce weekly QA load and accelerate client reporting.
