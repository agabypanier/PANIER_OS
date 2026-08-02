import re
import json
import math
import os
import pandas as pd

# Paths
data_js_path = r"C:\Users\panie\OneDrive\Documents\AGABY_2026\02_PROJECTS\DINEPA_MILLET\data.js"
millet_2_xlsx = r"C:\Users\panie\OneDrive\Documents\AGABY_2026\02_PROJECTS\DINEPA_MILLET\millet 2.xlsx"

# 1. Read existing data.js
with open(data_js_path, "r", encoding="utf-8") as f:
    js_content = f.read()

# Parse the JSON from the js file (e.g. const DINEPA_ARCHIVE_2019 = [...])
match = re.search(r"const\s+DINEPA_ARCHIVE_2019\s*=\s*(\[.*?\]);", js_content, re.DOTALL)
if not match:
    print("Error: Could not parse DINEPA_ARCHIVE_2019 from data.js")
    exit(1)

existing_abonnes = json.loads(match.group(1))
print(f"Existing abonnes in data.js: {len(existing_abonnes)}")

# 2. Read millet 2.xlsx
df = pd.read_excel(millet_2_xlsx, skiprows=20, header=0)
df = df.dropna(subset=['Localisation', 'Titulaire'])
df = df[df['Localisation'] != 'Localisation']
print(f"Valid records in millet 2.xlsx: {len(df)}")

def clean(val):
    if val is None: return ''
    if isinstance(val, float) and math.isnan(val): return ''
    return str(val).strip()

def clean_float(val):
    if val is None: return '0'
    if isinstance(val, float) and math.isnan(val): return '0'
    try: return str(round(float(val), 3))
    except: return '0'

def norm_statut(val, solde_val):
    s = clean(val).lower()
    if 'ferm' in s: return 'ferme'
    if 'dette' in s: return 'dette'
    if solde_val > 0: return 'dette'
    return 'actif'

def norm_categorie(val):
    s = clean(val)
    sl = s.lower()
    if 'r\xe9sid' in sl or 'resid' in sl or 'r\u00e9sid' in sl: return 'Résidence'
    if sl.startswith('comm'): return 'Commerce'
    if sl.startswith('part'): return 'Particulier'
    if 'scolaire' in sl: return 'Institution Scolaire'
    if 'moyenne' in sl or 'pme' in sl: return 'PME'
    if 'relig' in sl: return 'Association Religieuse'
    if 'social' in sl: return 'Social'
    if sl == '': return ''
    return s

# Index existing by PDL
existing_by_pdl = {a['pdl']: a for a in existing_abonnes if a.get('pdl')}

# Merge strategy
updated_count = 0
added_count = 0

for _, row in df.iterrows():
    pdl = clean(row.get('Localisation',''))
    titulaire = clean(row.get('Titulaire',''))
    if not pdl and not titulaire: continue
    
    parts = titulaire.split(' ', 1)
    nom = parts[0].upper() if parts else ''
    prenom = parts[1] if len(parts) > 1 else ''
    
    solde = clean_float(row.get('Solde', 0))
    solde_val = float(solde) if solde else 0
    statut = norm_statut(row.get('Statut',''), solde_val)
    
    # If this PDL exists in Millet database, update it (especially debt, category, phone)
    if pdl in existing_by_pdl:
        existing = existing_by_pdl[pdl]
        existing['solde_ant'] = solde
        existing['statut'] = statut
        if clean(row.get('Téléphone','')):
            existing['telephone'] = clean(row.get('Téléphone',''))
        if norm_categorie(row.get('Catégorie','')):
            existing['categorie'] = norm_categorie(row.get('Catégorie',''))
        if clean(row.get('Tarif taxe','')):
            existing['tarif_taxe'] = clean_float(row.get('Tarif taxe',''))
        updated_count += 1
    else:
        # Check if it has a Millet prefix (starts with 504 or 532 or 506 or 505)
        # We only add it to Millet database if it matches Millet sector prefixes
        pdl_prefix = pdl[:3]
        if pdl_prefix in ['504', '532', '506', '505']:
            new_ab = {
                'pdl': pdl,
                'nom': nom,
                'prenom': prenom,
                'adresse': clean(row.get('Adresse (Ligne 1)','')),
                'telephone': clean(row.get('Téléphone','')),
                'solde_ant': solde,
                'statut': statut,
                'notes': '',
                'doleances': '',
                'categorie': norm_categorie(row.get('Catégorie','')),
                'tarif_taxe': clean_float(row.get('Tarif taxe',0)),
                'type': clean(row.get('Tip','Forfaitaire')),
                'verifye': ''
            }
            existing_abonnes.append(new_ab)
            added_count += 1

print(f"Updated: {updated_count} abonnes")
print(f"Added: {added_count} new Millet abonnes")
print(f"Total now in Millet database: {len(existing_abonnes)}")

# 3. Write back to data.js
new_js_content = 'const DINEPA_ARCHIVE_2019 = ' + json.dumps(existing_abonnes, indent=2, ensure_ascii=False) + ';\n'
with open(data_js_path, "w", encoding="utf-8") as f:
    f.write(new_js_content)
print("Successfully updated data.js with merged listing!")
