// BIO — Edge Function: coletar-rss (Canal A)
// Busca feeds RSS das fontes_coleta (canal_a_http, método rss, ativas/em_teste),
// filtra por palavras-chave, deduplica por hash_url e cria vagas pendentes na fila.
// A curadoria (aprovar/rejeitar) continua humana. Roda via pg_cron (arquivo 03) ou manual.
//
// Deploy: supabase functions deploy coletar-rss --no-verify-jwt
// (é um coletor interno; protegido por ser acionado só pelo cron/coordenação)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PALAVRAS_CHAVE = [
  "estagio", "estágio", "selecao", "seleção", "edital", "processo seletivo",
  "vaga", "vagas", "concurso", "chamamento", "bolsa", "emprego", "contratacao",
  "contratação", "recrutamento", "trabalhe conosco",
];

// Sinais de que o item é NOTÍCIA/processo encerrado, não uma oportunidade aberta.
// Conservador: só termos que quase nunca são uma vaga a que um estudante se candidata.
const EXCLUIR = [
  "recepcionad", "toma posse", "tomam posse", "gabarito", "resultado final",
  "resultado do", "resultado da", "homologa", "convocacao", "convocados",
  "convocada", "reuniao", "assembleia", "recepciona", "sao recepcion",
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function limparTexto(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    // decodifica entidades PRIMEIRO — o Google Alerts manda <b> como &lt;b&gt;;
    // se tirássemos as tags antes, o <b> revelado sobreviveria no título.
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    // agora remove quaisquer tags (inclusive as que estavam entidade-codificadas)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairTag(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? limparTexto(m[1]) : null;
}

// Link de uma <entry> Atom. O Google Alerts usa redirect — o URL real vem no
// parâmetro ?url=. Se não houver, usa o href direto.
function linkAtom(entry: string): string | null {
  const m = entry.match(/<link[^>]*href="([^"]+)"/i);
  if (!m) return null;
  const href = m[1].replace(/&amp;/g, "&");
  try {
    const real = new URL(href).searchParams.get("url");
    if (real) return real;
  } catch { /* ignore */ }
  return href;
}

// Extrai itens de feed RSS (<item>) OU Atom (<entry>) — o Google Alerts é Atom.
function extrairItens(
  xml: string,
): { titulo: string; link: string; descricao: string }[] {
  const out: { titulo: string; link: string; descricao: string }[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const it = m[1];
    const titulo = extrairTag(it, "title");
    const link = extrairTag(it, "link");
    if (titulo && link) {
      out.push({ titulo, link, descricao: extrairTag(it, "description") ?? "" });
    }
  }
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)) {
    const en = m[1];
    const titulo = extrairTag(en, "title");
    const link = linkAtom(en);
    if (titulo && link) {
      out.push({
        titulo,
        link,
        descricao: extrairTag(en, "content") ?? extrairTag(en, "summary") ?? "",
      });
    }
  }
  return out;
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

// Permite acionar do navegador (botão "Coletar agora" no painel).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

