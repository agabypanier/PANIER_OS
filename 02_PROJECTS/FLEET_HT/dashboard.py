import streamlit as st
import pandas as pd
import plotly.express as px
from datetime import datetime
import os
from db_config import get_supabase_client

# Configured Page
st.set_page_config(page_title="FleetHT Admin OS", page_icon="🏍️", layout="wide")

st.title("🛡️ FleetHT Admin OS - Sant Kontwòl Jeneral")
st.markdown("Platfòm sa a konekte ak Supabase Cloud. Li pèmèt ou jere tout aspè biznis la nan yon sèl kote.")

supabase = get_supabase_client()

# ==========================================
# FONKSYON POU RALE DONE
# ==========================================
@st.cache_data(ttl=60)
def load_peman_data():
    try:
        response = supabase.table("peman_fleetht").select("*").execute()
        if not response.data:
            return pd.DataFrame()
        df = pd.DataFrame(response.data)
        df['montan_peye_htg'] = pd.to_numeric(df['montan_peye_htg'], errors='coerce').fillna(0)
        df['reta_det_htg'] = pd.to_numeric(df['reta_det_htg'], errors='coerce').fillna(0)
        return df
    except Exception as e:
        st.error(f"Erè: {str(e)}")
        return pd.DataFrame()

@st.cache_data(ttl=60)
def load_enspeksyon_data():
    try:
        response = supabase.table("enspeksyon_fleetht").select("*").order('dat_kreye', desc=True).execute()
        if not response.data:
            return pd.DataFrame()
        return pd.DataFrame(response.data)
    except Exception as e:
        return pd.DataFrame()

df_peman = load_peman_data()
df_enspeksyon = load_enspeksyon_data()

# ==========================================
# KREYASYON TABS YO
# ==========================================
tab_finans, tab_flot, tab_dokiman, tab_ia = st.tabs([
    "📊 Finans ak Pèfòmans", 
    "🧑‍✈️ Jesyon Flòt (Enspeksyon)", 
    "📄 Jeneratè Dokiman", 
    "🤖 Rapò IA (Manadjè)"
])

# ------------------------------------------
# TAB 1: FINANS
# ------------------------------------------
with tab_finans:
    st.header("📊 Finans ak Pèfòmans")
    if not df_peman.empty:
        total_peye = df_peman['montan_peye_htg'].sum()
        total_det = df_peman['reta_det_htg'].sum()
        kantite_chofe = df_peman['non_chofe'].nunique()

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(label="Total Lajan Antre (HTG)", value=f"{total_peye:,.2f}")
        with col2:
            st.metric(label="Total Dèt/Reta (HTG)", value=f"{total_det:,.2f}")
        with col3:
            st.metric(label="Kantite Chofè Aktif", value=kantite_chofe)
            
        st.markdown("---")
        
        col_chart1, col_chart2 = st.columns(2)
        with col_chart1:
            st.subheader("Peman chak jou")
            df_date = df_peman.groupby('dat')['montan_peye_htg'].sum().reset_index()
            fig1 = px.bar(df_date, x='dat', y='montan_peye_htg', text_auto=True, color_discrete_sequence=['#2ecc71'])
            st.plotly_chart(fig1, use_container_width=True)
            
        with col_chart2:
            st.subheader("Dèt pa Chofè")
            df_det = df_peman.groupby('non_chofe')['reta_det_htg'].sum().reset_index()
            df_det = df_det[df_det['reta_det_htg'] > 0]
            if not df_det.empty:
                fig2 = px.pie(df_det, names='non_chofe', values='reta_det_htg', color_discrete_sequence=px.colors.sequential.RdBu)
                st.plotly_chart(fig2, use_container_width=True)
            else:
                st.info("Pa gen chofè ki gen dèt! 🎉")
                
        st.subheader("Tablo Peman (Live)")
        st.dataframe(df_peman, use_container_width=True)
    else:
        st.warning("Poko gen peman nan baz de done a.")

# ------------------------------------------
# TAB 2: FLÒT AK ENSPEKSYON
# ------------------------------------------
with tab_flot:
    st.header("🧑‍✈️ Foto Enspeksyon Moto Yo")
    st.markdown("Lè Tioby voye foto sou Bot Telegram nan, yo parèt isit la otomatikman.")
    
    if not df_enspeksyon.empty:
        # Afiche foto yo nan yon grid
        cols = st.columns(3)
        for index, row in df_enspeksyon.iterrows():
            with cols[index % 3]:
                st.image(row['foto_url'], caption=f"Plak: {row['plak']} | Dat: {str(row['dat_kreye'])[:10]}", use_container_width=True)
                st.caption(f"Nòt: {row['not_enspeksyon']}")
    else:
        st.info("Poko gen foto enspeksyon sou Cloud la. Voye youn sou Telegram (Egzanp: Foto AA-1234) ansanm ak yon foto.")

