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

// Canal B: NÃO filtramos mais o título por palavra-chave ambiental — muitas vagas
// aderentes têm título neutro (ex.: "Supervisor de Qualidade - SGI" p/ Gestão
// Ambiental). Capturamos todo link de vaga e a IA decide a aderência depois.

// Textos de âncora que NÃO são vaga (rodapé/gestão do alerta OU cabeçalho de digest).
const BOILERPLATE = [
  "unsubscribe", "cancelar", "descadastr", "gerenciar", "manage", "preferenc",
  "privacidade", "privacy", "termos", "terms", "ajuda", "help center", "central de ajuda",
  "baixar", "app store", "google play", "ver no navegador", "view in browser",
  "ver online", "editar alerta", "edit this", "editar este", "sign in", "entrar",
  "configuraç", "settings", "feedback", "denunciar", "report", "atualizar preferências",
  "todos os resultados", "see all", "ver todas", "ver mais vagas",
  // cabeçalhos/CTAs de digest (não são o título de uma vaga específica)
  "novas vagas", "resultados deste aviso", "enviar curriculo", "enviar currículo",
  "ver vaga", "ver detalhes", "candidatar-se agora", "vagas para voce", "vagas para você",
  "novos resultados", "clique neste link",
  // como agora capturamos todo link, cortamos os CTAs/rótulos que não são título de vaga
  "candidate-se", "candidatura", "salvar vaga", "salvar esta", "ver empresa",
  "sobre a empresa", "avaliaç", "seguir empresa", "patrocinad", "sponsored",
  "compartilhar", "mais vagas", "vagas semelhantes", "empregos em", "ver salário",
  "ver salario", "criar alerta", "editar pesquisa", "recomendadas para voce",
  // rótulos de "data de publicação" do Indeed que também são links (não são vaga)
  "nos ultimos", "ultimos 7 dias", "ultimas 24", "desde ontem", "publicado", "postado",
  // cabeçalho do alerta (ex.: LinkedIn "Seu alerta de vaga para X") — é o título do
  // alerta e leva a uma BUSCA, não a uma vaga específica
  "seu alerta de vaga", "alerta de vaga para", "your job alert", "job alert for",
  "ver todas as vagas do alerta", "vagas do seu alerta",
  // CTAs de chrome/marketing observados vazando de digests (não são o título de uma vaga)
  "modifique os criterios", "modificar criterios", "milhares de vagas", "se encaixam com",
  "conversar pelo whatsapp", "falar no whatsapp", "jogue agora", "saiba por que", "saiba mais",
  "aproveite", "assine ja", "assine agora", "seja premium", "conta premium", "ganhe ",
  "melhore seu perfil", "adicione um cargo", "complete seu perfil", "atualize seu curriculo",
  "responder", "conectar", "adicionar", "ver perfil", "ver todos os empregos",
];

// Título que é só filtro de data/tempo (Indeed): "desde ontem", "nos últimos 7 dias",
// "há 3 dias", "30+ dias"… — nunca é uma vaga.
const RE_DATA_RUIDO =
  /^(ha\s+\d|nos ultimos|ultim[oa]s|desde\s|ontem|hoje|\d+\+?\s*dias?|\d+\+?\s*h(oras?)?)\b/;

// URLs que NÃO são página de vaga (chrome de digest, apps, redes, marketing). Se o
// link casar aqui, descartamos a âncora — evita "Conversar pelo Whatsapp", "Jogue
// agora", "Modifique os critérios do alerta" etc. entrarem como vaga. É um filtro
// NEGATIVO (bloqueia o que claramente não é vaga) para não perder vaga de verdade.
const RE_NAO_VAGA_URL =
  /(wa\.me|api\.whatsapp|web\.whatsapp|\/whatsapp|t\.me\/|\/conta|\/account|\/settings|\/configurac|criterios|\/alertas?\b|\/notificac|\/ajuda|\/help|\/faq|\/suporte|\/support|\/jogo|\/game|\/games\/|play\.google|apps\.apple|itunes\.apple|\/premium|\/planos?\b|\/assinatura|\/upgrade|\/pricing|\/jobs\/search|\/jobs\/collections|\/jobs\/?(\?|$)|linkedin\.com\/(help|games|learning|feed|comm\/feed|mynetwork|notifications|posts|pulse|company)|facebook\.com|instagram\.com|twitter\.com|x\.com\/|youtube\.com)/i;

