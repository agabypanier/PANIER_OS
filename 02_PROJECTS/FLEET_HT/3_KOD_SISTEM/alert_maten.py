import os
import telebot
import pandas as pd
from db_config import get_supabase_client

# Konfigirasyon
TOKEN = "8640070719:AAFy1f1B5BGBpt9CaAbItZ_ftM3PLexEhOs"
bot = telebot.TeleBot(TOKEN)
supabase = get_supabase_client()

# METE CHAT ID PANIER AGABY JUNIOR DURET A LA (Li ka jwenn li si l ekri @userinfobot sou Telegram)
# Nou pral bezwen l nan GitHub Secrets sou non TELEGRAM_CHAT_ID
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "METE_CHAT_ID_A_LA")

def voye_alert_maten():
    try:
        response = supabase.table("peman_fleetht").select("*").execute()
        if not response.data:
            print("Pa gen done peman nan baz la.")
            return
            
        df = pd.DataFrame(response.data)
        df['reta_det_htg'] = pd.to_numeric(df['reta_det_htg'], errors='coerce').fillna(0)
        df_det = df.groupby('non_chofe')['reta_det_htg'].sum().reset_index()
        df_det = df_det[df_det['reta_det_htg'] > 0]
        
        if df_det.empty:
            mesaj = "🎉 **Bòn Nouvèl Panier Agaby Junior Duret!**\nPa gen okenn chofè ki gen dèt pou kounye a."
        else:
            mesaj = "⚠️ **ALÈT MATEN - LIS MOUN KI DWE:**\nBonjou Panier Agaby Junior Duret, men chofè ou dwe rele jodi a:\n\n"
            for index, row in df_det.iterrows():
                mesaj += f"🔴 {row['non_chofe']}: {int(row['reta_det_htg'])} HTG\n"
            mesaj += "\n*(Mesaj otomatik ki soti sou sistèm FleetHT a)*"
            
        bot.send_message(CHAT_ID, mesaj, parse_mode="Markdown")
        print("✅ Alèt voye avèk siksè!")
        
    except Exception as e:
        print(f"❌ Erè lè n ap voye alèt la: {str(e)}")

if __name__ == "__main__":
    if CHAT_ID != "METE_CHAT_ID_A_LA":
        voye_alert_maten()
    else:
        print("⚠️ Tanpri mete CHAT_ID Panier Agaby Junior Duret a oswa kreye yon variable anviwònman TELEGRAM_CHAT_ID.")