# ------------------------------------------
# TAB 3: DOKIMAN AK KONTRA
# ------------------------------------------
with tab_dokiman:
    st.header("📄 Jeneratè Kontra Otomatik")
    st.markdown("Ranpli fòm sa a pou w kreye yon kontra byen rapid an fòma PDF/HTML pou w ka enprime l.")
    
    with st.form("kontra_form"):
        col_f1, col_f2 = st.columns(2)
        with col_f1:
            non_chofe = st.text_input("Non Chofè a")
            nif_cin = st.text_input("NIF / CIN Chofè a")
            telefon = st.text_input("Telefòn")
        with col_f2:
            adrès = st.text_input("Adrès Chofè a")
            plak_moto = st.text_input("Plak Moto a")
            vin = st.text_input("Nimewo Chasi Moto a (VIN)")
            
        submit = st.form_submit_button("Genere Kontra a")
        
        if submit:
            if non_chofe and plak_moto:
                # Kòd HTML de baz pou bèl enpresyon
                kontra_html = f"""
                <html>
                <head>
                    <style>
                        body {{ font-family: Arial, sans-serif; line-height: 1.6; padding: 40px; color: #333; }}
                        h1 {{ text-align: center; color: #2c3e50; }}
                        .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }}
                        .info {{ background: #f9f9f9; padding: 15px; border-left: 4px solid #2ecc71; margin-bottom: 20px; }}
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>KONTRA LOKASYON MOTO - FLEETHT</h1>
                        <p><strong>Dat Jounen an:</strong> {datetime.now().strftime('%d/%m/%Y')}</p>
                    </div>
                    
                    <p>Kontra sa a fèt ant <strong>FleetHT (Tioby kòm Manadjè)</strong> ak chofè ki siyen pi ba a.</p>
                    
                    <div class="info">
                        <h3>Enfòmasyon Chofè a:</h3>
                        <ul>
                            <li><strong>Non:</strong> {non_chofe}</li>
                            <li><strong>NIF/CIN:</strong> {nif_cin}</li>
                            <li><strong>Telefòn:</strong> {telefon}</li>
                            <li><strong>Adrès:</strong> {adrès}</li>
                        </ul>
                        <h3>Enfòmasyon Moto a:</h3>
                        <ul>
                            <li><strong>Plak:</strong> {plak_moto}</li>
                            <li><strong>Chasi (VIN):</strong> {vin}</li>
                        </ul>
                    </div>
                    
                    <h3>Règleman ak Kondisyon:</h3>
                    <ol>
                        <li>Chofè a dwe peye vèsman chak jou a (1000 HTG) san mank.</li>
                        <li>Chofè a responsab tout domaj ak pèt ki pa kouvri pa asirans lan.</li>
                        <li>Moto a dwe toujou pwòp epi nan bon kondisyon mekanik.</li>
                    </ol>
                    
                    <br><br><br>
                    <div style="display: flex; justify-content: space-between; margin-top: 50px;">
                        <div>
                            <p>_______________________</p>
                            <p><strong>Siyati Tioby (Manadjè)</strong></p>
                        </div>
                        <div>
                            <p>_______________________</p>
                            <p><strong>Siyati Chofè a (Ak anprent)</strong></p>
                        </div>
                    </div>
                </body>
                </html>
                """
                
                st.success("Kontra a jere avèk siksè!")
                st.download_button(
                    label="📥 Telechaje Kontra a (HTML)",
                    data=kontra_html,
                    file_name=f"Kontra_{non_chofe.replace(' ', '_')}.html",
                    mime="text/html"
                )
                st.info("Ti Konsèy: Ouvri fichye HTML sa a sou Chrome epi peze Ctrl+P pou w sove l an PDF!")
            else:
                st.error("Tanpri ranpli Non Chofè a ak Plak Moto a pou pi piti.")

# ------------------------------------------
# TAB 4: RAPÒ IA
# ------------------------------------------
with tab_ia:
    st.header("🤖 Jeneratè Rapò Pwofesyonèl")
    st.markdown("Bouton sa a pran tout chif yo epi li ekri yon rapò pwofesyonèl pou ou pou w ka voye bay Efikas.")
    
    if st.button("Jere Rapò Mwa a Kounye a"):
        if df_peman.empty:
            st.error("Pa gen done poun fè rapò a.")
        else:
            total_peye = int(df_peman['montan_peye_htg'].sum())
            total_det = int(df_peman['reta_det_htg'].sum())
            kantite_chofe = df_peman['non_chofe'].nunique()
            dat_jodia = datetime.now().strftime("%d/%m/%Y")
            
            pèfòmans = "Ekselan" if total_det < (total_peye * 0.1) else "Mwayen (Dèt yo yon ti jan wo)"
            
            rapo = f"""
            ### RAPÒ MANADJÈ FLEETHT
            **Dat:** {dat_jodia}
            **Prepare pa:** Tioby (Administratè)
            **Pou:** Efikas (Envèstisè)

            ---

            **Bonjou Efikas,**

            Men brèf rapò operasyonèl ak finansye pou flòt moto a jiska dat {dat_jodia}:

            **1. Sitiyasyon Finansye:**
            - **Total Kòb Antre Net:** {total_peye:,.2f} HTG
            - **Total Lajan an Reta nan Lari a:** {total_det:,.2f} HTG
            - **Kantite Chofè Aktif:** {kantite_chofe}

            **2. Nòt Pèfòmans (IA Analiz):**
            Sitiyasyon aktyèl la jije kom: **{pèfòmans}**.
            *(Kòmantè sistèm lan: N ap kenbe dèt yo anba kontwòl. Chak chofè ki gen dèt jwenn yon avètisman nan men mwen regilyèman).*

            **3. Jesyon Materyèl:**
            Nou kontinye kenbe foto enspeksyon yo sou sistèm Cloud la. Moto yo ap fonksyone nòmalman. Sistèm bot la ap pèmèt mwen asire m pa gen okenn pèt.

            Mèsi pou konfyans ou,
            *Tioby*
            """
            
            st.success("Rapò a pwodui avèk siksè!")
            st.markdown(rapo)
            
            st.download_button(
                label="📥 Telechaje Rapò sa (Tèks)",
                data=rapo,
                file_name=f"Rapo_FleetHT_{dat_jodia.replace('/', '-')}.txt",
                mime="text/plain"
            )
