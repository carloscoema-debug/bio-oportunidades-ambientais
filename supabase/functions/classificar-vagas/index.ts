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

// Interstício de anti-bot/CAPTCHA (Cloudflare etc.). Se a "página" for isso, NÃO
// serve como conteúdo da vaga — devolvemos null p/ a IA não ler o bloqueio como vaga.
// O corte por tamanho (<1500) evita falso-positivo em página real que cite "cloudflare".
const RE_BLOQUEIO =
  /(additional verification required|verify you are human|are you a robot|just a moment|enable javascript and cookies|checking your browser|attention required|ray id|captcha|acesso negado|access denied)/i;
const ehBloqueio = (t: string) => t.length < 1500 && RE_BLOQUEIO.test(t);

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
- CARGOS COMERCIAIS/VENDAS EM EMPRESA DO SETOR AMBIENTAL (ex.: "Consultor(a) Comercial Ambiental", "Vendas Técnicas", "Executivo de Contas" em consultoria/gestão de resíduos/saneamento/licenciamento): SÃO ADERENTES a Gestão Ambiental/Engenharia Ambiental quando o que se vende é um SERVIÇO OU SOLUÇÃO AMBIENTAL (estudos/licenciamento, gestão de resíduos, tratamento de efluentes, consultoria ambiental) — nesses casos a formação ambiental é o diferencial técnico do vendedor, não um detalhe irrelevante. NÃO aprove vendas genéricas (cursos, seguros, imóveis, planos) só porque a razão social da empresa contém "ambiental" — o que importa é O QUE está sendo vendido.

PÁGINA DE BUSCA/LISTAGEM (não é vaga individual): se o campo "pagina" for claramente uma página de RESULTADOS DE BUSCA (lista vários cargos/empresas diferentes, tem texto como "vagas encontradas", "resultados", paginação, ou não descreve UM cargo específico), a vaga NÃO tem uma página real — trate como se "pagina" não existisse e julgue só por título/descrição; se título/descrição também forem genéricos (ex.: mencionam "empresas destacadas", "N vagas para você", sem citar UM cargo/empresa específicos), recomende "descartar" com justificativa "Página de busca — não é vaga específica."

DISPONIBILIDADE (checar SEMPRE que houver "pagina" ou descrição): se o texto indicar que a vaga NÃO aceita mais candidaturas / está encerrada / expirada — ex.: "não aceita mais candidaturas", "no longer accepting applications", "vaga encerrada", "candidaturas encerradas", "processo encerrado", "vaga expirada", "inscrições encerradas", "esta vaga não está mais disponível" — recomende "descartar" com justificativa começando por "Encerrada: " (ex.: "Encerrada: não aceita mais candidaturas"), MESMO que seja aderente ao curso. Uma vaga fechada não serve ao estudante. (Se não houver "pagina" nem sinal de encerramento no texto, não presuma que está aberta nem fechada — siga a aderência normal.)

TIPO — "processo_seletivo" É SÓ PARA SETOR PÚBLICO (rígido; causa comum de erro):
- "processo_seletivo" (aparece no card como "Seleção pública") só quando o EMPREGADOR é um órgão/entidade PÚBLICA — concurso público, seleção simplificada de prefeitura/secretaria/autarquia/estatal, edital de órgão público (SEMACE, IBAMA, IFCE, prefeituras, câmaras etc.).
- MUITAS empresas PRIVADAS usam a expressão "processo seletivo" no texto só como sinônimo comum de "processo de contratação" — isso NÃO torna a vaga pública. Se o empregador é empresa privada (Ltda, S.A., ME, indústria, consultoria, comércio, agro…), o tipo é "emprego" (ou "estagio" se for estágio), MESMO que a página diga literalmente "processo seletivo" ou "seleção".
- Exemplos: "Processo Seletivo — Vale S.A." → emprego (empresa privada, apesar do nome). "Seleção Pública Simplificada — Prefeitura de Sobral" → processo_seletivo (órgão público). "Consultor Ambiental — CMGB Consultoria" → emprego (privada), mesmo sem a palavra "seleção" no texto.
- Na dúvida sobre o empregador ser público ou privado, use "emprego" — é o tipo mais comum e o erro sai mais barato de corrigir depois.

PRIORIDADE: estas REGRAS valem mais que os exemplos abaixo (o histórico pode ter decisões antigas ou baseadas só no título).

