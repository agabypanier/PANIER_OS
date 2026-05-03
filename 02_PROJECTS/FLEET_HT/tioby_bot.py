import telebot
import pandas as pd
import os
from datetime import datetime
from db_config import get_supabase_client

# Mete Token Telegram ou a isit la (Jwenn li nan BotFather)
TOKEN = "8640070719:AAFy1f1B5BGBpt9CaAbItZ_ftM3PLexEhOs"
bot = telebot.TeleBot(TOKEN)
supabase = get_supabase_client()

@bot.message_handler(commands=['start', 'help'])
def send_welcome(message):
    bot.reply_to(message, "Bonjou Tioby! 👋\n\nMwen se asistan peman FleetHT ou a.\n\nPou anrejistre yon peman: `[Montan] [Non Chofè] [Plak]`\nEgzanp: `1000 Jean Pierre AA-1234`\n\nLòt kòmand ou ka itilize:\n/det - Wè lis moun ki gen dèt\n/rapo - Wè rapò jeneral", parse_mode="Markdown")

@bot.message_handler(commands=['det'])
def montre_det(message):
    try:
        response = supabase.table("peman_fleetht").select("*").execute()
        if not response.data:
            bot.reply_to(message, "⚠️ Pa gen okenn done peman ankò nan baz de done a.")
            return
            
        df = pd.DataFrame(response.data)
        df['reta_det_htg'] = pd.to_numeric(df['reta_det_htg'], errors='coerce').fillna(0)
        df_det = df.groupby('non_chofe')['reta_det_htg'].sum().reset_index()
        df_det = df_det[df_det['reta_det_htg'] > 0]
        
        if df_det.empty:
            bot.reply_to(message, "🎉 Pa gen okenn chofè ki gen dèt kounye a!")
        else:
            mesaj = "⚠️ **Lis Chofè ki gen Dèt:**\n\n"
            for index, row in df_det.iterrows():
                mesaj += f"- {row['non_chofe']}: {int(row['reta_det_htg'])} HTG\n"
            bot.reply_to(message, mesaj, parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Erè baz de done: {str(e)}")

@bot.message_handler(commands=['rapo'])
def montre_rapo(message):
    try:
        response = supabase.table("peman_fleetht").select("*").execute()
        if not response.data:
            bot.reply_to(message, "⚠️ Pa gen okenn done peman ankò nan baz de done a.")
            return
            
        df = pd.DataFrame(response.data)
        df['montan_peye_htg'] = pd.to_numeric(df['montan_peye_htg'], errors='coerce').fillna(0)
        df['reta_det_htg'] = pd.to_numeric(df['reta_det_htg'], errors='coerce').fillna(0)
        
        total_peye = int(df['montan_peye_htg'].sum())
        total_det = int(df['reta_det_htg'].sum())
        kantite_chofe = df['non_chofe'].nunique()
        
        mesaj = f"📊 **Rapò Jeneral FleetHT:**\n\n"
        mesaj += f"💰 **Total Lajan Antre:** {total_peye} HTG\n"
        mesaj += f"🔴 **Total Dèt nan lari a:** {total_det} HTG\n"
        mesaj += f"🏍️ **Kantite Chofè:** {kantite_chofe}\n"
        bot.reply_to(message, mesaj, parse_mode="Markdown")
    except Exception as e:
        bot.reply_to(message, f"❌ Erè baz de done: {str(e)}")

@bot.message_handler(func=lambda message: True)
def anrejistre_peman(message):
    teks = message.text.strip().split()
    
    if len(teks) < 3:
        bot.reply_to(message, "⚠️ Fòma a pa bon.\n\nTanpri itilize fòma sa a: `Montan Non_Chofe Plak`\nEgzanp: `1000 Jean_Pierre AA-1234`\n*(Si non an gen plizyè mo, kole yo oswa itilize sèlman prenon an)*", parse_mode="Markdown")
        return
        
    try:
        montan = float(teks[0])
        plak = teks[-1].upper()
        non_chofe = " ".join(teks[1:-1])
        
        # Kalkile reta (1000 goud - montan peye = reta)
        reta = 1000 - montan
        if reta < 0:
            reta = 0
            
        dat = datetime.now().strftime("%d/%m/%Y")
        
        # Enpoze nan Supabase
        data = {
            "dat": dat,
            "non_chofe": non_chofe,
            "moto_plak": plak,
            "montan_peye_htg": montan,
            "reta_det_htg": reta,
            "resevwa_pa": "Tioby (Bot)",
            "komante": "Rantre pa Telegram"
        }
        supabase.table("peman_fleetht").insert(data).execute()
        
        bot.reply_to(message, f"✅ Peman Anrejistre nan Baz de Done a!\n\n**Dat:** {dat}\n**Chofè:** {non_chofe}\n**Plak:** {plak}\n**Montan:** {montan} HTG\n**Reta/Dèt kalkile:** {reta} HTG", parse_mode="Markdown")
        
    except Exception as e:
        bot.reply_to(message, f"❌ Gen yon erè ki fèt ak baz de done a: {str(e)}")

print("[INFO] Bot Tioby ap koute mesaj yo e konekte sou Supabase...")
if TOKEN != "METE_TOKEN_OU_LA_A":
    bot.polling()
else:
    print("[AVETISMAN] TANPRI CHANJE TOKEN NAN 'tioby_bot.py' ANVAN OU KOMANSE BOT LA!")
