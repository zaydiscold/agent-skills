---
name: chembl-bioactivity-audit
description: "Query ChEMBL for bioactivity data on a drug-design target; surfaces clinical-stage hits, Kd benchmarks, phospholipidosis flags, and alternative chemotypes with measured binding"
---

# ChEMBL bioactivity audit for drug-design submissions

## When to use

Any time you're preparing a drug-design submission (hackathon, paper, internal review, IND-enabling work) where you have a target hypothesis and want **direct experimental evidence** to strengthen the mechanism story and inform chemotype selection.

The pattern: before finalizing the submission, query ChEMBL for bioactivity data on the target. You'll find:
- Clinical-stage hits (max_phase > 0) — strong evidence the chemotype works
- Kd/IC50 values for related chemotypes — sets "good score" benchmarks
- Phospholipidosis / lysosomotropic flags — explains why CAD-class diversity fails counterscreens
- Alternative chemotypes with measured binding — portfolio diversity candidates

## Why this matters

In the ebolathon hackathon, a 10-minute ChEMBL audit surfaced:
- **Toremifene Kd = 16 µM** for EBOV GP (CHEMBL1655 / CHEMBL4105829) — direct experimental confirmation of the SERM-GP-pocket mechanism
- **Chlorcyclizine class max_phase 2** (clinical history, CHEMBL1515447) + **phospholipidosis-positive** in ChEMBL data (CHEMBL1626541) — validates the CAD false-positive risk prediction
- 4 alternative chemotypes with EBOV GP bioactivity (Kd 290 µM – 1.3 mM) — confirms the field is real, but none are in our purchasable library

This evidence went into the method paragraph as a stronger mechanism anchor than docking alone.

## Procedure (5-10 min)

### 1. Find the target's ChEMBL ID

```python
from chembl_webresource_client.new_client import new_client

target = new_client.target
# Search by organism name, protein name, or UniProt
hits = list(target.search("Ebola glycoprotein").only(
    ["target_chembl_id", "pref_name", "organism", "target_type"]
))
for h in hits[:5]:
    print(h.get("target_chembl_id"), h.get("pref_name"), h.get("organism"))
```

Common patterns:
- "Ebola glycoprotein" / "EBOV GP" / "MARV GP"
- "Bundibugyo virus" / "BDBV"
- UniProt ID (e.g., "B8XCN0")
- Gene name (e.g., "GP")

### 2. Pull all bioactivities for that target

```python
activity = new_client.activity
acts = list(activity.filter(target_chembl_id="CHEMBL4105829").only(
    ["molecule_chembl_id", "canonical_smiles", "standard_type",
     "standard_value", "standard_units", "assay_description"]
))
```

### 3. Sort by potency and look for clinical-stage hits

```python
# Get unique molecules, sorted by potency
seen = set()
unique = []
for a in acts:
    cid = a.get("molecule_chembl_id")
    if cid and cid not in seen:
        seen.add(cid)
        unique.append(a)

# Check for clinical-stage (max_phase > 0)
molecule = new_client.molecule
for m in unique[:15]:
    mol_data = list(molecule.filter(molecule_chembl_id=m["molecule_chembl_id"]).only(
        ["molecule_chembl_id", "pref_name", "max_phase"]
    ))
    if mol_data:
        print(f"{mol_data[0]['molecule_chembl_id']} | "
              f"{mol_data[0].get('pref_name', 'N/A')} | "
              f"max_phase {mol_data[0].get('max_phase')}")
```

### 4. Get the full SMILES for each hit

```python
# Either from ChEMBL (canonical) or via PubChem CID lookup
import urllib.request, json
for m in unique[:5]:
    smiles = m.get("canonical_smiles", "")
    if smiles:
        # PubChem CID lookup for canonical data
        url = f"https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/{urllib.request.quote(smiles)}/property/MolecularFormula,XLogP/JSON"
        # ... fetch and parse
```

### 5. Cross-check against your library

For each interesting hit, check whether it's in your purchasable library (CORE / commercial / academic):
- If yes: consider promoting to top of final list (clinical evidence is gold)
- If no: use as mechanism anchor in method paragraph + look for similar chemotypes in your library

### 6. Check for phospholipidosis / CAD flags

```python
# Search ChEMBL for "phospholipidosis" assay results on top chemotypes
acts = list(activity.filter(
    molecule_chembl_id="CHEMBL1515447",
    standard_type="Phospholipidosis"
).only(["standard_type", "standard_value", "assay_description"]))
```

This catches why CAD-class molecules give false positives in pseudovirus assays — they cause phospholipidosis, which the assay reads as entry inhibition.

### 7. Use findings in the submission

Add to method paragraph (paste-ready):

