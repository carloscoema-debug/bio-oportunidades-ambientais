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

const PROMPT_REGRAS = `Você é o assistente de curadoria do BIO, portal do IFCE Campus Fortaleza que divulga vagas para estudantes e egressos de: Técnico em Meio Ambiente, Gestão Ambiental, Saneamento Ambiental, Engenharia Ambiental e Sanitária.

REGRA DE REGIÃO (rígida):
- Vaga presencial ou híbrida só serve se o local for no CEARÁ. Presencial/híbrida em outro estado => "descartar".
- Vaga 100% remota pode ser de qualquer estado.
- Se não der para saber o local, uf=null e modalidade="indefinido".

ADERÊNCIA ao curso:
- Aderente: vagas reais (emprego/estágio/seleção pública) das áreas ambiental, saneamento, recursos hídricos, licenciamento, resíduos, energia renovável (eólica/solar), monitoramento, em nível técnico ou superior.
- NÃO aderente (=> descartar): notícia/reportagem (não é vaga), chamamento público/licitação/pregão/parceria (não é vaga de pessoa), concurso nacional sem relação ambiental, cargos operacionais não-ambientais (servente, pedreiro), TI/administrativo genérico.
- Pouco aderente ao técnico (=> score menor, "revisar" ou "descartar"): cargos que exigem nível superior sênior/coordenação/gerência/engenheiro pleno, ou funções fora do perfil (ex.: desenhista projetista).

Para CADA vaga devolva um objeto com:
- titulo_limpo (string curta e legível)
- municipio (nome da cidade, ou null)
- uf (sigla de 2 letras como "CE" ou "SP"; null se não souber)
- modalidade ("presencial" | "remoto" | "hibrido" | "indefinido")
- nivel ("tecnico" | "superior" | "ambos" | "operacional" | "indefinido")
- score (0-100)
- recomendacao ("aprovar" | "revisar" | "descartar")
- justificativa (uma frase curta)

Responda SOMENTE com JSON: {"resultados": [ um objeto por vaga, na MESMA ordem ]}.`;

type Classif = {
  titulo_limpo?: string; municipio?: string | null; uf?: string | null;
  modalidade?: string; nivel?: string; score?: number;
  recomendacao?: string; justificativa?: string;
};

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
    .select("id, titulo, empresa_orgao, descricao, modalidade")
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
    const payload = lote.map((v, idx) => ({
      n: idx,
      titulo: v.titulo,
      empresa: v.empresa_orgao,
      descricao: (v.descricao ?? "").slice(0, 500),
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

      const patch: Record<string, unknown> = {
        uf: c.uf ? String(c.uf).toUpperCase().slice(0, 2) : null,
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

      const { error } = await svc.from("vagas").update(patch).eq("id", v.id);
      if (error) { erros++; console.error("update falhou:", error.message); }
      else classificadas++;
    }
  }

  return json({ ok: true, classificadas, erros, resumo });
});
