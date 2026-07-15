// BIO — Edge Function: reprocessar-email (painel técnico do Canal B)
// A coordenação clica "Reprocessar" num e-mail da fila (ex.: "não reconhecido",
// depois de mapear o remetente numa fonte). Esta função lê o e-mail guardado em
// emails_recebidos e o reenvia à `ingest-email` (que faz o parsing/dedup/inserção),
// depois atualiza a linha original para "reprocessado". Só admin pode chamar.
//
// Deploy: supabase functions deploy reprocessar-email  (verify_jwt=true)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;

  // 1) confirma que quem chama é admin (usa o JWT do usuário)
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin, error: erroAdmin } = await asUser.rpc("bio_is_admin");
  if (erroAdmin || !isAdmin) return json({ ok: false, erro: "acesso restrito" }, 403);

  let body: { email_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!body.email_id) return json({ ok: false, erro: "email_id obrigatório" }, 400);

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: em } = await svc
    .from("emails_recebidos")
    .select("id, remetente, assunto, corpo_raw")
    .eq("id", body.email_id)
    .maybeSingle();
  if (!em) return json({ ok: false, erro: "e-mail não encontrado" }, 404);
  if (!em.corpo_raw) return json({ ok: false, erro: "corpo já removido (limpeza LGPD 90d)" }, 409);

  const { data: cfg } = await svc
    .from("app_config").select("valor").eq("chave", "ingest_email_secret").maybeSingle();

  // 2) reenvia à ingest-email (x-bio-reprocess evita regravar em emails_recebidos)
  const resp = await fetch(`${url}/functions/v1/ingest-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bio-secret": cfg?.valor ?? "",
      "x-bio-reprocess": "1",
    },
    body: JSON.stringify({
      from: em.remetente ?? "",
      subject: em.assunto ?? "",
      html: em.corpo_raw,
    }),
  });
  const resultado = await resp.json().catch(() => ({}));
  const novas = Number(resultado?.novos ?? 0);
  const nomeFonte = resultado?.fonte as string | undefined;

  // 3) resolve fonte_id (se reconheceu) e atualiza a linha original
  let fonteId: string | null = null;
  if (nomeFonte) {
    const { data: f } = await svc
      .from("fontes_coleta").select("id").eq("nome", nomeFonte).eq("canal", "canal_b_email").maybeSingle();
    fonteId = f?.id ?? null;
  }
  await svc.from("emails_recebidos")
    .update({ status_parsing: "reprocessado", vagas_geradas: novas, ...(fonteId ? { fonte_id: fonteId } : {}) })
    .eq("id", em.id);

  return json({ ok: true, reconhecido: !!nomeFonte, fonte: nomeFonte ?? null, novas, resultado });
});
