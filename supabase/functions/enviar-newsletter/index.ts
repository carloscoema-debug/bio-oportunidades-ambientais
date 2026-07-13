// BIO — Edge Function: enviar-newsletter (Fase 3 · F3-02)
// A coordenação seleciona vagas + assunto no painel e dispara a newsletter.
// Envia via Resend (chave em app_config) para os assinantes ativos, com link de
// opt-out por assinante (token), e registra em notificacoes_enviadas.
// Só admin pode chamar (verify_jwt=true + bio_is_admin).
//
// Body: { vaga_ids: string[], assunto: string, teste_para?: string }
//   teste_para → envia só um e-mail de teste para esse endereço (não registra, não usa a lista).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const REGIAO_LABEL: Record<string, string> = {
  fortaleza: "Fortaleza", rmf: "Região Metropolitana", interior: "Interior do Ceará",
  remoto: "Remoto", outro_estado: "Outro estado", indefinido: "A confirmar",
};

interface Vaga {
  id: string; titulo: string; empresa_orgao: string | null;
  regiao: string | null; tipo: string | null; link_candidatura: string | null;
}

function cardVaga(v: Vaga): string {
  const regiao = v.regiao ? (REGIAO_LABEL[v.regiao] ?? v.regiao) : "";
  const meta = [v.empresa_orgao, regiao].filter(Boolean).map(esc).join(" · ");
  const link = v.link_candidatura ?? "#";
  return `
  <tr><td style="padding:0 0 12px 0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E7E1D3;border-radius:12px;background:#FFFFFF">
      <tr><td style="padding:16px 18px">
        <div style="font-family:Georgia,serif;font-size:16px;font-weight:700;color:#1B2A21;line-height:1.35">${esc(v.titulo)}</div>
        ${meta ? `<div style="font-size:13px;color:#5B6B60;margin-top:4px">${meta}</div>` : ""}
        <a href="${esc(link)}" style="display:inline-block;margin-top:12px;background:#0D6B44;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:9px 16px;border-radius:8px">Ver a vaga →</a>
      </td></tr>
    </table>
  </td></tr>`;
}

function montarHtml(vagas: Vaga[], portalBase: string, optoutUrl: string): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F3EB;padding:24px 12px">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
    <tr><td style="padding:4px 4px 18px">
      <div style="font-family:Georgia,serif;font-size:22px;font-weight:800;color:#0D6B44;letter-spacing:-.01em">BIO<span style="color:#B97A1B">.</span></div>
      <div style="font-size:13px;color:#5B6B60;margin-top:2px">Oportunidades ambientais selecionadas para você</div>
    </td></tr>
    ${vagas.map(cardVaga).join("")}
    <tr><td style="padding:8px 4px 0">
      <a href="${esc(portalBase)}" style="color:#0D6B44;font-size:13px;font-weight:700;text-decoration:none">Ver todas as vagas no portal →</a>
    </td></tr>
    <tr><td style="padding:22px 4px 0;border-top:1px solid #E7E1D3;margin-top:16px">
      <div style="font-size:11px;color:#8A968C;line-height:1.6;margin-top:14px">
        O BIO é um observatório do Curso Técnico em Meio Ambiente (EaD) do IFCE Campus Fortaleza.
        As vagas são divulgadas com curadoria, mas as candidaturas ocorrem em sites externos —
        confira sempre a fonte oficial antes de enviar dados.<br><br>
        Você recebe este e-mail porque se cadastrou no portal BIO.
        <a href="${esc(optoutUrl)}" style="color:#8A968C;text-decoration:underline">Descadastrar-se</a> (imediato, sem login).
      </div>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;

  // admin gate (JWT do chamador)
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin, error: erroAdmin } = await asUser.rpc("bio_is_admin");
  if (erroAdmin || !isAdmin) return json({ ok: false, erro: "acesso restrito" }, 403);

  let body: { vaga_ids?: string[]; assunto?: string; teste_para?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const vagaIds = Array.isArray(body.vaga_ids) ? body.vaga_ids.slice(0, 40) : [];
  const assunto = (body.assunto ?? "").trim() || "BIO · novas oportunidades ambientais";
  if (vagaIds.length === 0) return json({ ok: false, erro: "selecione ao menos uma vaga" }, 400);

  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const cfg = async (k: string) =>
    (await svc.from("app_config").select("valor").eq("chave", k).maybeSingle()).data?.valor ?? null;
  const apiKey = await cfg("resend_api_key");
  const remetente = (await cfg("newsletter_remetente")) ?? "vagas@biooportunidades.org";
  const portalBase = (await cfg("portal_base_url")) ?? "";
  if (!apiKey) return json({ ok: false, erro: "resend_api_key ausente em app_config" }, 500);

  // vagas selecionadas (só aprovadas)
  const { data: vagas } = await svc
    .from("vagas")
    .select("id, titulo, empresa_orgao, regiao, tipo, link_candidatura")
    .in("id", vagaIds)
    .eq("status", "aprovada");
  if (!vagas || vagas.length === 0) return json({ ok: false, erro: "nenhuma vaga aprovada encontrada" }, 400);

  const enviarLote = async (emails: Record<string, unknown>[]) => {
    const resp = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(emails),
    });
    return resp.ok;
  };

  // MODO TESTE — envia um único e-mail e não registra nem toca na lista
  if (body.teste_para) {
    const optout = `${portalBase}/descadastrar?token=exemplo`;
    const ok = await enviarLote([{
      from: remetente, to: [body.teste_para],
      subject: `[TESTE] ${assunto}`,
      html: montarHtml(vagas as Vaga[], portalBase, optout),
      headers: { "List-Unsubscribe": `<${optout}>` },
    }]);
    return json({ ok, teste: true, para: body.teste_para, vagas: vagas.length });
  }

  // assinantes ativos
  const { data: assinantes } = await svc
    .from("assinantes_email").select("email, token_optout").eq("ativo", true);
  const lista = assinantes ?? [];
  if (lista.length === 0) return json({ ok: false, erro: "não há assinantes ativos" }, 400);

  // monta e envia em lotes de 100
  let enviados = 0, falhas = 0;
  for (let i = 0; i < lista.length; i += 100) {
    const chunk = lista.slice(i, i + 100);
    const emails = chunk.map((a) => {
      const optout = `${portalBase}/descadastrar?token=${a.token_optout}`;
      return {
        from: remetente,
        to: [a.email],
        subject: assunto,
        html: montarHtml(vagas as Vaga[], portalBase, optout),
        headers: { "List-Unsubscribe": `<${optout}>` },
      };
    });
    const ok = await enviarLote(emails);
    if (ok) enviados += chunk.length; else falhas += chunk.length;
  }

  const status = falhas === 0 ? "enviado" : (enviados === 0 ? "falha_total" : "falha_parcial");
  await svc.from("notificacoes_enviadas").insert({
    assunto,
    vagas_incluidas: vagas.map((v) => v.id),
    total_destinatarios: enviados,
    status_envio: status,
    mensagem_erro: falhas > 0 ? `${falhas} destinatário(s) falharam` : null,
  });

  // carimba as vagas como já enviadas (não serão re-sugeridas na próxima semana)
  if (enviados > 0) {
    await svc.from("vagas")
      .update({ data_envio_newsletter: new Date().toISOString() })
      .in("id", vagas.map((v) => v.id))
      .is("data_envio_newsletter", null);
  }

  return json({ ok: true, status, enviados, falhas, vagas: vagas.length });
});
