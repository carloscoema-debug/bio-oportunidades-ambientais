// BIO — Edge Function: ingest-email (Canal B)
// Recebe um e-mail de alerta de vaga (Indeed/LinkedIn/Google Alerts) encaminhado por
// um webhook (ex.: Make Mailhook a partir da caixa Gmail dedicada), extrai os links de
// vaga, deduplica por hash_url e cria vagas pendentes na fila. A curadoria segue humana.
//
// Autenticação: NÃO usa JWT (chamado por webhook). Exige o header `x-bio-secret` igual
// ao segredo guardado em app_config.ingest_email_secret (lido via service_role).
//
// Corpo esperado (JSON, flexível): { from|sender, subject, html|body_html, text|body_plain }
//
// Deploy: supabase functions deploy ingest-email --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Canal B: o título precisa ter SINAL AMBIENTAL. O alerta de e-mail já filtra "vaga";
// aqui garantimos aderência ao curso e cortamos ruído (enfermagem, TI, manutenção…).
const AMBIENTAL = [
  "ambient", "meio ambiente", "meio-ambiente", "sustentab", "ssma", "saneamento",
  "residuo", "hidric", "florest", "ecolog", "climat", "energia renovavel",
  "geoproces", "licenciamento", "reciclag", "efluente", "recursos hidricos",
  "gestao ambiental", "biolog",
];

// Textos de âncora que NÃO são vaga (rodapé/gestão do alerta).
const BOILERPLATE = [
  "unsubscribe", "cancelar", "descadastr", "gerenciar", "manage", "preferenc",
  "privacidade", "privacy", "termos", "terms", "ajuda", "help center", "central de ajuda",
  "baixar", "app store", "google play", "ver no navegador", "view in browser",
  "ver online", "editar alerta", "edit this", "editar este", "sign in", "entrar",
  "configuraç", "settings", "feedback", "denunciar", "report", "atualizar preferências",
  "todos os resultados", "see all", "ver todas", "ver mais vagas",
];

