import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Hook de autenticação da coordenação (client-side).
// Durante o SSR e a hidratação inicial, loading=true; após checar a sessão no
// browser, resolve para logado/deslogado.
export function useAuth() {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!ativo) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      // Ao entrar/sair, invalida o cache para não servir dados de outra sessão.
      if (evento === "SIGNED_IN" || evento === "SIGNED_OUT") {
        qc.invalidateQueries();
      }
    });
    return () => {
      ativo = false;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return {
    session,
    user: session?.user ?? null,
    loading,
    signIn: (email: string, password: string) =>
      supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
}
