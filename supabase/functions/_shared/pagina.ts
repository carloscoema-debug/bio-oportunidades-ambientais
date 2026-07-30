// BIO — leitura do conteúdo real da página da vaga.
//
// Vive aqui (e não dentro de uma função só) porque DUAS funções precisam ler a
// página, pelo mesmo motivo — a verdade está no corpo, não no cabeçalho HTTP:
//   * classificar-vagas: para julgar área/local/formação na entrada.
//   * verificar-links:   para saber se a vaga AINDA aceita candidatura.
// Manter uma cópia em cada uma faria as duas divergirem com o tempo.
//
// Cascata: (1) fetch direto (rápido, cobre a maioria) → (2) r.jina.ai (grátis,
// vence anti-bot simples) → (3) Firecrawl (browser real + proxy stealth, PAGO —
// último recurso, limitado por orçamento; é o único que vence o Cloudflare do
// Indeed, que recusa 403 para qualquer IP de datacenter).

// Interstício de anti-bot/CAPTCHA. Se a "página" for isso, NÃO é o conteúdo da
// vaga — devolvemos null para ninguém ler o bloqueio como se fosse a vaga.
// O corte por tamanho (<1500) evita falso-positivo em página real que cite "cloudflare".
const RE_BLOQUEIO =
  /(additional verification required|verify you are human|are you a robot|just a moment|enable javascript and cookies|checking your browser|attention required|ray id|captcha|acesso negado|access denied)/i;

export const ehBloqueio = (t: string) => t.length < 1500 && RE_BLOQUEIO.test(t);

/** Frases que significam "esta vaga não recebe mais candidatura".
 *  Deliberadamente ESPECÍFICAS: "encerrada"/"expirada" soltas apareceriam em
 *  página de edital falando de outra fase e derrubariam vaga boa. Cada item
 *  aqui só casa quando o texto afirma o encerramento DESTA vaga. */
const FRASES_ENCERRAMENTO: RegExp[] = [
  /\b(essa|esta)\s+vaga\s+(j[áa]\s+)?expirou\b/i,
  /\bvaga\s+expirada\b/i,
  /\bn[ãa]o\s+(aceita|est[áa]\s+aceitando)\s+mais\s+candidaturas\b/i,
  /\bno\s+longer\s+accepting\s+applications\b/i,
  /\b(esta|essa)\s+vaga\s+n[ãa]o\s+est[áa]\s+mais\s+dispon[íi]vel\b/i,
  /\bvaga\s+encerrada\b/i,
  /\bcandidaturas\s+encerradas\b/i,
  /\binscri[çc][õo]es\s+encerradas\b/i,
  /\bprocesso\s+(seletivo\s+)?encerrado\b/i,
  /\bthis\s+job\s+(posting\s+)?(is\s+)?(no\s+longer\s+available|has\s+expired)\b/i,
  /\bjob\s+posting\s+has\s+expired\b/i,
  /\bposition\s+has\s+been\s+filled\b/i,
];

/** Devolve o trecho que provou o encerramento (para a coordenação conferir),
 *  ou null se a página não afirma nada disso. */
export function detectarEncerramento(texto: string): string | null {
  for (const re of FRASES_ENCERRAMENTO) {
    const m = re.exec(texto);
    if (m) {
      // devolve a frase com um pouco de contexto ao redor, para revisão humana
      const ini = Math.max(0, m.index - 40);
      return texto.slice(ini, m.index + m[0].length + 60).replace(/\s+/g, " ").trim();
    }
  }
  return null;
}

