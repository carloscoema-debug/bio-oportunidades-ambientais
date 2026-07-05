// BIO — Edge Function: newsletter-lembrete (Fase 3 · newsletter semi-automática)
// Roda semanal (pg_cron). Seleciona as vagas aprovadas ainda não enviadas e AVISA
// a coordenação por e-mail ("newsletter da semana pronta — N vagas"), com link para
// o painel. NÃO envia para os assinantes — o disparo real continua com 1 clique humano.
// Guarda: se houver menos de MIN_VAGAS novas, pula a semana (não avisa).
//
// Auth: cron-only, via header x-bio-secret == app_config.ingest_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MIN_VAGAS = 3;
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const json = (b: unknown, s = 200) => Response.json(b, { status: s });

Deno.serve(async (req) => {
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cfg = async (k: string) =>
    (await svc.from("app_config").select("valor").eq("chave", k).maybeSingle()).data?.valor ?? null;

  // auth por segredo compartilhado (cron)
  const segredo = await cfg("ingest_email_secret");
  if (!segredo || req.headers.get("x-bio-secret") !== segredo) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }

  const apiKey = await cfg("resend_api_key");
  const remetente = (await cfg("newsletter_remetente")) ?? "vagas@biooportunidades.org";
  const portalBase = (await cfg("portal_base_url")) ?? "";
  const para = await cfg("coordenacao_email");
  if (!apiKey || !para) return json({ ok: false, erro: "config incompleta (resend/coordenacao)" }, 500);

  const hoje = new Date().toISOString().slice(0, 10);
  const { data: vagas } = await svc
    .from("vagas")
    .select("id, titulo, empresa_orgao, data_expiracao_calculada")
    .eq("status", "aprovada")
    .is("data_envio_newsletter", null)
    .or(`data_expiracao_calculada.is.null,data_expiracao_calculada.gte.${hoje}`)
    .order("score_aderencia", { ascending: false })
    .order("score_urgencia", { ascending: false })
    .limit(12);

  const lista = vagas ?? [];
  if (lista.length < MIN_VAGAS) {
    return json({ ok: true, pulou: true, motivo: "poucas_vagas", vagas: lista.length });
  }

  const itens = lista
    .map((v) => `<li style="margin:0 0 6px 0">${esc(v.titulo)}${v.empresa_orgao ? ` <span style="color:#8A968C">— ${esc(v.empresa_orgao)}</span>` : ""}</li>`)
    .join("");

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#1B2A21">
    <p style="font-size:20px;font-weight:800;color:#0D6B44;margin:0 0 4px">BIO<span style="color:#B97A1B">.</span></p>
    <p style="font-size:16px;font-weight:700;margin:0 0 4px">Newsletter da semana pronta para revisar</p>
    <p style="font-size:14px;color:#5B6B60;margin:0 0 14px">Há <strong>${lista.length}</strong> vaga(s) nova(s) sugerida(s). Revise e envie quando quiser — nada é disparado automaticamente.</p>
    <ul style="font-size:14px;padding-left:18px;margin:0 0 18px">${itens}</ul>
    <a href="${esc(portalBase)}/admin?aba=newsletter" style="display:inline-block;background:#0D6B44;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:9px">Abrir o painel e revisar →</a>
    <p style="font-size:12px;color:#8A968C;margin-top:20px">No painel, as vagas novas já vêm pré-selecionadas na aba Newsletter. Aviso automático do BIO.</p>
  </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: `BIO · newsletter pronta para revisar (${lista.length} vagas)`,
      html,
    }),
  });

  return json({ ok: resp.ok, avisou: resp.ok, vagas: lista.length, para });
});