// TODA resposta precisa dos headers de CORS — senão o navegador bloqueia a
// resposta (mesmo 200) e o functions.invoke do painel acusa erro.
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Autenticação na própria função (não depende do gateway verify_jwt):
  // cron via x-bio-secret OU admin autenticado (botão "Coletar agora" do painel).
  let autorizado = false;
  const segredo = req.headers.get("x-bio-secret");
  if (segredo) {
    const { data: cfg } = await supabase
      .from("app_config").select("valor").eq("chave", "ingest_email_secret").maybeSingle();
    if (cfg?.valor && segredo === cfg.valor) autorizado = true;
  }
  if (!autorizado) {
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: isAdmin } = await asUser.rpc("bio_is_admin");
    if (isAdmin) autorizado = true;
  }
  if (!autorizado) {
    return json({ ok: false, erro: "não autorizado" }, 401);
  }

  const { data: fontes, error: erroFontes } = await supabase
    .from("fontes_coleta")
    .select("id, nome, url, score_confiabilidade")
    .eq("canal", "canal_a_http")
    .eq("metodo_coleta", "rss")
    .in("status", ["ativa", "em_teste"]);

  if (erroFontes) {
    return json({ ok: false, erro: erroFontes.message }, 500);
  }

  const resumo: Record<string, unknown>[] = [];

  for (const fonte of fontes ?? []) {
    const { data: exec } = await supabase
      .from("execucoes_coleta")
      .insert({ fonte_id: fonte.id })
      .select("id")
      .single();
    const execId = exec?.id ?? null;

    let encontrados = 0, novos = 0, duplicados = 0, erros = 0;
    let statusExec = "sucesso";
    let mensagemErro: string | null = null;

    try {
      if (!fonte.url) throw new Error("fonte sem url");
      const resp = await fetch(fonte.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; BIO-bot/1.0; +https://ifce.edu.br)",
        },
        redirect: "follow",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const xml = await resp.text();

      const itens = extrairItens(xml);
      encontrados = itens.length;

      for (const { titulo, link, descricao } of itens) {
        // filtro por palavras-chave (título + descrição)
        const alvo = norm(`${titulo} ${descricao}`);
        if (!PALAVRAS_CHAVE.some((p) => alvo.includes(norm(p)))) continue;
        // descarta notícia/processo encerrado (filtro negativo conservador)
        if (EXCLUIR.some((n) => alvo.includes(norm(n)))) continue;

        const hashUrl = await sha256(urlCanonica(link));
        const hashSem = await sha256(`${norm(titulo)}|${norm(fonte.nome)}`);

        // dedup: URL exata OU semântico (título+fonte) — pega o mesmo item
        // reaparecendo com URL diferente (ex.: redirect do Google Alerts).
        const { data: existe } = await supabase
          .from("vagas_brutas")
          .select("id")
          .or(`hash_url.eq.${hashUrl},hash_semantico.eq.${hashSem}`)
          .limit(1)
          .maybeSingle();
        if (existe) { duplicados++; continue; }

        const { data: bruta, error: erroBruta } = await supabase
          .from("vagas_brutas")
          .insert({
            fonte_id: fonte.id,
            execucao_id: execId,
            titulo_raw: titulo,
            descricao_raw: descricao.slice(0, 4000),
            url_original: link,
            hash_url: hashUrl,
            hash_semantico: hashSem,
            dedup_incompleta: false,
            status: "normalizada",
          })
          .select("id")
          .single();
        if (erroBruta) { erros++; continue; }

        // cria a vaga pendente (triggers calculam região/score/expiração)
        const { error: erroVaga } = await supabase.from("vagas").insert({
          vaga_bruta_id: bruta.id,
          fonte_id: fonte.id,
          titulo: titulo.slice(0, 300),
          empresa_orgao: fonte.nome,
          tipo: "processo_seletivo",
          nivel: "tecnico",
          curso_alvo: ["tecnico_meio_ambiente"],
          descricao: descricao.slice(0, 2000) || null,
          link_candidatura: link,
          origem: `Coleta automática · ${fonte.nome}`,
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

    // fecha execução
    await supabase
      .from("execucoes_coleta")
      .update({
        fim: new Date().toISOString(),
        itens_encontrados: encontrados,
        itens_novos: novos,
        itens_duplicados: duplicados,
        itens_erro: erros,
        status: statusExec,
        mensagem_erro: mensagemErro,
      })
      .eq("id", execId);

    // atualiza a fonte
    if (statusExec === "falha_total") {
      const { data: f } = await supabase
        .from("fontes_coleta")
        .select("falhas_consecutivas")
        .eq("id", fonte.id)
        .single();
      await supabase
        .from("fontes_coleta")
        .update({ falhas_consecutivas: (f?.falhas_consecutivas ?? 0) + 1 })
        .eq("id", fonte.id);
    } else {
      await supabase
        .from("fontes_coleta")
        .update({ ultima_execucao: new Date().toISOString(), falhas_consecutivas: 0 })
        .eq("id", fonte.id);
    }

    resumo.push({
      fonte: fonte.nome, encontrados, novos, duplicados, erros, status: statusExec,
      ...(mensagemErro ? { erro: mensagemErro } : {}),
    });
  }

  return json({ ok: true, fontes: resumo });
});
