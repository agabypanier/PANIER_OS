import os
from supabase import create_client, Client

# POU PANIER SCHNIDER OUBYEN AGABY:
# 1. Al sou supabase.com, kreye yon pwojè
# 2. Pran URL la ak KEY la nan pati "Project Settings -> API"
# 3. Ranplase valè anba yo ak vrè valè pa w yo

SUPABASE_URL = "https://dqnrhzcfhdhzlszzpujc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxbnJoemNmaGRoemxzenpwdWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MTE2NTIsImV4cCI6MjA5MzM4NzY1Mn0.7gOnjgTVM-_7fV5eEHCHFgwm_mzsUtOQcYZ0kODjy98"

def get_supabase_client() -> Client:
    # Sa ede nou konekte ak baz de done a nenpòt kote
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase
