import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Projeto Supabase das contas, combos da comunidade e decks salvos (supabase/migrations/).
// A chave pública (publishable/anon) é feita para ficar no app: a segurança vem das regras
// (RLS) do banco. A senha do Postgres nunca entra aqui.
export const SUPABASE_URL = "https://spgphpwnnvympqeejsaq.supabase.co";
export const SUPABASE_KEY = "";

let client: SupabaseClient | null = null;

/** Cliente do Supabase; null enquanto a chave pública não estiver configurada */
export function supabase(): SupabaseClient | null {
  if (!SUPABASE_KEY) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  return client;
}

export const supabaseReady = () => !!SUPABASE_KEY;
