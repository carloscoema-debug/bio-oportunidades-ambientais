// BIO — Edge Function: verificar-links (Fase 4 · F4-03)
// Roda diária (pg_cron). Confere o link de candidatura de cada vaga PUBLICADA.
//
// DUAS perguntas diferentes, e o checador precisa responder as duas:
//   1) "o link abre?"        → status HTTP (404/410/5xx = quebrado).
//   2) "ainda aceita gente?" → CONTEÚDO da página. Agregador (Indeed, LinkedIn,
//      Gupy) mantém a URL viva devolvendo HTTP 200 e escreve "essa vaga expirou"
//      no corpo. Só olhar o cabeçalho HTTP nunca enxerga isso — foi assim que uma
//      vaga encerrada ficou publicada no BIO com o link "ok".
// Por isso agora lemos o texto da página (cascata fetch → Jina → Firecrawl, em
// _shared/pagina.ts, a mesma usada na classificação) e procuramos frases de
// encerramento.
//
// Achou encerramento → status_link='inacessivel': sai da view pública na hora e
// cai na aba "LINK INATIVO" do painel, que já tem o botão "Republicar" caso a
// coordenação confira e veja que foi falso positivo. A decisão final continua humana.
//
// Bloqueio de bot (401/403/429/999) segue sendo INCONCLUSIVO — nunca conta como
// quebra. 3 falhas REAIS consecutivas (404/410/5xx/timeout) → 'inacessivel'.
//
// Auth: cron-only via x-bio-secret == app_config.ingest_email_secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buscarPagina, detectarEncerramento, type FcBudget } from "../_shared/pagina.ts";

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

type Vaga = {
  id: string;
  link_candidatura: string;
  link_falhas_consecutivas: number | null;
  status_link: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cfg = async (k: string) =>
    (await svc.from("app_config").select("valor").eq("chave", k).maybeSingle()).data?.valor ?? null;

  const segredo = await cfg("ingest_email_secret");
  if (!segredo || req.headers.get("x-bio-secret") !== segredo) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }

  const { data: vagasRaw } = await svc
    .from("vagas")
    .select("id, link_candidatura, link_falhas_consecutivas, status_link")
    .eq("status", "aprovada")
    .not("link_candidatura", "is", null);

  const vagas = (vagasRaw ?? []) as Vaga[];
  // Embaralha para o orçamento do Firecrawl não cair sempre nas MESMAS vagas:
  // o que não couber hoje é lido amanhã, e em poucos dias todas passam pela
  // leitura de conteúdo. (Sem isso, as últimas da lista nunca seriam lidas.)
  for (let i = vagas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [vagas[i], vagas[j]] = [vagas[j], vagas[i]];
  }

  const jinaKey = await cfg("jina_api_key"); // opcional; a cascata funciona sem
  const fc: FcBudget = { key: await cfg("firecrawl_api_key"), usados: 0, max: 10 };

  const agora = new Date().toISOString();
  let ativos = 0, redirecionados = 0, inacessiveis = 0, inconclusivos = 0;
  let encerradas = 0, semLeitura = 0;
  const encerradasDetalhe: { id: string; trecho: string }[] = [];

  // Concorrência limitada: 30+ vagas × (HTTP + leitura de página) em série
  // estouraria o tempo da edge function; 4 por vez mantém o total previsível.
  const LOTE = 4;
  for (let i = 0; i < vagas.length; i += LOTE) {
    await Promise.all(vagas.slice(i, i + LOTE).map(async (v) => {
      const { estado, msg } = await checar(v.link_candidatura);

      // Falha REAL de HTTP: 3 strikes até marcar inacessível (evita derrubar
      // vaga boa por instabilidade momentânea do site).
      if (estado === "falha") {
        const novas = (v.link_falhas_consecutivas ?? 0) + 1;
        const inacessivel = novas >= 3;
        if (inacessivel) inacessiveis++;
        await svc.from("vagas").update({
          link_falhas_consecutivas: novas,
          status_link: inacessivel ? "inacessivel" : (v.status_link ?? "nao_verificado"),
          mensagem_verificacao_link: msg,
          data_ultima_verificacao_link: agora,
        }).eq("id", v.id);
        return;
      }

      // O link responde (ou está bloqueado para bot). Em ambos os casos, a
      // pergunta que importa é se a vaga AINDA aceita candidatura — e isso só o
      // conteúdo responde. O Firecrawl é o único que vence o Cloudflare do Indeed.
      const texto = await buscarPagina(v.link_candidatura, jinaKey, fc);
      const trecho = texto ? detectarEncerramento(texto) : null;

      if (trecho) {
        // A própria página afirma que acabou. Sai do ar já — 1 detecção basta,
        // porque a frase é específica e a coordenação tem o "Republicar".
        encerradas++;
        encerradasDetalhe.push({ id: v.id, trecho });
        await svc.from("vagas").update({
          status_link: "inacessivel",
          link_falhas_consecutivas: 0,
          mensagem_verificacao_link: `Encerrada na fonte: "${trecho}"`.slice(0, 400),
          data_ultima_verificacao_link: agora,
        }).eq("id", v.id);
        return;
      }

      if (texto) {
        // Leu a página e ela NÃO diz que encerrou: melhor sinal de vaga viva que
        // existe. Vale mais que o HTTP — inclusive destrava as que ficavam
        // eternamente "nao_verificado" porque o HEAD levava 403.
        if (estado === "redirecionado") redirecionados++; else ativos++;
        await svc.from("vagas").update({
          status_link: estado === "redirecionado" ? "redirecionado" : "ativo",
          link_falhas_consecutivas: 0,
          mensagem_verificacao_link: null,
          data_ultima_verificacao_link: agora,
        }).eq("id", v.id);
        return;
      }

      // Não deu para ler o conteúdo (anti-bot venceu, ou o orçamento do
      // Firecrawl acabou). Cai no comportamento antigo: registra e NÃO derruba.
      if (estado === "ativo" || estado === "redirecionado") {
        if (estado === "ativo") ativos++; else redirecionados++;
        await svc.from("vagas").update({
          status_link: estado,
          link_falhas_consecutivas: 0,
          mensagem_verificacao_link: "link ok; conteúdo não pôde ser lido (anti-bot)",
          data_ultima_verificacao_link: agora,
        }).eq("id", v.id);
      } else {
        inconclusivos++;
        semLeitura++;
        await svc.from("vagas").update({
          mensagem_verificacao_link: `${msg}; conteúdo não pôde ser lido (anti-bot)`,
          data_ultima_verificacao_link: agora,
        }).eq("id", v.id);
      }
    }));
  }

  return json({
    ok: true,
    verificadas: vagas.length,
    ativos, redirecionados, inacessiveis, inconclusivos,
    encerradas, sem_leitura: semLeitura,
    firecrawl_usados: fc.usados,
    detalhe_encerradas: encerradasDetalhe,
  });
});
