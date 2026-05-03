import os
import re
from datetime import datetime
import markdown

def jenere_kontra():
    print("\n--- 🏍️ JENERATÈ KONTRA FLEETHT ---")
    
    # 1. Ranmase enfòmasyon
    non_chofe = input("Non ak Siyati Chofè a: ")
    dat_nesans = input("Dat Nesans (JJ/MM/AAAA): ")
    adres = input("Adrès Chofè a: ")
    telefon = input("Nimewo Telefòn: ")
    nif = input("CIN / NIF: ")
    
    print("\n--- ENFÒMASYON MOTO A ---")
    mak = input("Mak Moto a (eg: Bajaj Boxer 150): ")
    model_ane = input("Modèl & Ane: ")
    koule = input("Koulè: ")
    mote = input("Nimewo Motè: ")
    chasi = input("Nimewo Chasi: ")
    plak = input("Nimewo Plak: ")
    depo = input("Depo Garansi peye (an HTG, eg: 10000): ")
    
    dat_jodi_a = datetime.now().strftime("%d/%m/%Y")
    
    # Kote fichye yo ye
    rep_base = r"c:\Users\0000\AGABY_2026\02_PROJECTS\FLEET_HT"
    kontra_file = os.path.join(rep_base, "KONTRA_CHOFE_FLEETHT.md")
    
    if not os.path.exists(kontra_file):
        print(f"Erè: Pa jwenn {kontra_file}")
        return
        
    with open(kontra_file, 'r', encoding='utf-8') as f:
        konten_kontra = f.read()
        
    # Ranplasman yo
    konten_kontra = konten_kontra.replace("Non ak Siyati: _________________________________________", f"Non ak Siyati: **{non_chofe}**")
    konten_kontra = konten_kontra.replace("Dat Nesans: ____________________", f"Dat Nesans: **{dat_nesans}**")
    konten_kontra = konten_kontra.replace("Adrès: __________________________________________________", f"Adrès: **{adres}**")
    konten_kontra = konten_kontra.replace("Nimewo Telefòn: ____________________", f"Nimewo Telefòn: **{telefon}**")
    konten_kontra = konten_kontra.replace("CIN / NIF: ____________________", f"CIN / NIF: **{nif}**")
    
    konten_kontra = konten_kontra.replace("Mak: ____________________", f"Mak: **{mak}**")
    konten_kontra = konten_kontra.replace("Modèl & Ane: ____________________", f"Modèl & Ane: **{model_ane}**")
    konten_kontra = konten_kontra.replace("Koulè: ____________________", f"Koulè: **{koule}**")
    konten_kontra = konten_kontra.replace("Nimewo Motè: ____________________", f"Nimewo Motè: **{mote}**")
    konten_kontra = konten_kontra.replace("Nimewo Chasi: ____________________", f"Nimewo Chasi: **{chasi}**")
    konten_kontra = konten_kontra.replace("Nimewo Plak: ____________________", f"Nimewo Plak: **{plak}**")
    konten_kontra = konten_kontra.replace("depo garansi **non-ranbousab** de ____________ HTG", f"depo garansi **non-ranbousab** de **{depo}** HTG")
    konten_kontra = konten_kontra.replace("**Dat:** _________________", f"**Dat:** **{dat_jodi_a}**")
    
    # Sove nouvo dokiman an
    non_fichye_sove = non_chofe.replace(" ", "_").upper()
    nouvo_chemen = os.path.join(rep_base, f"KONTRA_{non_fichye_sove}_{plak}.md")
    
    with open(nouvo_chemen, 'w', encoding='utf-8') as f:
        f.write(konten_kontra)
        
    # --- KREYE VÈSYON HTML POU ENPRIME AN PDF ---
    html_content = markdown.markdown(konten_kontra)
    html_styled = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Kontra - {non_chofe}</title>
    <style>
        body {{ font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 40px; line-height: 1.6; color: #333; }}
        h1 {{ color: #1e3a8a; text-align: center; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }}
        h2 {{ color: #f59e0b; margin-top: 30px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }}
        hr {{ border: 0; border-top: 1px solid #ccc; margin: 20px 0; }}
        strong {{ color: #000; }}
        @media print {{
            body {{ margin: 0; padding: 20px; }}
            h2 {{ page-break-after: avoid; }}
            p {{ page-break-inside: avoid; }}
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>"""

    html_chemen = nouvo_chemen.replace('.md', '.html')
    with open(html_chemen, 'w', encoding='utf-8') as f:
        f.write(html_styled)
        
    print(f"\n✅ Siksè! Kontra a kreye an Markdown: {nouvo_chemen}")
    print(f"🖨️ Fichye HTML pou w Enprime an PDF: {html_chemen}")
    print("Ou ka jis double-klike sou fichye HTML la epi fè Ctrl+P (Print)!")

if __name__ == "__main__":
    jenere_kontra()
