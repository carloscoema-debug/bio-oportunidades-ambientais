// BIO — Edge Function: extrair-vaga-imagem (Canal D · print/PDF assistido por IA)
// A coordenação cola ou envia um print (imagem) ou PDF de uma vaga (flyer de empresa,
// captura de outro site, imagem recebida em grupo…) no painel. Esta função sobe o
// arquivo ao Storage (para auditoria/conferência), pede ao Gemini (multimodal) para
// LER a imagem inteira e extrair a vaga estruturada — mesma régua de aderência,
// cursos, tipo público×privado e disponibilidade usada no classificar-vagas — e cria
// a vaga já como PENDENTE, com ai_recomendacao preenchida, pronta para a fila.
//
// Diferença p/ os outros canais: aqui a extração E a classificação acontecem na
// MESMA chamada (a imagem já traz o contexto completo — não há "página" a buscar
// depois). A curadoria continua soberana: a vaga nasce pendente, nunca aprovada.
//
// Auth: x-bio-secret (automação/teste) OU bio_is_admin (JWT do usuário logado no
// painel) — mesmo padrão dual de classificar-vagas/coletar-rss. verify_jwt=false.
// Body: { imagem_base64: string, mime_type: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

const CURSOS_BIO = new Set([
  "gestao_ambiental", "engenharia_sanitaria_ambiental", "saneamento_ambiental",
  "tecnico_meio_ambiente", "tecnico_saneamento",
]);

const MIME_ACEITOS = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — mesmo limite do bucket

// Mesma régua de domínio do classificar-vagas (cursos, região, aderência, tipo
// público×privado, disponibilidade), adaptada para EXTRAIR de uma imagem/PDF em vez
// de ler uma página — aqui o "contexto completo" já é a própria imagem.
const PROMPT_IMAGEM = `Você é o assistente de curadoria do BIO, portal do IFCE Campus Fortaleza. Vai receber a IMAGEM (ou PDF) de uma vaga — um flyer de empresa, captura de tela de site de emprego, ou imagem recebida em grupo. LEIA TODO O TEXTO VISÍVEL na imagem com atenção (título, empresa, requisitos, atividades, benefícios, prazo, forma de inscrição) antes de responder.

PRIMEIRO, confira se a imagem É REALMENTE UMA VAGA (oferta de estágio/emprego/seleção/bolsa) — se for outra coisa (print de conversa não relacionada, propaganda de produto, foto aleatória, imagem ilegível), devolva "eh_vaga_valida": false com "motivo_invalido" explicando, e pode deixar os demais campos null/vazios.

Se FOR uma vaga, aplique estas regras (as mesmas usadas na curadoria do BIO):

CURSOS DO BIO: SUPERIOR — Gestão Ambiental, Engenharia Sanitária e Ambiental (= Engenharia Ambiental e Sanitária), Saneamento Ambiental. TÉCNICO — Técnico em Meio Ambiente, Técnico em Saneamento. Nível superior NUNCA é motivo para descartar.

REGIÃO (rígida): vaga presencial/híbrida só serve se o local for no CEARÁ. Presencial/híbrida fora do CE => descartar. Remota pode ser de qualquer estado. Sem informação de local => uf=null, modalidade="indefinido".

ADERÊNCIA: aprove vaga real da área ambiental/saneamento/recursos hídricos/licenciamento/resíduos/energia renovável cuja formação exigida seja compatível com os cursos do BIO (ou aberta/sem exigência específica). Descarte se a formação exigida for de outra área (Administração, Direito, TI, Enfermagem, Mecânica…), mesmo que o título pareça ambiental. Cargos de Qualidade/SGI/SMS/HSE/QSMS são possivelmente aderentes (SGI inclui meio ambiente) — não descarte só por dizer "qualidade". Cargos comerciais/vendas em empresa do setor ambiental são aderentes quando o que se vende é serviço/solução ambiental. "revisar" só com dúvida real; prefira "revisar" a "descartar" quando faltar dado mas a vaga PUDER ser ambiental.

TIPO — "processo_seletivo" (aparece como "Seleção pública") É SÓ PARA EMPREGADOR PÚBLICO (concurso, prefeitura, autarquia, secretaria, órgão público). Empresas privadas que usam a palavra "processo seletivo" no material continuam "emprego" (ou "estagio") — o nome da expressão não define o tipo, quem define é o empregador. Na dúvida, use "emprego".

DISPONIBILIDADE: se a imagem indicar prazo já vencido ou "vaga encerrada"/"não aceita mais candidaturas", descarte com justificativa começando por "Encerrada: ".

ÁREA TEMÁTICA — use EXATAMENTE um destes rótulos: "Conservação e Biodiversidade", "Consultoria Ambiental", "Educação Ambiental", "Fiscalização e Monitoramento", "Geoprocessamento", "Gestão e Auditoria Ambiental", "Laboratório e Análises", "Licenciamento Ambiental", "Meio Ambiente Industrial", "Órgãos Públicos Ambientais", "Qualidade da Água", "Recursos Hídricos", "Resíduos Sólidos", "Saneamento", "Outras Áreas".

Devolva SOMENTE um objeto JSON (sem markdown, sem texto fora do JSON) com:
{
  "eh_vaga_valida": boolean,
  "motivo_invalido": string|null,
  "titulo": string|null (cargo, limpo, sem emoji),
  "empresa": string|null (nome real do empregador),
  "municipio": string|null,
  "uf": string|null (2 letras),
  "modalidade": "presencial"|"remoto"|"hibrido"|"indefinido",
  "nivel": "tecnico"|"superior"|"ambos"|"operacional"|"indefinido",
  "cursos": string[] (códigos: gestao_ambiental, engenharia_sanitaria_ambiental, saneamento_ambiental, tecnico_meio_ambiente, tecnico_saneamento — [] se não aderente),
  "area_tematica": string|null,
  "tipo": "estagio"|"emprego"|"bolsa"|"processo_seletivo",
  "requisitos": string|null (lista corrida do que a imagem pedir),
  "atividades": string|null (lista corrida do que a imagem descrever como atividades),
  "faixa_salarial": string|null (remuneração e/ou benefícios listados — ex.: "Cesta básica, alimentação, plano de saúde, auxílio educação"),
  "carga_horaria": string|null,
  "forma_candidatura": string|null (como se candidatar — nome do site/app, e-mail, WhatsApp, instrução livre; USE ESTE campo para nomes de site sem "http" na frente, ex.: "www.empresa.com.br" ou "Cadastre-se em empresa.com.br, aba X"),
  "link_candidatura": string|null (só preencha se for uma URL COMPLETA, começando com "http://" ou "https://" — nunca um domínio solto como "www.site.com"),
  "prazo_inscricao": string|null (formato AAAA-MM-DD, só se uma data clara aparecer),
  "sem_prazo_definido": boolean,
  "score": number (0-100),
  "recomendacao": "aprovar"|"revisar"|"descartar",
  "justificativa": string (uma frase curta)
}`;

