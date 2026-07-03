import { createClient } from "@supabase/supabase-js";

// Projeto BIO_Oportunidades_ambientais (sa-east-1).
// A chave publishable/anon é pública por design e protegida pela RLS do banco —
// nunca colocar aqui a service_role.
const SUPABASE_URL = "https://izqqrbqucmcwsgsluzkn.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_onG8SVFtjNd025d_gW8oLQ_-QxvE6iQ";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Sessão persistida (localStorage) para o login da coordenação (/admin).
    // supabase-js só acessa o storage no browser, então é SSR-safe: durante o
    // render no servidor não há acesso a localStorage. O portal público segue
    // funcionando como leitura anônima (o anon simplesmente não tem sessão).
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
