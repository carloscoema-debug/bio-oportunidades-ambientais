// BIO — Edge Function: digest-curadoria (Fase 2 · F2-11)
// Roda diariamente (pg_cron, 07h BRT). Avisa a coordenação só quando há vaga que
// realmente precisa de um humano: "prontas p/ aprovar" ou "precisam de atenção" —
// os mesmos dois baldes do painel (FilaVagas.tsx). Vaga que a IA já sugeriu
// descartar NÃO conta pra decidir se envia nem aparece na lista: ela se resolve
// em massa no painel, sem precisar de e-mail. Se não sobra nada acionável
// (mesmo com a fila cheia de "IA: descartar"), pula o dia — zero ruído.
//
// Auth: cron-only, via header x-bio-secret == app_config.ingest_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const json = (b: unknown, s = 200) => Response.json(b, { status: s });

type Vaga = {
  titulo: string;
  empresa_orgao: string | null;
  origem: string | null;
  score_aderencia: number | null;
  score_urgencia: number | null;
  data_captura: string | null;
  ai_recomendacao: string | null;
  flags_incompatibilidade: Record<string, boolean> | null;
  municipio: string | null;
  regiao: string | null;
};

// Baldes IDÊNTICOS aos do painel (src/components/admin/FilaVagas.tsx) — mudou lá,
// muda aqui também, senão o e-mail e a fila contam histórias diferentes.
const flagsAtivas = (v: Vaga): string[] =>
  Object.keys(v.flags_incompatibilidade ?? {}).filter((k) => v.flags_incompatibilidade![k]);
const municipioIndefinido = (v: Vaga) => !v.municipio || v.regiao === "indefinido";
const ehDescartar = (v: Vaga) => v.ai_recomendacao === "descartar";
const estaPronta = (v: Vaga) =>
  v.ai_recomendacao === "aprovar" && flagsAtivas(v).length === 0 && !municipioIndefinido(v);
const precisaAtencao = (v: Vaga) => !ehDescartar(v) && !estaPronta(v);

