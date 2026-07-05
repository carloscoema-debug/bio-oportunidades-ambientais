// BIO — Edge Function: verificar-links (Fase 4 · F4-03)
// Roda diária (pg_cron). Testa o link de candidatura de cada vaga PUBLICADA.
// Classifica: ativo / redirecionado / inacessível. Bloqueio de bot (401/403/429/999)
// é tratado como INCONCLUSIVO (não conta como quebra — evita falso positivo).
// 3 falhas reais consecutivas (404/410/5xx/timeout) → status_link='inacessivel' → alerta na fila.
//
// Auth: cron-only via x-bio-secret == app_config.ingest_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UA = "Mozilla/5.0 (compatible; BIO-linkcheck/1.0; +https://www.biooportunidades.org)";
const json = (b: unknown, s = 200) => Response.json(b, { status: s });

type Estado = "ativo" | "redirecionado" | "falha" | "inconclusivo";

async function checar(url: string): Promise<{ estado: Estado; msg: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    let resp = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (resp.status === 405 || resp.status === 501) {
      resp = await fetch(url, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA } });
    }
    const s = resp.status;
    if (s >= 200 && s < 300) return { estado: resp.redirected ? "redirecionado" : "ativo", msg: null };
    if (s === 404 || s === 410 || s >= 500) return { estado: "falha", msg: `HTTP ${s}` };
    return { estado: "inconclusivo", msg: `inconclusivo (HTTP ${s})` };
  } catch (e) {
    const m = String(e instanceof Error ? e.message : e);
    return { estado: "falha", msg: m.includes("abort") ? "timeout" : m.slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cfg } = await svc.from("app_config").select("valor").eq("chave", "ingest_email_secret").maybeSingle();
  if (!cfg?.valor || req.headers.get("x-bio-secret") !== cfg.valor) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }

  const { data: vagas } = await svc
    .from("vagas")
    .select("id, link_candidatura, link_falhas_consecutivas, status_link")
    .eq("status", "aprovada")
    .not("link_candidatura", "is", null);

  const agora = new Date().toISOString();
  let ativos = 0, redirecionados = 0, inacessiveis = 0, inconclusivos = 0;

  for (const v of vagas ?? []) {
    const { estado, msg } = await checar(v.link_candidatura as string);

    if (estado === "ativo" || estado === "redirecionado") {
      if (estado === "ativo") ativos++; else redirecionados++;
      await svc.from("vagas").update({
        status_link: estado,
        link_falhas_consecutivas: 0,
        mensagem_verificacao_link: null,
        data_ultima_verificacao_link: agora,
      }).eq("id", v.id);
    } else if (estado === "inconclusivo") {
      inconclusivos++;
      // não conta como quebra; só registra a data e a nota
      await svc.from("vagas").update({
        mensagem_verificacao_link: msg,
        data_ultima_verificacao_link: agora,
      }).eq("id", v.id);
    } else {
      // falha real
      const novas = (v.link_falhas_consecutivas ?? 0) + 1;
      const inacessivel = novas >= 3;
      if (inacessivel) inacessiveis++;
      await svc.from("vagas").update({
        link_falhas_consecutivas: novas,
        status_link: inacessivel ? "inacessivel" : (v.status_link ?? "nao_verificado"),
        mensagem_verificacao_link: msg,
        data_ultima_verificacao_link: agora,
      }).eq("id", v.id);
    }
  }

  return json({
    ok: true,
    verificadas: (vagas ?? []).length,
    ativos, redirecionados, inacessiveis, inconclusivos,
  });
});
