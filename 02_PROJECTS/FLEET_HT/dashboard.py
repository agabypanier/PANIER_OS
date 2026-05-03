import streamlit as st
import pandas as pd
import plotly.express as px
from db_config import get_supabase_client

# Configured Page
st.set_page_config(page_title="FleetHT Dashboard", page_icon="🏍️", layout="wide")

st.title("🏍️ FleetHT - Sistèm Jesyon Peman (Cloud)")
st.markdown("Byenveni nan Dashboard FleetHT a. Kote ou ka swiv tout peman ak dèt chofè yo an tan reyèl soti nan Supabase.")

supabase = get_supabase_client()

# Function to load data
@st.cache_data(ttl=60)
def load_data():
    try:
        response = supabase.table("peman_fleetht").select("*").execute()
        if not response.data:
            return pd.DataFrame()
            
        df = pd.DataFrame(response.data)
        
        # Convert numeric columns safely
        df['montan_peye_htg'] = pd.to_numeric(df['montan_peye_htg'], errors='coerce').fillna(0)
        df['reta_det_htg'] = pd.to_numeric(df['reta_det_htg'], errors='coerce').fillna(0)
        
        return df
    except Exception as e:
        st.error(f"Erè lè n ap konekte ak baz de done a: {str(e)}")
        return pd.DataFrame()

df = load_data()

if not df.empty:
    # Top Level Metrics
    total_peye = df['montan_peye_htg'].sum()
    total_det = df['reta_det_htg'].sum()
    kantite_chofe = df['non_chofe'].nunique()

    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric(label="Total Lajan Antre (HTG)", value=f"{total_peye:,.2f}")
    
    with col2:
        st.metric(label="Total Dèt/Reta (HTG)", value=f"{total_det:,.2f}")
        
    with col3:
        st.metric(label="Kantite Chofè Aktif", value=kantite_chofe)
        
    st.markdown("---")
    
    # Charts Area
    col_chart1, col_chart2 = st.columns(2)
    
    with col_chart1:
        st.subheader("Peman chak jou")
        # Aggregate by Date
        df_date = df.groupby('dat')['montan_peye_htg'].sum().reset_index()
        fig1 = px.bar(df_date, x='dat', y='montan_peye_htg', title='Lajan Ki Antre Pa Dat', text_auto=True, color_discrete_sequence=['#1e3a8a'])
        st.plotly_chart(fig1, use_container_width=True)
        
    with col_chart2:
        st.subheader("Dèt pa Chofè")
        df_det = df.groupby('non_chofe')['reta_det_htg'].sum().reset_index()
        df_det = df_det[df_det['reta_det_htg'] > 0]
        if not df_det.empty:
            fig2 = px.pie(df_det, names='non_chofe', values='reta_det_htg', title='Repatisyon Dèt Yo', color_discrete_sequence=px.colors.sequential.RdBu)
            st.plotly_chart(fig2, use_container_width=True)
        else:
            st.info("Pa gen okenn chofè ki gen dèt kounye a! 🎉")
            
    st.markdown("---")
    
    # Detailed Data Table
    st.subheader("Detay Peman Yo (Live DB)")
    st.dataframe(df, use_container_width=True)
    
else:
    st.warning("Poko gen okenn done nan baz de done Supabase la. Tanpri ajoute peman nan Telegram pou wè yo isit la.")
