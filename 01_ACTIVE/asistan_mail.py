import imaplib
import email
from email.header import decode_header
import json
import requests
import os
import time

# Fichye konfigirasyon an
CONFIG_FILE = os.path.join(os.path.dirname(__file__), "mail_config.json")

def chaje_konfigirasyon():
    """Chaje konfigirasyon nan Environment Variables (pou Web) oswa nan JSON (pou lokal)."""
    # Eseye jwenn nan Environment Variables anvan (GitHub Secrets)
    config = {
        "EMAIL_ADDRESS": os.environ.get("EMAIL_ADDRESS"),
        "GMAIL_APP_PASSWORD": os.environ.get("GMAIL_APP_PASSWORD"),
        "GROQ_API_KEY": os.environ.get("GROQ_API_KEY"),
        "TELEGRAM_BOT_TOKEN": os.environ.get("TELEGRAM_BOT_TOKEN"),
        "TELEGRAM_CHAT_ID": os.environ.get("TELEGRAM_CHAT_ID")
    }
    
    # Si nou pa jwenn yo nan Env, nou li fichye JSON la
    if not config["EMAIL_ADDRESS"]:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r') as f:
                return json.load(f)
        else:
            raise Exception("Pa jwenn okenn konfigirasyon (ni nan Env, ni nan JSON).")
            
    return config

def jwenn_rezime_groq(kontni, api_key):
    """Sèvi ak Groq API pou jwenn yon rezime kout sou imèl la."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    prompt = f"""Ou se Asistan Estratejik Pèsonèl Agaby (Sistèm PANIER OS).
Objektif ou se analize imèl sa a:
1. Si se yon piblisite, yon spam, yon newsletter ki pa enpòtan, oswa yon notifikasyon otomatik ki pa mande aksyon, reponn sèlman ak mo "IGNORE".
2. Si se yon imèl enpòtan (biznis, karyè, DINEPA, pwojè, sekirite, oswa mesaj pèsonèl), fè yon rezime 1 oswa 2 fraz senp an Kreyòl.

Pa ekri anyen anplis, sèlman rezime a oswa mo "IGNORE" a.

Imèl:
{kontni}
"""
    
    data = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 150
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code != 200:
            print(f"Erè Groq ({response.status_code}): {response.text}")
        response.raise_for_status()
        rezilta = response.json()
        return rezilta['choices'][0]['message']['content'].strip()
    except Exception as e:
        return f"[Erè AI: {e}]"

def li_imel_ki_poko_li(email_addr, app_password):
    """Konekte sou Gmail epi rale dènye imèl yo ki poko li (UNSEEN)."""
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    try:
        mail.login(email_addr, app_password)
        mail.select("inbox")
        
        # Chèche imèl ki poko li
        status, messages = mail.search(None, "UNSEEN")
        imel_ids = messages[0].split()
        
        rezilta_imel = []
        
        # N ap pran sèlman 10 dènye imèl ki poko li yo pou l pa pran twòp tan
        pou_tcheke = imel_ids[-10:] if len(imel_ids) > 10 else imel_ids
        
        for imel_id in pou_tcheke:
            _, msg_data = mail.fetch(imel_id, "(RFC822)")
            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Dekode Sijè a
                    subject, encoding = decode_header(msg["Subject"])[0]
                    if isinstance(subject, bytes):
                        subject = subject.decode(encoding if encoding else "utf-8")
                    
                    # Jwenn Moun ki voye l la
                    from_ = msg.get("From")
                    
                    # Jwenn Kontni an
                    kontni = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            
                            if content_type == "text/plain" and "attachment" not in content_disposition:
                                kontni = part.get_payload(decode=True).decode(errors='replace')
                                break
                    else:
                        kontni = msg.get_payload(decode=True).decode(errors='replace')
                        
                    # Koupe kontni an pou l pa twò long pou Groq (paske l gratis, li gen limit)
                    kontni_kout = kontni[:1000]
                    
                    rezilta_imel.append({
                        "subject": subject,
                        "from": from_,
                        "body": kontni_kout
                    })
        return rezilta_imel
    finally:
        mail.logout()

def voye_telegram(bot_token, chat_id, text):
    """Voye mesaj la sou Telegram."""
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = {
        "chat_id": chat_id,
        "text": text
    }
    response = requests.post(url, data=data)
    if response.status_code != 200:
        print(f"Erè Telegram: {response.text}")

def main():
    print("PANIER OS - Kòmanse Asistan Mail la...")
    config = chaje_konfigirasyon()
    
    if config["GMAIL_APP_PASSWORD"] == "METE_MODPAS_APLIKASYON_GMAIL_LA_LA":
        print("ERE: Ou dwe mete yon Modpas Aplikasyon Gmail nan mail_config.json anvan.")
        return
        
    print("1. Ap chèche imèl ki poko li nan bwat la...")
    imel_yo = li_imel_ki_poko_li(config["EMAIL_ADDRESS"], config["GMAIL_APP_PASSWORD"])
    
    if not imel_yo:
        print("Pa gen okenn nouvo imèl pou rezime jodi a.")
        return
        
    print(f"2. Jwenn {len(imel_yo)} imèl k ap tann. Ap prepare rezime ak Groq AI...")
    telegram_msg = "📧 REZIME IMÈL KI POKO LI YO\n\n"
    
    for m in imel_yo:
        rezime = jwenn_rezime_groq(m["body"], config["GROQ_API_KEY"])
        
        # Si AI a di pou n inyore l, nou sote l
        if "IGNORE" in rezime.upper():
            safe_subject = m['subject'].encode('ascii', 'ignore').decode('ascii')
            print(f"- Sote (SPAM/Inil): {safe_subject}")
            time.sleep(5)
            continue
            
        # Netwaye subject la pou console Windows la pa bay erè si gen emoji
        safe_subject = m['subject'].encode('ascii', 'ignore').decode('ascii')
        print(f"- Fini rezime pou: {safe_subject}")
        telegram_msg += f"👤 Soti nan: {m['from']}\n📌 Sijè: {m['subject']}\n🤖 AI: {rezime}\n\n"
        # Tann 5 segonn pou evite rate limit Groq (Free tier a gen limit 6000 TPM)
        time.sleep(5)
        
    print("3. Ap voye rezime a sou Telegram...")
    voye_telegram(config["TELEGRAM_BOT_TOKEN"], config["TELEGRAM_CHAT_ID"], telegram_msg)
    print("Fini! Rezime a voye ak siksè sou Telegram.")

if __name__ == "__main__":
    main()