// E-mails de CONFIRMAÇÃO de alerta (Indeed/LinkedIn enviam um ao criar o alerta):
// trazem "seu alerta foi ativado/criado" + no máximo 1 vaga-exemplo mal casada e sem
// detalhes. Não devem virar vaga — as vagas reais vêm nos resumos recorrentes.
const CONFIRMACAO = [
  "foi ativado com sucesso", "foi criado seu alerta", "criado seu alerta de",
  "seu alerta foi criado", "seu alerta foi ativado", "seu alerta de vaga foi",
  "job alert confirmation", "created your job alert", "your job alert is",
  "alert is set up",
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function limparTexto(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    // decodifica entidades PRIMEIRO (tags podem vir como &lt;b&gt;), depois remove tags.
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Resolve redirect (Google Alerts/LinkedIn usam ?url= ou ?u=).
function urlReal(href: string): string {
  const h = href.replace(/&amp;/g, "&").trim();
  try {
    const u = new URL(h);
    const real = u.searchParams.get("url") ?? u.searchParams.get("u");
    if (real && /^https?:\/\//i.test(real)) return real;
  } catch { /* ignore */ }
  return h;
}

// Parâmetros de rastreio (não identificam a vaga) — removidos para deduplicar bem.
const TRACKING = /^(utm_|mc_|_hs|fbclid$|gclid$|ref$|refid$|source$|src$|campaign$|trk$|trackingid$|from$|spm$|igshid$)/i;
function urlCanonica(url: string): string {
  try {
    const u = new URL(url.trim());
    const host = u.host.replace(/^www\./, "").toLowerCase();
    const path = u.pathname.replace(/\/$/, "").toLowerCase();
    // preserva o query que IDENTIFICA a vaga (jk, currentJobId, id…), tira só rastreio.
    const params = [...u.searchParams.entries()]
      .filter(([k]) => !TRACKING.test(k))
      .sort(([a], [b]) => a.localeCompare(b));
    const qs = params.length ? "?" + params.map(([k, v]) => `${k}=${v}`).join("&") : "";
    return `https://${host}${path}${qs}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Captura de detalhes visíveis no próprio e-mail (quando existirem).
// Salário: "R$ 2.500", "R$ 1.500,00", "R$ 10 mil"…
const RE_SALARIO = /R\$\s?\d[\d.\s]{0,12}(?:,\d{2})?(?:\s?mil)?/i;

// Extrai candidatos { titulo, link, trecho, remuneracao } do HTML do e-mail.
// O "trecho" é o bloco de texto logo após o link — nos resumos do Indeed/LinkedIn
// costuma trazer empresa, local e, às vezes, salário; ajuda a leitura na fila.
function extrairVagas(
  html: string,
): { titulo: string; link: string; trecho: string | null; remuneracao: string | null }[] {
  const out: { titulo: string; link: string; trecho: string | null; remuneracao: string | null }[] = [];
  const vistos = new Set<string>();
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const hrefRaw = m[1];
    if (/^(mailto:|tel:|#)/i.test(hrefRaw)) continue;
    const link = urlReal(hrefRaw);
    if (!/^https?:\/\//i.test(link)) continue;

    const titulo = limparTexto(m[2]);
    if (titulo.length < 8) continue;

    const tnorm = norm(titulo);
    if (BOILERPLATE.some((b) => tnorm.includes(b))) continue;
    // aderência ao curso: exige sinal ambiental no título (corta enfermagem/TI/etc.)
    if (!AMBIENTAL.some((a) => tnorm.includes(norm(a)))) continue;

    const chave = urlCanonica(link);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    // bloco após a âncora = contexto da vaga (empresa/local/salário)
    const bloco = limparTexto(html.slice(m.index, m.index + 1400));
    let trecho = bloco.toLowerCase().startsWith(titulo.toLowerCase())
      ? bloco.slice(titulo.length).trim()
      : bloco;
    trecho = trecho.replace(/^[\s·|—–-]+/, "").slice(0, 240).trim();
    const sal = bloco.match(RE_SALARIO);

    out.push({
      titulo: titulo.slice(0, 300),
      link,
      trecho: trecho.length >= 12 ? trecho : null,
      remuneracao: sal ? sal[0].replace(/\s+/g, " ").trim() : null,
    });
  }
  return out;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bio-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "use POST" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // auth por segredo compartilhado
  const { data: cfg } = await supabase
    .from("app_config").select("valor").eq("chave", "ingest_email_secret").maybeSingle();
  const esperado = cfg?.valor ?? null;
  const recebido = req.headers.get("x-bio-secret");
  if (!esperado || recebido !== esperado) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }

  // Aceita JSON ou form-urlencoded/multipart (o Make escapa cada campo com segurança).
  let payload: Record<string, unknown> = {};
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const fd = await req.formData();
      payload = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return json({ ok: false, erro: "corpo ilegível (use JSON ou form-urlencoded)" }, 400);
  }

  const from = String(payload.from ?? payload.sender ?? payload.From ?? "");
  const subject = String(payload.subject ?? payload.Subject ?? "");
  const html = String(payload.html ?? payload.body_html ?? payload.htmlBody ?? "");
  const text = String(payload.text ?? payload.body_plain ?? payload.textBody ?? "");
  const corpo = html || text;
  if (!corpo) return json({ ok: false, erro: "e-mail sem corpo (html/text)" }, 400);

  // reprocessamento (via reprocessar-email) não regrava em emails_recebidos —
  // a própria reprocessar-email atualiza a linha original.
  const reprocessando = req.headers.get("x-bio-reprocess") === "1";

  // Captura o e-mail de confirmação de encaminhamento do Gmail (setup do Canal B).
  // Grava código + link em app_config para a coordenação confirmar o encaminhamento.
  if (from.toLowerCase().includes("forwarding-noreply@google.com") ||
      /forwarding confirmation|confirma[çc][ãa]o de encaminhamento/i.test(subject)) {
    const blob = `${subject}\n${text}\n${html}`;
    const code = blob.match(/\b\d{8,12}\b/)?.[0] ?? null;
    const urls = [...new Set(
      [...blob.matchAll(/https?:\/\/[^\s"'<>]*google\.com[^\s"'<>]*/gi)]
        .map((m) => m[0].replace(/&amp;/g, "&")),
    )].slice(0, 6);
    await supabase.from("app_config").upsert({
      chave: "gmail_forward_confirm",
      valor: JSON.stringify({ code, urls, subject, capturado_em: new Date().toISOString() }),
      atualizado_em: new Date().toISOString(),
    });
    return json({ ok: true, forwarding_confirmation_captured: true, code });
  }

  // casa remetente -> fonte
  const { data: fontes } = await supabase
    .from("fontes_coleta")
    .select("id, nome, score_confiabilidade, padrao_remetente")
    .eq("canal", "canal_b_email")
    .not("padrao_remetente", "is", null);

  const fromNorm = from.toLowerCase();
  const fonte = (fontes ?? []).find(
    (f) => f.padrao_remetente && fromNorm.includes(String(f.padrao_remetente).toLowerCase()),
  );
  if (!fonte) {
    // registra para não perder o e-mail (fila de "não reconhecidos" no painel)
    if (!reprocessando) {
      await supabase.from("emails_recebidos").insert({
        remetente: from || null,
        assunto: subject || null,
        corpo_raw: corpo.slice(0, 200000),
        status_parsing: "nao_reconhecido",
        vagas_geradas: 0,
      });
    }
    return json({ ok: true, ignorado: true, motivo: `remetente não reconhecido: ${from || "(vazio)"}` });
  }

  // Pula e-mails de CONFIRMAÇÃO de alerta (não são vagas reais). Registra para
  // rastreio, mas não cria vaga — evita ruído mal casado e sem detalhes.
  const cabecalho = norm(`${subject} ${limparTexto(corpo).slice(0, 400)}`);
  if (CONFIRMACAO.some((c) => cabecalho.includes(norm(c)))) {
    if (!reprocessando) {
      await supabase.from("emails_recebidos").insert({
        remetente: from || null,
        assunto: subject || null,
        corpo_raw: corpo.slice(0, 200000),
        fonte_id: fonte.id,
        status_parsing: "processado",
        vagas_geradas: 0,
      });
    }
    return json({ ok: true, confirmacao_de_alerta: true, vagas: 0 });
  }

  // registra o e-mail (reconhecido) ANTES das vagas, para vinculá-las (email_recebido_id)
  let emailId: string | null = null;
  if (!reprocessando) {
    const { data: emRow } = await supabase.from("emails_recebidos").insert({
      remetente: from || null,
      assunto: subject || null,
      corpo_raw: corpo.slice(0, 200000),
      fonte_id: fonte.id,
      status_parsing: "processado",
      vagas_geradas: 0,
    }).select("id").single();
    emailId = emRow?.id ?? null;
  }

  // registra execução
  const { data: exec } = await supabase
    .from("execucoes_coleta").insert({ fonte_id: fonte.id }).select("id").single();
  const execId = exec?.id ?? null;

  let encontrados = 0, novos = 0, duplicados = 0, erros = 0;
  let statusExec = "sucesso";
  let mensagemErro: string | null = null;

  try {
    const itens = extrairVagas(corpo);
    encontrados = itens.length;

    for (const { titulo, link, trecho, remuneracao } of itens) {
      const hashUrl = await sha256(urlCanonica(link));
      const hashSem = await sha256(`${norm(titulo)}|${norm(fonte.nome)}`);

      // dedup: URL exata OU semântico (título+fonte). O Indeed troca o link de
      // alerta a cada envio, então só o semântico pega a mesma vaga reenviada.
      const { data: existe } = await supabase
        .from("vagas_brutas").select("id")
        .or(`hash_url.eq.${hashUrl},hash_semantico.eq.${hashSem}`)
        .limit(1).maybeSingle();
      if (existe) { duplicados++; continue; }

      // descrição para leitura na fila: o trecho do e-mail (empresa/local/salário)
      // quando houver; senão, o assunto como contexto mínimo.
      const descricao = trecho
        ? `${trecho}${subject ? `\n\nAlerta: ${subject}` : ""}`.slice(0, 2000)
        : subject ? `Via alerta: ${subject}`.slice(0, 2000) : null;

      const { data: bruta, error: erroBruta } = await supabase
        .from("vagas_brutas")
        .insert({
          fonte_id: fonte.id,
          execucao_id: execId,
          email_recebido_id: emailId,
          titulo_raw: titulo,
          descricao_raw: (trecho ?? subject).slice(0, 4000),
          url_original: link,
          hash_url: hashUrl,
          hash_semantico: hashSem,
          dedup_incompleta: false,
          status: "normalizada",
        })
        .select("id").single();
      if (erroBruta) { erros++; continue; }

      const { error: erroVaga } = await supabase.from("vagas").insert({
        vaga_bruta_id: bruta.id,
        fonte_id: fonte.id,
        titulo: titulo.slice(0, 300),
        empresa_orgao: fonte.nome,
        tipo: "processo_seletivo",
        nivel: "tecnico",
        curso_alvo: ["tecnico_meio_ambiente"],
        descricao,
        remuneracao_bolsa: remuneracao,
        link_candidatura: link,
        origem: `Canal B · ${fonte.nome}`,
        score_confiabilidade_fonte: fonte.score_confiabilidade,
        sem_prazo_definido: true,
        status: "pendente",
      });
      if (erroVaga) { erros++; continue; }
      novos++;
    }

    statusExec = erros > 0 ? "falha_parcial" : "sucesso";
  } catch (e) {
    statusExec = "falha_total";
    mensagemErro = String(e instanceof Error ? e.message : e);
  }

  await supabase.from("execucoes_coleta").update({
    fim: new Date().toISOString(),
    itens_encontrados: encontrados,
    itens_novos: novos,
    itens_duplicados: duplicados,
    itens_erro: erros,
    status: statusExec,
    mensagem_erro: mensagemErro,
  }).eq("id", execId);

  if (statusExec === "falha_total") {
    const { data: f } = await supabase
      .from("fontes_coleta").select("falhas_consecutivas").eq("id", fonte.id).single();
    await supabase.from("fontes_coleta")
      .update({ falhas_consecutivas: (f?.falhas_consecutivas ?? 0) + 1 }).eq("id", fonte.id);
  } else {
    await supabase.from("fontes_coleta")
      .update({ ultima_execucao: new Date().toISOString(), falhas_consecutivas: 0 })
      .eq("id", fonte.id);
  }

  // fecha o registro do e-mail com o resultado final (vagas geradas + status)
  if (!reprocessando && emailId) {
    await supabase.from("emails_recebidos")
      .update({
        status_parsing: statusExec === "falha_total" ? "erro" : "processado",
        vagas_geradas: novos,
      })
      .eq("id", emailId);
  }

  return json({
    ok: true, fonte: fonte.nome, encontrados, novos, duplicados, erros, status: statusExec,
    ...(mensagemErro ? { erro: mensagemErro } : {}),
  });
});
