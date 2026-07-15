// BIO — CORS restrito aos domínios do próprio projeto, em vez de aceitar
// qualquer origem ("*"). Só importa pra chamadas feitas por um NAVEGADOR
// (fetch do painel admin ou do formulário público) — funções acionadas só
// por cron/webhook com x-bio-secret não usam isto, porque CORS nunca se
// aplica a chamadas servidor-a-servidor.
const ORIGENS_PERMITIDAS = [
  "https://biooportunidades.org",
  "https://www.biooportunidades.org",
];
// Preview/editor do Lovable roda em subdomínios variáveis desses domínios —
// checa por sufixo em vez de string fixa, senão quebra a cada novo preview.
const SUFIXOS_PREVIEW = [".lovable.app", ".lovableproject.com"];

function origemPermitida(origin: string): boolean {
  return (
    ORIGENS_PERMITIDAS.includes(origin) ||
    SUFIXOS_PREVIEW.some((s) => origin.endsWith(s))
  );
}

/** Monta os headers de CORS pra esta requisição específica (não é um objeto
 * fixo — precisa ser chamado a cada request pra refletir a origem certa). */
export function corsHeaders(
  req: Request,
  allowHeaders = "authorization, x-client-info, apikey, content-type",
): HeadersInit {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": origemPermitida(origin) ? origin : ORIGENS_PERMITIDAS[0],
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