type Extracao = {
  eh_vaga_valida?: boolean; motivo_invalido?: string | null;
  titulo?: string | null; empresa?: string | null; municipio?: string | null; uf?: string | null;
  modalidade?: string; nivel?: string; cursos?: string[] | null; area_tematica?: string | null;
  tipo?: string; requisitos?: string | null; atividades?: string | null;
  faixa_salarial?: string | null; carga_horaria?: string | null;
  forma_candidatura?: string | null; link_candidatura?: string | null;
  prazo_inscricao?: string | null; sem_prazo_definido?: boolean;
  score?: number; recomendacao?: string; justificativa?: string;
};

async function chamarGeminiVisao(
  cfg: (k: string) => Promise<string | null>,
  imagemBase64: string,
  mimeType: string,
): Promise<Extracao> {
  const key = await cfg("gemini_api_key");
  const model = (await cfg("gemini_model")) ?? "gemini-2.5-flash";
  if (!key) throw new Error("sem gemini_api_key");
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: PROMPT_IMAGEM },
            { inline_data: { mime_type: mimeType, data: imagemBase64 } },
          ],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    },
  );
  if (!resp.ok) throw new Error(`gemini ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const d = await resp.json();
  const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(txt) as Extracao;
}

function extensaoDe(mimeType: string): string {
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/heic": "heic", "application/pdf": "pdf" }[mimeType] ?? "bin";
}

Deno.serve(async (req) => {
  const CORS = corsHeaders(req);
  const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "use POST" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = async (k: string) =>
    (await svc.from("app_config").select("valor").eq("chave", k).maybeSingle()).data?.valor ?? null;

  // auth: segredo compartilhado (automação/teste) OU admin autenticado (painel)
  let ok = false;
  const segredo = req.headers.get("x-bio-secret");
  if (segredo && segredo === (await cfg("ingest_email_secret"))) ok = true;
  if (!ok) {
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    if ((await asUser.rpc("bio_is_admin")).data) ok = true;
  }
  if (!ok) return json({ ok: false, erro: "acesso restrito" }, 403);

  let body: { imagem_base64?: string; mime_type?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const imagemBase64 = (body.imagem_base64 ?? "").trim();
  const mimeType = (body.mime_type ?? "").trim();
  if (!imagemBase64) return json({ ok: false, erro: "imagem_base64 obrigatório" }, 400);
  if (!MIME_ACEITOS.has(mimeType)) return json({ ok: false, erro: `formato não aceito: ${mimeType}` }, 400);
  // base64 infla ~33% o tamanho — checagem aproximada antes de decodificar
  if (imagemBase64.length * 0.75 > MAX_BYTES) return json({ ok: false, erro: "arquivo maior que 8MB" }, 400);

  // 1) sobe o arquivo original ao Storage — a curadoria pode conferir a imagem
  // fonte antes de aprovar (mesmo espírito do "Ver vaga na fonte" dos outros canais).
  const caminho = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extensaoDe(mimeType)}`;
  const bytes = Uint8Array.from(atob(imagemBase64), (c) => c.charCodeAt(0));
  const { error: erroUpload } = await svc.storage.from("capturas-vagas").upload(caminho, bytes, {
    contentType: mimeType, upsert: false,
  });
  if (erroUpload) return json({ ok: false, erro: `falha no upload: ${erroUpload.message}` }, 500);

  // 2) IA lê a imagem inteira e já extrai + classifica (contexto completo de uma vez)
  let ext: Extracao;
  try {
    ext = await chamarGeminiVisao(cfg, imagemBase64, mimeType);
  } catch (e) {
    return json({ ok: false, erro: `falha ao ler a imagem: ${String(e instanceof Error ? e.message : e)}` }, 502);
  }

  if (!ext.eh_vaga_valida) {
    // não cria vaga — evita poluir a fila com prints que não são oportunidade real
    return json({ ok: false, motivo: "nao_e_vaga", detalhe: ext.motivo_invalido ?? "A imagem não parece ser uma vaga." });
  }

  // municípios do CE e áreas temáticas — mesmo canônico usado no classificar-vagas
  const [munis, areas] = await Promise.all([
    svc.from("municipios_referencia").select("municipio").eq("uf", "CE").eq("ativo", true),
    svc.from("areas_tematicas").select("id, label_display").eq("ativo", true),
  ]);
  const mapaMuni = new Map<string, string>();
  for (const m of munis.data ?? []) mapaMuni.set(norm(m.municipio), m.municipio);
  const mapaArea = new Map<string, string>();
  for (const a of areas.data ?? []) mapaArea.set(norm(a.label_display), a.id);

  const municipioCanon = ext.municipio ? mapaMuni.get(norm(ext.municipio)) ?? null : null;
  const areaId = ext.area_tematica ? mapaArea.get(norm(ext.area_tematica)) ?? null : null;
  const cursos = Array.isArray(ext.cursos)
    ? [...new Set(ext.cursos.map((x) => String(x).trim().toLowerCase()))].filter((x) => CURSOS_BIO.has(x))
    : [];
  const ufOk = ext.uf && /^[a-zA-Z]{2}$/.test(ext.uf.trim()) ? ext.uf.trim().toUpperCase() : null;
  const rec = ["aprovar", "revisar", "descartar"].includes(ext.recomendacao ?? "") ? ext.recomendacao! : "revisar";
  const tipo = ["estagio", "emprego", "bolsa", "processo_seletivo"].includes(ext.tipo ?? "") ? ext.tipo! : "emprego";
  const nivel = ["tecnico", "superior", "ambos", "operacional", "indefinido"].includes(ext.nivel ?? "") ? ext.nivel! : "indefinido";
  // rede de segurança: a coluna exige http(s) válido ou null — um domínio solto
  // (ex.: "www.empresa.com.br") vira parte da forma_candidatura em vez de derrubar o insert.
  const linkOk = ext.link_candidatura && /^https?:\/\//i.test(ext.link_candidatura.trim())
    ? ext.link_candidatura.trim() : null;
  const formaFinal = linkOk
    ? ext.forma_candidatura?.trim() || null
    : [ext.forma_candidatura?.trim(), ext.link_candidatura?.trim()].filter(Boolean).join(" — ") || null;

  const { data: nova, error: erroInsert } = await svc.from("vagas").insert({
    titulo: (ext.titulo ?? "Vaga sem título (revisar imagem)").slice(0, 300),
    empresa_orgao: ext.empresa?.trim().slice(0, 200) || null,
    tipo,
    nivel,
    curso_alvo: cursos.length > 0 ? cursos : ["tecnico_meio_ambiente"],
    area_tematica_id: areaId,
    municipio: municipioCanon,
    uf: ufOk,
    modalidade: ["presencial", "remoto", "hibrido"].includes(ext.modalidade ?? "") ? ext.modalidade : "indefinido",
    requisitos: ext.requisitos?.trim().slice(0, 2000) || null,
    atividades: ext.atividades?.trim().slice(0, 2000) || null,
    remuneracao_bolsa: ext.faixa_salarial?.trim().slice(0, 300) || null,
    carga_horaria: ext.carga_horaria?.trim().slice(0, 80) || null,
    forma_candidatura: formaFinal?.slice(0, 300) || null,
    link_candidatura: linkOk,
    sem_prazo_definido: ext.sem_prazo_definido ?? !ext.prazo_inscricao,
    prazo_inscricao: ext.prazo_inscricao && /^\d{4}-\d{2}-\d{2}$/.test(ext.prazo_inscricao) ? ext.prazo_inscricao : null,
    descricao: [ext.requisitos, ext.atividades].filter(Boolean).join("\n\n").slice(0, 2000) || null,
    imagem_fonte_url: caminho,
    origem: "Canal D · Print/PDF (upload assistido por IA)",
    ai_recomendacao: rec,
    ai_score: typeof ext.score === "number" ? Math.round(ext.score) : null,
    ai_justificativa: (ext.justificativa ?? "").slice(0, 400) || null,
    ai_classificado_em: new Date().toISOString(),
    status: "pendente",
  }).select("id, titulo").single();

  if (erroInsert) return json({ ok: false, erro: `falha ao salvar a vaga: ${erroInsert.message}` }, 500);

  return json({ ok: true, vaga_id: nova.id, titulo: nova.titulo, recomendacao: rec, score: ext.score ?? null });
});