// Armadilha real (vaga Eneva/Caucaia, 2026-07-30): a página de vaga do LinkedIn mostra
// DOIS sinais de local diferentes — "Empresa Fortaleza, Ceará, Brazil" logo no topo
// (a REGIÃO METROPOLITANA, rótulo genérico do LinkedIn pra cidade-satélite) e,
// mais abaixo, um campo específico rotulado "Local de Trabalho: Caucaia - CE" (o
// dado real). A IA leu o sinal errado — mais chamativo, mas menos confiável.
// Esse rótulo é padrão do template do LinkedIn (não é texto livre), então extrair
// por regex é mais confiável que pedir pra IA priorizar corretamente: um campo
// estruturado nunca devia perder pra um cabeçalho genérico.
// Exige o sufixo " - UF" pra ancorar o FIM do nome da cidade. Sem essa âncora,
// não dá pra saber onde o nome termina: a página já chega aqui com toda quebra
// de linha achatada em espaço (buscarPagina normaliza \s+ → " "), então não há
// separador entre "Caucaia" e o texto seguinte ("Saiba mais sobre nós..."). Com
// "- UF" ancorando o fim, funciona até com cidade composta ("São Gonçalo do
// Amarante - CE"). Sem esse sufixo no texto, prefere não extrair a arriscar
// pegar frase inteira por engano — cai no comportamento normal (IA decide).
const RE_LOCAL_TRABALHO = /\bLocal de Trabalho\s*:\s*([A-ZÀ-Ú][^-]{1,40}?)\s*-\s*([A-Z]{2})\b/;

/** Extrai cidade + UF do campo estruturado "Local de Trabalho: Cidade - UF",
 *  quando a página tiver esse rótulo COM o sufixo de UF. null se não encontrar. */
export function extrairLocalTrabalho(texto: string): { cidade: string; uf: string | null } | null {
  const m = RE_LOCAL_TRABALHO.exec(texto);
  if (!m) return null;
  const cidade = m[1].trim();
  if (!cidade) return null;
  return { cidade, uf: m[2].toUpperCase() };
}

const UA_NAVEGADOR =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36";

// Teto de segurança da leitura da página (memória/custo), NÃO o tamanho enviado
// à IA — esse é cortado à parte em classificar-vagas. Ficava em 3500, curto
// demais: na vaga Eneva/Caucaia, "Local de Trabalho: Caucaia - CE" só aparecia
// no caractere ~5862 de uma página de 6437 (título + empresa + requisitos +
// atividades vêm antes) — o campo estruturado nunca chegava a ser lido. 12000
// cobre confortavelmente um anúncio completo sem deixar de ter limite.
const MAX_TEXTO = 12000;

async function fetchDireto(url: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const resp = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA_NAVEGADOR,
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
    return texto.length > 80 ? texto.slice(0, MAX_TEXTO) : null;
  } catch {
    return null;
  }
}

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
    return texto.length > 120 ? texto.slice(0, MAX_TEXTO) : null;
  } catch {
    return null;
  }
}

async function fetchFirecrawl(url: string, key: string): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000); // render com browser demora
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        proxy: "auto", // tenta básico; só usa stealth (mais caro) se precisar
        timeout: 20000,
      }),
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const d = await resp.json();
    const texto = String(d?.data?.markdown ?? "").replace(/\s+/g, " ").trim();
    if (ehBloqueio(texto)) return null;
    return texto.length > 120 ? texto.slice(0, MAX_TEXTO) : null;
  } catch {
    return null;
  }
}

export type FcBudget = { key: string | null; usados: number; max: number };

// LinkedIn: fetch direto (datacenter) e Firecrawl NÃO funcionam (bloqueio/recusa).
// Mas o endpoint PÚBLICO "guest" (/jobs-guest/jobs/api/jobPosting/<id>, SEM login)
// traz título/empresa/local/status; o Jina (infra própria) consegue lê-lo.
function linkedinGuest(url: string): string | null {
  const m = url.match(/linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)/i);
  return m ? `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${m[1]}` : null;
}

/** Texto da página, ou null se todas as tentativas falharem/forem bloqueadas. */
export async function buscarPagina(
  url: string,
  jinaKey: string | null,
  fc: FcBudget,
): Promise<string | null> {
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