CURSOS DO BIO — devolva os CÓDIGOS dos cursos que a vaga atende (pela formação exigida/área), em "cursos":
- "gestao_ambiental" (superior — Gestão Ambiental)
- "engenharia_sanitaria_ambiental" (superior — Engenharia Sanitária e Ambiental / Eng. Ambiental e Sanitária)
- "saneamento_ambiental" (superior — Saneamento Ambiental)
- "tecnico_meio_ambiente" (técnico — Meio Ambiente)
- "tecnico_saneamento" (técnico — Saneamento)
Regra: inclua TODOS os cursos plausíveis (pode ser mais de um). Ex.: Engenheiro(a) Ambiental/Sanitário → ["engenharia_sanitaria_ambiental","gestao_ambiental"]; Analista/Gestor Ambiental → ["gestao_ambiental"] (+ técnico se aceitar técnico); Técnico em Meio Ambiente → ["tecnico_meio_ambiente"]; ETE/saneamento/tratamento de água/esgoto → +"saneamento_ambiental"/"tecnico_saneamento". Se a vaga NÃO for aderente (descartar), devolva cursos: [].

ÁREA TEMÁTICA (classifique a vaga na ÁREA ambiental mais específica que couber, para a leitura de demanda de mercado), em "area_tematica" — use EXATAMENTE um destes rótulos:
"Conservação e Biodiversidade", "Consultoria Ambiental", "Educação Ambiental", "Fiscalização e Monitoramento", "Geoprocessamento", "Gestão e Auditoria Ambiental", "Laboratório e Análises", "Licenciamento Ambiental", "Meio Ambiente Industrial", "Órgãos Públicos Ambientais", "Qualidade da Água", "Recursos Hídricos", "Resíduos Sólidos", "Saneamento", "Outras Áreas".
Dicas: SGI/HSE/QSMS/indústria → "Meio Ambiente Industrial"; ETE/água/esgoto → "Saneamento" (ou "Qualidade da Água"/"Recursos Hídricos" se for foco); consultoria/estudos ambientais → "Consultoria Ambiental"; órgão público (SEMACE, prefeitura, IBAMA) → "Órgãos Públicos Ambientais" (ou "Fiscalização e Monitoramento" se for fiscal); coleta/reciclagem/aterro → "Resíduos Sólidos"; licença/EIA/RIMA → "Licenciamento Ambiental"; laboratório/análise → "Laboratório e Análises". Se não der p/ definir, "Outras Áreas" ou null.

Para CADA vaga devolva um objeto com:
- titulo_limpo (string curta e legível)
- empresa (nome REAL do empregador extraído do texto/página; null se só aparecer o site/agregador de origem, ex.: "Indeed", "Catho")
- municipio (cidade da vaga extraída do texto, ou null)
- uf (sigla de 2 letras como "CE" ou "MS"; null se não souber)
- modalidade ("presencial" | "remoto" | "hibrido" | "indefinido")
- nivel ("tecnico" | "superior" | "ambos" | "operacional" | "indefinido")
- formacao_exigida (curso/área exigido no texto, ou null)
- cursos (array de códigos do BIO atendidos; [] se não aderente)
- area_tematica (um dos rótulos de área listados acima, ou null)
- tipo ("estagio" | "emprego" | "bolsa" | "processo_seletivo"; use "estagio" se for estágio, "bolsa" se for bolsa de pesquisa/extensão, "processo_seletivo" p/ concurso/seleção pública, senão "emprego"; null se não der p/ saber)
- faixa_salarial (remuneração OU valor de BOLSA OU benefícios, o que aparecer — ex.: "R$ 3.000", "R$ 2.000 a R$ 4.000", "Bolsa R$ 800 + auxílio-transporte", "R$ 1.500 + VR/VT"; null se não aparecer)
- carga_horaria (jornada de trabalho, ex.: "40h/semana", "20h/semana", "6h/dia", "Tempo integral", "Meio período"; null se não aparecer)
- score (0-100)
- recomendacao ("aprovar" | "revisar" | "descartar")
- justificativa (uma frase curta citando o que decidiu — local e/ou formação)

