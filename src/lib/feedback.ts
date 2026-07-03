import { supabase } from "@/integrations/supabase/client";

// Token anônimo por navegador (localStorage). Serve de proteção anti-spam:
// o banco impede feedback repetido do mesmo tipo, para a mesma vaga, com o mesmo token.
const TOKEN_KEY = "bio_feedback_token";

export function getFeedbackToken(): string {
  if (typeof window === "undefined") return "";
  let t = window.localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

type FeedbackResposta = { ok: boolean; erro?: string };

export async function registrarFeedback(
  vagaId: string,
  tipo: string,
): Promise<FeedbackResposta> {
  const token = getFeedbackToken();
  const { data, error } = await supabase.rpc("registrar_feedback", {
    p_vaga_id: vagaId,
    p_tipo: tipo,
    p_token: token,
  });
  if (error) return { ok: false, erro: error.message };
  return (data as FeedbackResposta) ?? { ok: false, erro: "sem_resposta" };
}
