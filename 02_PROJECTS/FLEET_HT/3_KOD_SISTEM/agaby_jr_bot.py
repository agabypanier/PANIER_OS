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
    bot.reply_to(message, "Bonjou Panier Agaby Junior Duret! 👋\n\nMwen se asistan peman FleetHT ou a.\n\nPou anrejistre yon peman: `[Montan] [Non Chofè] [Plak]`\nEgzanp: `1000 Jean Pierre AA-1234`\n\nLòt kòmand ou ka itilize:\n/det - Wè lis moun ki gen dèt\n/rapo - Wè rapò jeneral", parse_mode="Markdown")

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

@bot.message_handler(content_types=['photo'])
def resevwa_foto(message):
    try:
        bot.reply_to(message, "⏳ N ap voye foto a sou Cloud la, yon ti pasyans...")
        # Pran foto a (pi gwo kalite a)
        photo = message.photo[-1]
        file_info = bot.get_file(photo.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        
        caption = message.caption if message.caption else ""
        plak = caption.replace("Foto", "").replace("foto", "").strip().upper()
        if not plak:
            plak = "PLAK_ENKONI"
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{plak}_{timestamp}.jpg"
        
        # Sove l tanporèman sou disk la
        temp_path = f"temp_{filename}"
        with open(temp_path, 'wb') as new_file:
            new_file.write(downloaded_file)
            
        # Pouse l nan Supabase Storage (Bucket "enspeksyon")
        supabase.storage.from_("enspeksyon").upload(
            file=temp_path,
            path=filename,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Pran lyen piblik la
        url = supabase.storage.from_("enspeksyon").get_public_url(filename)
        
        # Efase fichye tanporè a
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        # Sove URL la nan Baz de Done a
        data = {
            "plak": plak,
            "foto_url": url,
            "not_enspeksyon": "Enspeksyon via Telegram"
        }
        supabase.table("enspeksyon_fleetht").insert(data).execute()
        
        bot.reply_to(message, f"📸 **Siksè!** Foto a anrejistre sou Cloud la.\n\n**Plak:** {plak}\n🔗 [Klike isit la pou w wè foto a]({url})", parse_mode="Markdown")
        
    except Exception as e:
        bot.reply_to(message, f"❌ Erè lè n ap sove foto a. Èske w te kreye 'bucket' ki rele 'enspeksyon' an sou Supabase? Detay erè a: {str(e)}")

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
            "resevwa_pa": "Panier Agaby Junior Duret (Bot)",
            "komante": "Rantre pa Telegram"
        }
        supabase.table("peman_fleetht").insert(data).execute()
        
        bot.reply_to(message, f"✅ Peman Anrejistre nan Baz de Done a!\n\n**Dat:** {dat}\n**Chofè:** {non_chofe}\n**Plak:** {plak}\n**Montan:** {montan} HTG\n**Reta/Dèt kalkile:** {reta} HTG", parse_mode="Markdown")
        
    except Exception as e:
        bot.reply_to(message, f"❌ Gen yon erè ki fèt ak baz de done a: {str(e)}")

print("[INFO] Bot Panier Agaby Junior Duret ap koute mesaj yo e konekte sou Supabase...")
if TOKEN != "METE_TOKEN_OU_LA_A":
    bot.polling()
else:
    print("[AVETISMAN] TANPRI CHANJE TOKEN NAN 'agaby_jr_bot.py' ANVAN OU KOMANSE BOT LA!")