// E-mails que NÃO trazem vagas — pular por completo (registra com 0 vagas, não extrai):
// (a) CONFIRMAÇÃO de alerta recém-criado; (b) MARKETING/promoção (mesmo remetente que
// manda digests, ex.: InfoJobs "Ganhe 1 mês grátis"). Casado contra assunto + início do corpo.
const CONFIRMACAO = [
  "foi ativado com sucesso", "foi criado seu alerta", "criado seu alerta de",
  "seu alerta foi criado", "seu alerta foi ativado", "seu alerta de vaga foi",
  "job alert confirmation", "created your job alert", "your job alert is",
  "alert is set up",
];
const PROMO = [
  "ganhe 1 mes", "ganhe um mes", "mes gratis", "meses gratis", "conta premium",
  "seja premium", "assine", "presente para voce", "presente de boas", "boas-vindas",
  "boas vindas", "bem-vindo", "bem vindo", "desejamos boas", "quer receber",
  "ja escolheu o seu", "o universo esta dizendo", "nova competencia disponivel",
  "adicione um cargo", "melhore seu perfil", "complete seu perfil", "aproveite",
  "novidade", "promocao", "desconto", "oferta especial", "atualize seu curriculo",
  "confirme seu e-mail", "confirme seu email", "verifique seu e-mail",
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
    // remove tags; o `>?` também apaga uma tag "cortada" no fim do trecho (ex.: um
    // <a href="url gigante"> cujo `>` ficou além da janela) — senão o HTML vaza.
    .replace(/<[^>]*>?/g, " ")
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
    // filtro NEGATIVO por URL: descarta chrome/app/rede/marketing (não é página de vaga)
    if (RE_NAO_VAGA_URL.test(link)) continue;

    const titulo = limparTexto(m[2]);
    if (titulo.length < 8) continue;

    const tnorm = norm(titulo);
    if (BOILERPLATE.some((b) => tnorm.includes(b))) continue;
    if (RE_DATA_RUIDO.test(tnorm)) continue;
    // NÃO filtramos mais por palavra-chave no título: capturamos TODO link de vaga.
    // Muitas vagas aderentes têm título neutro (ex.: "Supervisor de Qualidade - SGI"
    // para Gestão Ambiental) — a aderência é decidida DEPOIS pela IA (que lê o
    // trecho do e-mail e, quando o site permite, a página). Assim nada se perde.

    const chave = urlCanonica(link);
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    // bloco após a âncora = contexto da vaga (empresa/local/salário/formação)
    const bloco = limparTexto(html.slice(m.index, m.index + 1800));
    let trecho = bloco.toLowerCase().startsWith(titulo.toLowerCase())
      ? bloco.slice(titulo.length).trim()
      : bloco;
    trecho = trecho.replace(/^[\s·|—–-]+/, "").slice(0, 500).trim();
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

  // Pula e-mails que NÃO trazem vagas: (a) CONFIRMAÇÃO de alerta (casada contra
  // assunto+início do corpo) e (b) MARKETING/promoção (casada só contra o ASSUNTO —
  // o corpo de um digest real pode conter "assine/aproveite" sem ser promo). Registra
  // para rastreio, mas não cria vaga — evita que promo de remetente reconhecido vire vaga.
  const cabecalho = norm(`${subject} ${limparTexto(corpo).slice(0, 400)}`);
  const assuntoNorm = norm(subject);
  const ehConfirmacao = CONFIRMACAO.some((c) => cabecalho.includes(norm(c)));
  const ehPromo = PROMO.some((p) => assuntoNorm.includes(norm(p)));
  if (ehConfirmacao || ehPromo) {
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
    return json({ ok: true, ignorado: true, motivo: ehPromo ? "marketing/promo" : "confirmacao_de_alerta", vagas: 0 });
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
        // NÃO gravamos o nome da fonte como empresa (o usuário não deve ver a fonte no
        // card). A empresa real é extraída depois pela IA (ou preenchida na curadoria);
        // a fonte fica só em `origem`/`fonte_id` (interno).
        empresa_orgao: null,
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
