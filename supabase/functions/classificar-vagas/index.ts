// BIO — Edge Function: classificar-vagas (Fase 1 IA · curadoria assistida)
// Lê vagas PENDENTES ainda não classificadas, envia ao LLM (Gemini primário,
// Groq fallback) e grava extração + recomendação. A curadoria continua humana:
// a IA só sinaliza (uf, modalidade, score, recomendacao, justificativa) e, quando
// acha um município do CE, preenche municipio (o trigger recalcula a região).
//
// Auth: x-bio-secret (cron) OU bio_is_admin (botão do painel). verify_jwt=false.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

// Códigos de curso do BIO aceitos em curso_alvo (a IA só pode preencher estes).
const CURSOS_BIO = new Set([
  "gestao_ambiental", "engenharia_sanitaria_ambiental", "saneamento_ambiental",
  "tecnico_meio_ambiente", "tecnico_saneamento",
]);

const PROMPT_REGRAS = `Você é o assistente de curadoria do BIO, portal do IFCE Campus Fortaleza. O BIO atende estudantes e egressos de VÁRIOS cursos do IFCE, de nível técnico E superior:
- SUPERIOR: Gestão Ambiental, Engenharia Sanitária e Ambiental (mesma coisa que Engenharia Ambiental e Sanitária), Saneamento Ambiental.
- TÉCNICO: Técnico em Meio Ambiente, Técnico em Saneamento.
IMPORTANTE: como há cursos SUPERIORES, vaga que exige nível superior na área (engenheiro ambiental/sanitário, gestor ambiental, coordenador de licenciamento, analista ambiental, biólogo, etc.) É ADERENTE. Nível superior NUNCA é, por si só, motivo para rebaixar ou descartar.

LEIA O CONTEXTO COMPLETO: use o título E a descrição E a página da vaga (campo "pagina", quando houver). O TÍTULO/ASSUNTO SOZINHO ENGANA (às vezes diz uma cidade no assunto do e-mail, mas a vaga é em outra). Sempre que houver "pagina", ela é a fonte da verdade.

REGRA DE REGIÃO (rígida):
- Extraia a localização REAL do texto (ex.: "Local de atuação: Três Lagoas MS"). Se o corpo/página indicar cidade/estado diferente do título, VALE O CORPO.
- Vaga presencial ou híbrida só serve se o local for no CEARÁ. Presencial/híbrida em outro estado => "descartar".
- Vaga 100% remota pode ser de qualquer estado.
- Se não der para saber o local, uf=null e modalidade="indefinido".

ADERÊNCIA — checar ÁREA e FORMAÇÃO exigida (não o nível):
- Cursos do BIO: Gestão Ambiental, Engenharia Sanitária e Ambiental, Saneamento Ambiental (superior); Técnico em Meio Ambiente, Técnico em Saneamento.
- APROVAR: vaga real (emprego/estágio/seleção pública) da área ambiental/saneamento/recursos hídricos/licenciamento ambiental/resíduos/energia renovável, cuja FORMAÇÃO exigida seja compatível com os cursos do BIO (ou aberta a "engenharias", "áreas ambientais", "meio ambiente", ou sem exigência de curso específico). Ex.: Engenheiro(a) Ambiental/Sanitário, Analista/Gestor Ambiental, Técnico em Meio Ambiente.
- DESCARTAR se a FORMAÇÃO exigida for de OUTRA área — ex.: Arquitetura e Urbanismo, Enfermagem, Direito, Administração, TI, Medicina — MESMO que o título diga "Licenciamento", "Ambiental" ou "SMS". A formação exigida manda mais que o título.
- DESCARTAR também: notícia/reportagem (não é vaga), chamamento público/licitação/pregão/parceria, concurso nacional sem relação ambiental, cargos operacionais não-ambientais (servente, pedreiro), vagas de outras áreas.
- ATENÇÃO a cargos de Qualidade/SGI/SMS/HSE/QSMS: costumam envolver meio ambiente (SGI = Sistema de Gestão Integrada: qualidade + meio ambiente + segurança). São POSSIVELMENTE aderentes — se local (CE) e formação baterem, aprove; na dúvida, "revisar". NÃO descarte só por dizer "qualidade".
- "revisar" só quando houver dúvida REAL (dados insuficientes, área/formação ambígua). Prefira "revisar" a "descartar" quando faltar informação e a vaga PUDER ser ambiental.

PRIORIDADE: estas REGRAS valem mais que os exemplos abaixo (o histórico pode ter decisões antigas ou baseadas só no título).

CURSOS DO BIO — devolva os CÓDIGOS dos cursos que a vaga atende (pela formação exigida/área), em "cursos":
- "gestao_ambiental" (superior — Gestão Ambiental)
- "engenharia_sanitaria_ambiental" (superior — Engenharia Sanitária e Ambiental / Eng. Ambiental e Sanitária)
- "saneamento_ambiental" (superior — Saneamento Ambiental)
- "tecnico_meio_ambiente" (técnico — Meio Ambiente)
- "tecnico_saneamento" (técnico — Saneamento)
Regra: inclua TODOS os cursos plausíveis (pode ser mais de um). Ex.: Engenheiro(a) Ambiental/Sanitário → ["engenharia_sanitaria_ambiental","gestao_ambiental"]; Analista/Gestor Ambiental → ["gestao_ambiental"] (+ técnico se aceitar técnico); Técnico em Meio Ambiente → ["tecnico_meio_ambiente"]; ETE/saneamento/tratamento de água/esgoto → +"saneamento_ambiental"/"tecnico_saneamento". Se a vaga NÃO for aderente (descartar), devolva cursos: [].

Para CADA vaga devolva um objeto com:
- titulo_limpo (string curta e legível)
- empresa (nome REAL do empregador extraído do texto/página; null se só aparecer o site/agregador de origem, ex.: "Indeed", "Catho")
- municipio (cidade da vaga extraída do texto, ou null)
- uf (sigla de 2 letras como "CE" ou "MS"; null se não souber)
- modalidade ("presencial" | "remoto" | "hibrido" | "indefinido")
- nivel ("tecnico" | "superior" | "ambos" | "operacional" | "indefinido")
- formacao_exigida (curso/área exigido no texto, ou null)
- cursos (array de códigos do BIO atendidos; [] se não aderente)
- faixa_salarial (ex.: "R$ 3.000" ou "R$ 2.000 a R$ 4.000"; null se não aparecer)
- score (0-100)
- recomendacao ("aprovar" | "revisar" | "descartar")
- justificativa (uma frase curta citando o que decidiu — local e/ou formação)

Responda SOMENTE com JSON: {"resultados": [ um objeto por vaga, na MESMA ordem ]}.`;

