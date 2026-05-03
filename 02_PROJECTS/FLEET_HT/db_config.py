import os
from supabase import create_client, Client

# POU EFIKAS OUBYEN AGABY:
# 1. Al sou supabase.com, kreye yon pwojè
# 2. Pran URL la ak KEY la nan pati "Project Settings -> API"
# 3. Ranplase valè anba yo ak vrè valè pa w yo

SUPABASE_URL = "https://dqnrhzcfhdhzlszzpujc.supabase.co"
SUPABASE_KEY = "sb_secret_w0BTL-LyqVfJRLY-4_xE4g_9whfmQee"

def get_supabase_client() -> Client:
    # Sa ede nou konekte ak baz de done a nenpòt kote
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase
