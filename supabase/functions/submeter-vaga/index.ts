// BIO — Edge Function: submeter-vaga (Fase 3 · F3-03 · Canal C)
// Recebe uma vaga do formulário público "Divulgue uma oportunidade" e a insere
// como PENDENTE com flag de origem externa (nunca publica sem revisão humana — o
// trigger bio_bloqueios_duros/B4 garante isso). Protegido por honeypot + rate-limit
// por IP (3/h). Chamado do navegador (verify_jwt=false).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });

const TIPOS = ["estagio", "emprego", "processo_seletivo", "bolsa"];
const REGIOES = ["rmf", "interior_ceara", "fora_ceara", "indefinido"];
const RATE_SALT = "bio-submissao-v1";
const emailOk = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
// link deve ser http(s) — bloqueia javascript:/data:/vbscript: (XSS via link)
const httpOk = (s: string) => /^https?:\/\//i.test(s);

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, erro: "use POST" }, 405);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { return json({ ok: false, erro: "corpo inválido" }, 400); }

  // honeypot: bots preenchem o campo escondido — fingimos sucesso e não inserimos
  if ((b.website ?? "").trim() !== "") return json({ ok: true, status: "recebida" });

  const titulo = (b.titulo ?? "").trim();
  const tipo = (b.tipo ?? "").trim();
  const empresa = (b.empresa_orgao ?? "").trim();
  const regiao = REGIOES.includes((b.regiao ?? "").trim()) ? b.regiao.trim() : "indefinido";
  const descricao = (b.descricao ?? "").trim();
  const link = (b.link_candidatura ?? "").trim();
  const forma = (b.forma_candidatura ?? "").trim();
  const contatoNome = (b.contato_nome ?? "").trim();
  const contatoEmail = (b.contato_email ?? "").trim();

  if (titulo.length < 5) return json({ ok: false, motivo: "titulo_curto" }, 400);
  if (!TIPOS.includes(tipo)) return json({ ok: false, motivo: "tipo_invalido" }, 400);
  if (!emailOk(contatoEmail)) return json({ ok: false, motivo: "email_invalido" }, 400);
  if (!link && !forma) return json({ ok: false, motivo: "sem_forma_candidatura" }, 400);
  if (link && !httpOk(link)) return json({ ok: false, motivo: "link_invalido" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // rate-limit: 3 submissões por IP por hora
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "desconhecido";
  const ipHash = await sha256(ip + RATE_SALT);
  const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await supabase
    .from("vagas")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash_submissao", ipHash)
    .gte("data_captura", umaHoraAtras);
  if ((count ?? 0) >= 3) return json({ ok: false, motivo: "limite_excedido" }, 429);

  const { error } = await supabase.from("vagas").insert({
    titulo: titulo.slice(0, 300),
    tipo,
    empresa_orgao: empresa || null,
    regiao,
    descricao: descricao ? descricao.slice(0, 2000) : null,
    link_candidatura: link || null,
    forma_candidatura: forma || null,
    origem: "Divulgação externa",
    origem_externa_nao_verificada: true,
    status: "pendente",
    sem_prazo_definido: true,
    contato_submissao: `${contatoNome} <${contatoEmail}>`.trim(),
    ip_hash_submissao: ipHash,
  });
  if (error) return json({ ok: false, erro: error.message }, 500);

  return json({ ok: true, status: "recebida" });
});