function listaHtml(vagas: Vaga[]): string {
  return vagas
    .map((v) => {
      const fonte = v.origem ? ` <span style="color:#8A968C">· ${esc(v.origem)}</span>` : "";
      const emp = v.empresa_orgao ? ` <span style="color:#55645B">— ${esc(v.empresa_orgao)}</span>` : "";
      return `<li style="margin:0 0 7px 0">${esc(v.titulo)}${emp}${fonte}</li>`;
    })
    .join("");
}

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

  // fila pendente inteira (precisa de tudo pra separar os baldes corretamente —
  // um limite baixo aqui poderia cortar justo as prontas/atenção mais antigas
  // se a fila tiver muita coisa que a IA já descartou na frente).
  const { data: vagasRaw } = await svc
    .from("vagas")
    .select("titulo, empresa_orgao, origem, score_aderencia, score_urgencia, data_captura, ai_recomendacao, flags_incompatibilidade, municipio, regiao")
    .eq("status", "pendente")
    .order("score_aderencia", { ascending: false })
    .order("score_urgencia", { ascending: false })
    .limit(150);

  const todas = (vagasRaw ?? []) as Vaga[];
  const prontas = todas.filter(estaPronta);
  const atencao = todas.filter(precisaAtencao);
  const descartar = todas.length - prontas.length - atencao.length;
  const acionaveis = [...prontas, ...atencao];

  if (acionaveis.length === 0) {
    // fila vazia OU fila só com o que a IA já sugeriu descartar — nos dois casos
    // não há nada que exija um humano agora.
    return json({ ok: true, pulou: true, motivo: todas.length === 0 ? "fila_vazia" : "so_descartar", pendentes: todas.length });
  }

  // quantas das ACIONÁVEIS chegaram nas últimas 24h (destaque do dia)
  const ontem = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const novas24h = acionaveis.filter((v) => v.data_captura && v.data_captura >= ontem).length;

  const LIMITE_LISTA = 20;
  const prontasMostrar = prontas.slice(0, LIMITE_LISTA);
  const atencaoMostrar = atencao.slice(0, Math.max(0, LIMITE_LISTA - prontasMostrar.length));
  const ocultas = acionaveis.length - prontasMostrar.length - atencaoMostrar.length;

  const blocoProntas = prontasMostrar.length
    ? `<p style="font-size:13px;font-weight:700;color:#0D6B44;margin:14px 0 4px">✓ Prontas para aprovar (${prontas.length})</p>
       <ul style="font-size:14px;padding-left:18px;margin:0 0 6px">${listaHtml(prontasMostrar)}</ul>`
    : "";
  const blocoAtencao = atencaoMostrar.length
    ? `<p style="font-size:13px;font-weight:700;color:#B97A1B;margin:14px 0 4px">⚠ Precisam de atenção (${atencao.length})</p>
       <ul style="font-size:14px;padding-left:18px;margin:0 0 6px">${listaHtml(atencaoMostrar)}</ul>`
    : "";
  const extra = ocultas > 0
    ? `<p style="font-size:13px;color:#8A968C;margin:2px 0 14px">…e mais ${ocultas} na fila.</p>`
    : "";
  // Menciona o que a IA já descartou sem listar (resolve-se em massa no painel,
  // não precisa de olho por olho aqui) — só pra a coordenação saber que a fila
  // "de verdade" é maior do que os itens acima, sem inflar o e-mail com eles.
  const notaDescartar = descartar > 0
    ? `<p style="font-size:12px;color:#8A968C;margin:0 0 14px">+ ${descartar} vaga(s) que a IA sugeriu descartar — resolva em massa na aba "IA sugere descartar".</p>`
    : "";

  const resumo = [
    prontas.length > 0 ? `<strong>${prontas.length}</strong> pronta(s) para aprovar` : null,
    atencao.length > 0 ? `<strong>${atencao.length}</strong> precisando de atenção` : null,
  ].filter(Boolean).join(" e ");

  const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;color:#1B2A21">
    <p style="font-size:20px;font-weight:800;color:#0D6B44;margin:0 0 4px">BIO<span style="color:#B97A1B">.</span></p>
    <p style="font-size:16px;font-weight:700;margin:0 0 4px">Fila de curadoria — resumo do dia</p>
    <p style="font-size:14px;color:#5B6B60;margin:0 0 4px">
      Há ${resumo}${novas24h > 0 ? `, sendo <strong>${novas24h}</strong> nova(s) nas últimas 24h` : ""}.
      Revise, aprove as boas e rejeite o que não se aplica.
    </p>
    ${notaDescartar}
    ${blocoProntas}
    ${blocoAtencao}
    ${extra}
    <a href="${esc(portalBase)}/admin?aba=fila" style="display:inline-block;background:#0D6B44;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:9px;margin-top:8px">Abrir a fila de curadoria →</a>
    <p style="font-size:12px;color:#8A968C;margin-top:20px">Você recebe este resumo só quando há vaga pronta pra aprovar ou que precisa de atenção. Aviso automático do BIO.</p>
  </div>`;

  const assunto = prontas.length > 0 && atencao.length > 0
    ? `BIO · ${prontas.length} pronta(s) · ${atencao.length} p/ revisar`
    : prontas.length > 0
      ? `BIO · ${prontas.length} vaga(s) pronta(s) para aprovar`
      : `BIO · ${atencao.length} vaga(s) precisam de atenção`;

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: remetente,
      to: [para],
      subject: assunto,
      html,
    }),
  });

  return json({
    ok: resp.ok,
    enviou: resp.ok,
    pendentes: todas.length,
    prontas: prontas.length,
    atencao: atencao.length,
    descartar,
    novas24h,
    para,
  });
});
