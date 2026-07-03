import { createClient } from "@supabase/supabase-js";

// Projeto BIO_Oportunidades_ambientais (sa-east-1).
// A chave publishable/anon é pública por design e protegida pela RLS do banco —
// nunca colocar aqui a service_role.
const SUPABASE_URL = "https://izqqrbqucmcwsgsluzkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_onG8SVFtjNd025d_gW8oLQ_-QxvE6iQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Portal público: leitura anônima, sem sessão persistida (SSR-safe).
    // O painel autenticado (Fase 1A/P5) configurará auth próprio.
    persistSession: false,
    autoRefreshToken: false,
  },
});
