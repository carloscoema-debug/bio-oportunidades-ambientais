// BIO — Edge Function: digest-curadoria (Fase 2 · F2-11)
// Roda diariamente (pg_cron, 07h BRT). Se há vagas PENDENTES na fila, envia um
// e-mail à coordenação com o resumo (quantas novas nas últimas 24h + a lista) e
// um link direto para a fila. Se a fila está vazia, não envia (zero ruído).
//
// Auth: cron-only, via header x-bio-secret == app_config.ingest_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

  // fila pendente, priorizada por aderência e urgência
  const { data: vagas } = await svc
    .from("vagas")
    .select("titulo, empresa_orgao, origem, score_aderencia, score_urgencia, data_captura")
    .eq("status", "pendente")
    .order("score_aderencia", { ascending: false })
    .order("score_urgencia", { ascending: false })
    .limit(25);

  const lista = vagas ?? [];
  if (lista.length === 0) {
    return json({ ok: true, pulou: true, motivo: "fila_vazia" });
  }

  // quantas chegaram nas últimas 24h (destaque do dia)
  const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const novas24h = lista.filter((v) => v.data_captura && v.data_captura >= ontem).length;

  const itens = lista
    .slice(0, 20)
    .map((v) => {
      const fonte = v.origem ? ` <span style="color:#8A968C">· ${esc(v.origem)}</span>` : "";
      const emp = v.empresa_orgao ? ` <span style="color:#55645B">— ${esc(v.empresa_orgao)}</span>` : "";
      return `<li style="margin:0 0 7px 0">${esc(v.titulo)}${emp}${fonte}</li>`;
    })
    .join("");

  const extra = lista.length > 20
    ? `<p style="font-size:13px;color:#8A968C;margin:2px 0 14px">…e mais ${lista.length - 20} na fila.</p>`
    : "";

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#1B2A21">
    <p style="font-size:20px;font-weight:800;color:#0D6B44;margin:0 0 4px">BIO<span style="color:#B97A1B">.</span></p>
    <p style="font-size:16px;font-weight:700;margin:0 0 4px">Fila de curadoria — resumo do dia</p>
    <p style="font-size:14px;color:#5B6B60;margin:0 0 14px">
      Há <strong>${lista.length}</strong> vaga(s) aguardando revisão${novas24h > 0 ? `, sendo <strong>${novas24h}</strong> nova(s) nas últimas 24h` : ""}.
      Revise, aprove as boas e rejeite o que não se aplica.
    </p>
    <ul style="font-size:14px;padding-left:18px;margin:0 0 6px">${itens}</ul>
    ${extra}
    <a href="${esc(portalBase)}/admin?aba=fila" style="display:inline-block;background:#0D6B44;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:9px">Abrir a fila de curadoria →</a>
    <p style="font-size:12px;color:#8A968C;margin-top:20px">Você recebe este resumo só quando há vagas pendentes. Aviso automático do BIO.</p>
  </div>`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: `BIO · ${lista.length} vaga(s) para curar${novas24h > 0 ? ` (${novas24h} nova(s))` : ""}`,
      html,
    }),
  });

  return json({ ok: resp.ok, enviou: resp.ok, pendentes: lista.length, novas24h, para });
});