Responda SOMENTE com JSON: {"resultados": [ um objeto por vaga, na MESMA ordem ]}.`;

type Classif = {
  titulo_limpo?: string; empresa?: string | null; municipio?: string | null; uf?: string | null;
  modalidade?: string; nivel?: string; score?: number;
  recomendacao?: string; justificativa?: string;
  formacao_exigida?: string | null; faixa_salarial?: string | null;
  cursos?: string[] | null; tipo?: string; carga_horaria?: string | null;
  area_tematica?: string | null;
};

// Busca o texto da página da vaga (o corpo tem a verdade: local, formação, salário).
// Estratégia: (1) fetch DIRETO, rápido, cobre a maioria dos sites; (2) se vier
// bloqueado/vazio (Indeed/LinkedIn/Catho respondem 403 Cloudflare), fallback pelo
// proxy de leitura r.jina.ai, que renderiza a página e devolve texto já limpo.
// Best-effort: se ainda assim falhar, a IA usa só o título + descrição do e-mail.
async function fetchDireto(url: string): Promise<string | null> {
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
    if (ehBloqueio(texto)) return null;
    return texto.length > 80 ? texto.slice(0, 3500) : null;
  } catch {
    return null;
  }
}

// Leitura via r.jina.ai — proxy gratuito que acessa a URL, renderiza e devolve o
// texto principal (contorna anti-bot simples do Indeed/LinkedIn/Catho). Se houver
// app_config.jina_api_key, envia como Bearer (limites de taxa maiores).
async function fetchJina(url: string, key: string | null): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const headers: Record<string, string> = {
      "Accept": "text/plain",
      "X-Return-Format": "text",
    };
    if (key) headers["Authorization"] = `Bearer ${key}`;
    const resp = await fetch(`https://r.jina.ai/${url}`, { signal: ctrl.signal, headers });
    clearTimeout(t);
    if (!resp.ok) return null;
    const texto = (await resp.text()).replace(/\s+/g, " ").trim();
    if (ehBloqueio(texto)) return null;
    return texto.length > 120 ? texto.slice(0, 3500) : null;
  } catch {
    return null;
  }
}

// Firecrawl — renderiza com browser real + proxy stealth, vence anti-bot que o
// fetch direto e o Jina não vencem (Indeed/LinkedIn/Cloudflare). Custa CRÉDITO
// (pago), então é o ÚLTIMO recurso e limitado por um orçamento por execução.
// proxy:"auto" tenta básico e só usa stealth (mais caro) se precisar.
async function fetchFirecrawl(url: string, key: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000); // render com browser pode demorar
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        proxy: "auto",
        timeout: 20000,
      }),
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const d = await resp.json();
    const texto = String(d?.data?.markdown ?? "").replace(/\s+/g, " ").trim();
    if (ehBloqueio(texto)) return null;
    return texto.length > 120 ? texto.slice(0, 3500) : null;
  } catch {
    return null;
  }
}

type FcBudget = { key: string | null; usados: number; max: number };

// LinkedIn: fetch direto (datacenter) e Firecrawl NÃO funcionam (bloqueio/recusa).
// Mas o endpoint PÚBLICO "guest" (/jobs-guest/jobs/api/jobPosting/<id>, SEM login)
// traz título/empresa/local/status; o Jina (infra própria) consegue lê-lo.
function linkedinGuest(url: string): string | null {
  const m = url.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/i);
  return m ? `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${m[1]}` : null;
}