```
Direct experimental anchor: ChEMBL bioactivity for [TARGET] (CHEMBLXXXXX) reports
[KNOWN_DRUG] Kd = [VALUE] (CHEMBLXXXXX), validating the [CHEMOTYPE] mechanism.
[OTHER_CLASS] reaches max_phase [N] in clinical development, with documented
phospholipidosis activity (CHEMBLXXXXX) — explaining our CAD false-positive
risk prediction. [N] additional [TARGET] bioactives from ChEMBL (CHEMBL IDs;
Kd [RANGE]) confirm multiple chemotypes bind the pocket; [N] excluded as
not in [LIBRARY].
```

## Common patterns this catches

1. **The exact seed SMILES is in clinical trials.** Discovered ChEMBL mid_phase 3 with the same scaffold as your headstart candidate → lead with confidence.
2. **A "novel" chemotype has been on the shelf for 40 years.** Surfaces what's actually known and avoids reinventing.
3. **CAD-class diversity has a documented mechanism (phospholipidosis).** Lets you pre-confess in demo why the VSV-G counterscreen will kill it.
4. **Your proposed chemotype has a known SAR cliff.** ChEMBL bioactivity + similar chemotypes show what's been tried and failed.
5. **The Kd benchmark for "good" is already set.** If published hits are 16-1000 µM, then your dock scores should be interpreted accordingly (micromolar, not nanomolar).

## What this is NOT

- This doesn't replace docking or ADMET. It's a complementary evidence layer.
- It doesn't generate new candidates. It validates existing chemotype choices.
- It doesn't tell you about BDBV-specific data unless ChEMBL has it (often only EBOV data exists, with conservation argued via Cooper 2020).
- It doesn't check synthesis feasibility. For that, use PubChem CID lookup + onepot CORE search.

## Reference: Key ChEMBL IDs for the ebolathon

| Target / compound | ChEMBL ID | Use |
|---|---|---|
| EBOV Envelope glycoprotein (Zaire) | **CHEMBL4105829** | Primary EBOV GP bioactivity |
| MARV Envelope glycoprotein | CHEMBL6195686 | MARV cross-validation |
| Bundibugyo virus (organism) | CHEMBL6066657 | BDBV (likely no SM bioactivity) |
| Toremifene | CHEMBL1655 | Kd 16 µM for EBOV GP — confirms SERM-GP mechanism |
| Imipramine | CHEMBL11 | ΔTm 2°C for EBOV GP — confirms CAD-class activity |
| Chloroimipramine | CHEMBL415 | ΔTm 3°C for EBOV GP — confirms CAD-class activity |
| Homochlorcyclizine | CHEMBL1515447 | max_phase 2; clinical history for chlorcyclizine class |
| Phospholipidosis assay | CHEMBL1626541 | Lysosomotropic mechanism (CAD false-positive reason) |

## Script: complete audit in one go

```python
from chembl_webresource_client.new_client import new_client
import warnings
warnings.filterwarnings("ignore")

def chembl_target_audit(target_query, top_n=15):
    """Run a complete bioactivity audit for a target query."""
    target = new_client.target
    activity = new_client.activity
    molecule = new_client.molecule

    # Find target
    hits = list(target.search(target_query).only(
        ["target_chembl_id", "pref_name", "organism", "target_type"]
    ))
    print(f"Target search '{target_query}': {len(hits)} hits")
    for h in hits[:5]:
        tid = h.get("target_chembl_id")
        print(f"\n--- {tid} | {h.get('pref_name')} | {h.get('organism')} ---")
        
        # Bioactivities
        acts = list(activity.filter(target_chembl_id=tid).only(
            ["molecule_chembl_id", "canonical_smiles", "standard_type",
             "standard_value", "standard_units"]
        ))
        seen = set()
        unique = []
        for a in acts:
            cid = a.get("molecule_chembl_id")
            if cid and cid not in seen:
                seen.add(cid)
                unique.append(a)
        print(f"  {len(unique)} unique molecules")
        
        # Clinical stage + best potency
        for m in unique[:top_n]:
            mol_data = list(molecule.filter(molecule_chembl_id=m["molecule_chembl_id"]).only(
                ["molecule_chembl_id", "pref_name", "max_phase"]
            ))
            if mol_data:
                name = mol_data[0].get("pref_name") or "N/A"
                max_ph = mol_data[0].get("max_phase", "N/A")
                smi = (m.get("canonical_smiles") or "")[:80]
                print(f"  {mol_data[0]['molecule_chembl_id']} | max_phase {max_ph} | "
                      f"{m.get('standard_type')}={m.get('standard_value')} {m.get('standard_units')} | {smi}")

# Run
chembl_target_audit("Ebola glycoprotein")
chembl_target_audit("Bundibugyo")
```

## Lesson learned

The ChEMBL bioactivity audit should be the FIRST step after literature headstart, not the last. Five minutes of querying gives you direct experimental anchors that no amount of docking can replicate. The "best" submission isn't the one with the best Vina — it's the one with the strongest evidence chain from in-silico to in-vitro.