type Classif = {
  titulo_limpo?: string; empresa?: string | null; municipio?: string | null; uf?: string | null;
  modalidade?: string; nivel?: string; score?: number;
  recomendacao?: string; justificativa?: string;
  formacao_exigida?: string | null; faixa_salarial?: string | null;
  cursos?: string[] | null;
};

// Busca o texto da página da vaga (o corpo tem a verdade: local, formação, salário).
// Best-effort: muitos links são redirects/anti-bot (Indeed/LinkedIn/Catho) e podem
// falhar ou vir vazios — nesse caso a IA usa só o título + descrição do e-mail.
async function buscarPagina(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const ct = (resp.headers.get("content-type") ?? "").toLowerCase();
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const html = await resp.text();
    const texto = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    return texto.length > 80 ? texto.slice(0, 3500) : null;
  } catch {
    return null;
  }
}

async function chamarGemini(cfg: (k: string) => Promise<string | null>, prompt: string): Promise<Classif[]> {
  const key = await cfg("gemini_api_key");
  const model = (await cfg("gemini_model")) ?? "gemini-2.5-flash";
  if (!key) throw new Error("sem gemini_api_key");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    },
  );
  if (!resp.ok) throw new Error(`gemini ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(txt).resultados ?? [];
}

async function chamarGroq(cfg: (k: string) => Promise<string | null>, prompt: string): Promise<Classif[]> {
  const key = await cfg("groq_api_key");
  const model = (await cfg("groq_model")) ?? "llama-3.3-70b-versatile";
  if (!key) throw new Error("sem groq_api_key");
  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });
  if (!resp.ok) throw new Error(`groq ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return JSON.parse(d.choices[0].message.content).resultados ?? [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const cfg = async (k: string) =>
    (await svc.from("app_config").select("valor").eq("chave", k).maybeSingle()).data?.valor ?? null;

  // auth: segredo do cron OU admin autenticado
  let ok = false;
  const segredo = req.headers.get("x-bio-secret");
  if (segredo && segredo === (await cfg("ingest_email_secret"))) ok = true;
  if (!ok) {
    const asUser = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    if ((await asUser.rpc("bio_is_admin")).data) ok = true;
  }
  if (!ok) return json({ ok: false, erro: "não autorizado" }, 401);

  // municípios do CE (para casar o que a IA extrair e preencher municipio canônico)
  const { data: munis } = await svc.from("municipios_referencia")
    .select("municipio").eq("uf", "CE").eq("ativo", true);
  const mapaMuni = new Map<string, string>();
  for (const m of munis ?? []) mapaMuni.set(norm(m.municipio), m.municipio);

  // vagas pendentes ainda não classificadas
  const { data: vagas } = await svc.from("vagas")
    .select("id, titulo, empresa_orgao, descricao, modalidade, remuneracao_bolsa, link_candidatura")
    .eq("status", "pendente")
    .is("ai_classificado_em", null)
    .limit(30);

  if (!vagas || vagas.length === 0) return json({ ok: true, classificadas: 0, motivo: "nada_pendente" });

  // APRENDIZADO (few-shot): decisões recentes da coordenação viram exemplos no
  // prompt. Sem retreinar — a IA calibra ao gosto real de quem cura.
  const [aprovadas, rejeitadas] = await Promise.all([
    svc.from("vagas").select("titulo, empresa_orgao")
      .eq("status", "aprovada").order("data_captura", { ascending: false }).limit(18),
    svc.from("vagas").select("titulo, motivo_rejeicao_categoria, motivo_rejeicao_detalhe")
      .eq("status", "rejeitada").order("data_captura", { ascending: false }).limit(18),
  ]);
  const cortar = (s: string | null) => (s ?? "").slice(0, 90);
  const fewshot = (aprovadas.data?.length || rejeitadas.data?.length)
    ? `\n\nDECISÕES RECENTES DA COORDENAÇÃO (aprenda com o gosto real dela; case novas vagas por analogia):\n` +
      `APROVADAS (aceitas — bons exemplos):\n` +
      (aprovadas.data ?? []).map((a) => `- ${cortar(a.titulo)}${a.empresa_orgao ? ` (${cortar(a.empresa_orgao)})` : ""}`).join("\n") +
      `\nREJEITADAS (recusadas — NÃO recomende aprovar coisas parecidas):\n` +
      (rejeitadas.data ?? []).map((r) => `- ${cortar(r.titulo)} — motivo: ${r.motivo_rejeicao_categoria ?? "?"}${r.motivo_rejeicao_detalhe ? ` (${cortar(r.motivo_rejeicao_detalhe)})` : ""}`).join("\n")
    : "";

  const LOTE = 8;
  let classificadas = 0, erros = 0;
  const resumo: Record<string, number> = { aprovar: 0, revisar: 0, descartar: 0 };

  for (let i = 0; i < vagas.length; i += LOTE) {
    const lote = vagas.slice(i, i + LOTE);
    // busca o conteúdo real da página de cada vaga (em paralelo) — a verdade
    // (local, formação, salário) costuma estar só no corpo, não no título.
    const paginas = await Promise.all(
      lote.map((v) => (v.link_candidatura ? buscarPagina(v.link_candidatura) : Promise.resolve(null))),
    );
    const payload = lote.map((v, idx) => ({
      n: idx,
      titulo: v.titulo,
      empresa: v.empresa_orgao,
      descricao: (v.descricao ?? "").slice(0, 500),
      pagina: paginas[idx] ?? undefined,
    }));
    const prompt = `${PROMPT_REGRAS}${fewshot}\n\nVAGAS A CLASSIFICAR:\n${JSON.stringify(payload, null, 0)}`;

    let res: Classif[] = [];
    try {
      res = await chamarGemini(cfg, prompt);
    } catch (_e) {
      try { res = await chamarGroq(cfg, prompt); }
      catch (e2) { erros += lote.length; console.error("LLM falhou:", e2); continue; }
    }

    for (let j = 0; j < lote.length; j++) {
      const v = lote[j];
      const c = res[j];
      if (!c) { erros++; continue; }

      const rec = ["aprovar", "revisar", "descartar"].includes(c.recomendacao ?? "")
        ? c.recomendacao! : "revisar";
      resumo[rec] = (resumo[rec] ?? 0) + 1;

      // UF só se for realmente sigla de 2 letras (a IA às vezes devolve "Não informado")
      const ufOk = c.uf && /^[a-zA-Z]{2}$/.test(String(c.uf).trim())
        ? String(c.uf).trim().toUpperCase() : null;
      const patch: Record<string, unknown> = {
        uf: ufOk,
        ai_recomendacao: rec,
        ai_score: typeof c.score === "number" ? Math.round(c.score) : null,
        ai_justificativa: (c.justificativa ?? "").slice(0, 400) || null,
        ai_modalidade: c.modalidade ?? null,
        ai_classificado_em: new Date().toISOString(),
      };

      // se a IA achou um município do CE, preenche (trigger recalcula a região)
      if (c.municipio) {
        const canon = mapaMuni.get(norm(String(c.municipio)));
        if (canon) patch.municipio = canon;
      }
      // preenche modalidade (enum) só se estava vazia e a IA foi conclusiva
      if (!v.modalidade && ["presencial", "remoto", "hibrido"].includes(c.modalidade ?? "")) {
        patch.modalidade = c.modalidade;
      }
      // preenche a faixa salarial (quando a IA achou e a vaga ainda não tinha)
      if (!v.remuneracao_bolsa && c.faixa_salarial && /R\$|\d/.test(c.faixa_salarial)) {
        patch.remuneracao_bolsa = String(c.faixa_salarial).slice(0, 120);
      }
      // preenche a EMPRESA real quando a atual está vazia ou é o nome da fonte ("… Alerts").
      // Nunca grava um agregador (Indeed/Catho/…) como se fosse a empresa.
      const empAtual = (v.empresa_orgao ?? "").trim();
      const ehFonte = empAtual === "" || /\balerts?\b/i.test(empAtual);
      if (ehFonte && c.empresa && String(c.empresa).trim() &&
          !/\b(indeed|catho|linkedin|infojobs|gupy|vagas\.?com|trabalha\s*brasil)\b/i.test(String(c.empresa))) {
        patch.empresa_orgao = String(c.empresa).trim().slice(0, 200);
      }
      // preenche os CURSOS atendidos (só códigos válidos do BIO), quando a IA achou aderência
      if (Array.isArray(c.cursos)) {
        const cursos = [...new Set(c.cursos.map((x) => String(x).trim().toLowerCase()))]
          .filter((x) => CURSOS_BIO.has(x));
        if (cursos.length > 0) patch.curso_alvo = cursos;
      }

      const { error } = await svc.from("vagas").update(patch).eq("id", v.id);
      if (error) { erros++; console.error("update falhou:", error.message); }
      else classificadas++;
    }
  }

  return json({ ok: true, classificadas, erros, resumo });
});
