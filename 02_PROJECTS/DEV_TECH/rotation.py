"""
🔄 Groq Key Rotation — Windows 24/7
Kouri sa nan yon lòt fenèt PowerShell pandan Gateway ap kouri
"""
import time, requests, json, os, subprocess

GROQ_KEYS = [
    "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",
    "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",
    "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",
    "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",
    "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",
    "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",
]

CONFIG_PATH = os.path.expanduser(r"~\.openclaw\openclaw.json")
MODEL_FAST  = "llama-3.1-8b-instant"
MODEL_SMART = "llama-3.3-70b-versatile"

state = {
    "index": 0,
    "blocked_until": {k: 0 for k in GROQ_KEYS}
}

def test_key(key):
    try:
        r = requests.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": MODEL_FAST,
                  "messages": [{"role":"user","content":"Hi"}],
                  "max_tokens": 5},
            timeout=10
        )
        if r.status_code == 200: return True, 0
        if r.status_code == 429: return False, int(r.headers.get("retry-after", 60))
        return False, 300
    except: return False, 30

def get_active_key():
    now = time.time()
    for i in range(len(GROQ_KEYS)):
        idx = (state["index"] + i) % len(GROQ_KEYS)
        k = GROQ_KEYS[idx]
        if state["blocked_until"][k] < now:
            state["index"] = idx
            return k
    next_k = min(GROQ_KEYS, key=lambda k: state["blocked_until"][k])
    wait = state["blocked_until"][next_k] - now
    print(f"⏳ Tout kle limite — tann {wait:.0f}s...")
    time.sleep(wait + 1)
    return next_k

def write_config(key):
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config = json.load(f)
    config["models"]["providers"]["groq"]["apiKey"] = key
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

def restart_gateway():
    os.system("taskkill /f /im openclaw.exe 2>nul")
    os.system("taskkill /f /im node.exe 2>nul")
    time.sleep(3)
    subprocess.Popen(
        ["openclaw", "gateway", "--port", "18789"],
        creationflags=subprocess.CREATE_NEW_CONSOLE
    )
    print(f"✅ Gateway restarted ak kle {state['index']+1}")

# ── Teste tout kle ────────────────────────────────────────────
print("🔑 Teste kle Groq yo...")
for i, k in enumerate(GROQ_KEYS):
    ok, err = test_key(k)
    print(f"  Kle {i+1}: {'✅' if ok else f'❌ bloke {err}s'}")

print(f"\n✅ Watchdog aktif — verifye chak 30s")
print(f"   Kle aktif kounye a: {state['index']+1}/{len(GROQ_KEYS)}\n")

# ── Watchdog loop ─────────────────────────────────────────────
while True:
    time.sleep(30)
    cur = GROQ_KEYS[state["index"]]
    ok, retry = test_key(cur)

    if not ok:
        print(f"⚠️  [{time.strftime('%H:%M:%S')}] Kle {state['index']+1} limite!")
        state["blocked_until"][cur] = time.time() + (retry or 60)
        state["index"] = (state["index"] + 1) % len(GROQ_KEYS)
        new_key = get_active_key()
        write_config(new_key)
        restart_gateway()
    else:
        print(f"[{time.strftime('%H:%M:%S')}] Kle {state['index']+1} ✅ aktif")