// Cascata: (1) fetch direto → (2) Jina (grátis) → (3) Firecrawl (pago, só quando os
// dois falham E ainda há orçamento). O orçamento limita gasto de crédito e tempo.
async function buscarPagina(
  url: string,
  jinaKey: string | null,
  fc: FcBudget,
): Promise<string | null> {
  // LinkedIn é ilegível por fetch/Firecrawl → usa o endpoint guest público via Jina.
  const guest = linkedinGuest(url);
  if (guest) return await fetchJina(guest, jinaKey);

  const direto = await fetchDireto(url);
  if (direto) return direto;
  const jina = await fetchJina(url, jinaKey);
  if (jina) return jina;
  if (fc.key && fc.usados < fc.max) {
    fc.usados++; // reserva o crédito ANTES do await (evita estourar o orçamento)
    return await fetchFirecrawl(url, fc.key);
  }
  return null;
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

  // áreas temáticas (rótulo → id) — a IA classifica a área p/ a análise de demanda
  const { data: areas } = await svc.from("areas_tematicas")
    .select("id, label_display").eq("ativo", true);
  const mapaArea = new Map<string, string>();
  for (const a of areas ?? []) mapaArea.set(norm(a.label_display), a.id);

  // vagas pendentes ainda não classificadas
  const { data: vagas } = await svc.from("vagas")
    .select("id, titulo, empresa_orgao, descricao, tipo, modalidade, remuneracao_bolsa, carga_horaria, area_tematica_id, link_candidatura")
    .eq("status", "pendente")
    .is("ai_classificado_em", null)
    .limit(30);

  if (!vagas || vagas.length === 0) return json({ ok: true, classificadas: 0, motivo: "nada_pendente" });

  // APRENDIZADO CONTÍNUO (few-shot): decisões recentes da coordenação viram
  // exemplos no prompt — sem retreinar, a IA calibra ao gosto real de quem cura.
  // Inclui TIPO nas aprovadas de propósito: quando a curadoria corrige o tipo de
  // uma vaga (ex.: "processo_seletivo" errado → "emprego"), essa correção fica
  // salva em `vagas.tipo` e passa a valer como exemplo nas próximas classificações
  // — o sistema aprende com toda edição manual, não só com aprovar/rejeitar.
  const TIPO_ROTULO: Record<string, string> = {
    estagio: "estágio", emprego: "emprego", processo_seletivo: "seleção pública (órgão público)", bolsa: "bolsa",
  };
  const [aprovadas, rejeitadas] = await Promise.all([
    svc.from("vagas").select("titulo, empresa_orgao, tipo")
      .eq("status", "aprovada").order("data_captura", { ascending: false }).limit(18),
    svc.from("vagas").select("titulo, motivo_rejeicao_categoria, motivo_rejeicao_detalhe")
      .eq("status", "rejeitada").order("data_captura", { ascending: false }).limit(18),
  ]);
  const cortar = (s: string | null) => (s ?? "").slice(0, 90);
  const fewshot = (aprovadas.data?.length || rejeitadas.data?.length)
    ? `\n\nDECISÕES RECENTES DA COORDENAÇÃO (aprenda com o gosto real dela; case novas vagas por analogia):\n` +
      `APROVADAS (aceitas — tipo já revisado e corrigido manualmente quando preciso; use como referência de público x privado):\n` +
      (aprovadas.data ?? []).map((a) => `- ${cortar(a.titulo)}${a.empresa_orgao ? ` (${cortar(a.empresa_orgao)})` : ""} → tipo: ${TIPO_ROTULO[a.tipo] ?? a.tipo}`).join("\n") +
      `\nREJEITADAS (recusadas — NÃO recomende aprovar coisas parecidas):\n` +
      (rejeitadas.data ?? []).map((r) => `- ${cortar(r.titulo)} — motivo: ${r.motivo_rejeicao_categoria ?? "?"}${r.motivo_rejeicao_detalhe ? ` (${cortar(r.motivo_rejeicao_detalhe)})` : ""}`).join("\n")
    : "";

  const jinaKey = await cfg("jina_api_key"); // opcional (limites maiores); funciona sem
  // Firecrawl é o último recurso (pago) — no máx. FC_MAX páginas por execução p/
  // limitar crédito e tempo; as demais bloqueadas caem em título+trecho.
  const fc: FcBudget = { key: await cfg("firecrawl_api_key"), usados: 0, max: 6 };
  const LOTE = 8;
  let classificadas = 0, erros = 0;
  const resumo: Record<string, number> = { aprovar: 0, revisar: 0, descartar: 0 };

  for (let i = 0; i < vagas.length; i += LOTE) {
    const lote = vagas.slice(i, i + LOTE);
    // busca o conteúdo real da página de cada vaga (em paralelo) — a verdade
    // (local, formação, salário) costuma estar só no corpo, não no título.
    const paginas = await Promise.all(
      lote.map((v) => (v.link_candidatura ? buscarPagina(v.link_candidatura, jinaKey, fc) : Promise.resolve(null))),
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
      // persiste o NÍVEL lido pela IA (tecnico/superior/ambos) — sem isso a vaga fica
      // no default "tecnico" da ingestão, mesmo sendo superior (ex.: Gestão Ambiental).
      if (["tecnico", "superior", "ambos"].includes(c.nivel ?? "")) {
        patch.nivel = c.nivel;
      }
      // preenche a faixa salarial / bolsa / benefícios (quando a IA achou e ainda não tinha)
      if (!v.remuneracao_bolsa && c.faixa_salarial && /R\$|\d/.test(c.faixa_salarial)) {
        patch.remuneracao_bolsa = String(c.faixa_salarial).slice(0, 120);
      }
      // preenche a CARGA HORÁRIA lida pela IA (quando a vaga ainda não tinha)
      if (!v.carga_horaria && c.carga_horaria && String(c.carga_horaria).trim()) {
        patch.carga_horaria = String(c.carga_horaria).trim().slice(0, 80);
      }
      // refina o TIPO (estagio/emprego/bolsa) só quando a vaga está no default da
      // ingestão ("processo_seletivo") — não sobrescreve escolha manual da curadoria.
      if (v.tipo === "processo_seletivo" &&
          ["estagio", "emprego", "bolsa", "processo_seletivo"].includes(c.tipo ?? "")) {
        patch.tipo = c.tipo;
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
      // área temática (mapeia o rótulo da IA → id) — só quando a vaga ainda não tem
      if (!v.area_tematica_id && c.area_tematica) {
        const aid = mapaArea.get(norm(String(c.area_tematica)));
        if (aid) patch.area_tematica_id = aid;
      }

      const { error } = await svc.from("vagas").update(patch).eq("id", v.id);
      if (error) { erros++; console.error("update falhou:", error.message); }
      else classificadas++;
    }
  }

  return json({ ok: true, classificadas, erros, resumo });
});
