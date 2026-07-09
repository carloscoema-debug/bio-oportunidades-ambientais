import { Link, useRouterState } from "@tanstack/react-router";

// Subtítulo contextual por página interna (migalha leve "onde estou").
// A home não tem contexto → mostra a tagline do observatório.
const CONTEXTO: Record<string, string> = {
  "/divulgar": "Divulgue uma oportunidade",
  "/como-se-candidatar": "Como se candidatar",
  "/politica-de-privacidade": "Política de privacidade",
  "/descadastrar": "Newsletter",
};

export function SiteHeader() {
  const pathname = useRouterState({
    select: (s) => s.location.pathname.replace(/\/$/, "") || "/",
  });
  const contexto = CONTEXTO[pathname] ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 shadow-[0_1px_0_rgba(27,42,33,0.03),0_10px_24px_-20px_rgba(27,42,33,0.28)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/80">
      <div className="mx-auto flex min-h-[64px] max-w-[680px] items-center gap-2.5 px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-sm"
          aria-label="BIO — ir para o início do portal"
        >
          <span
            className="font-display text-3xl leading-none text-ink"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            BIO<span className="text-mata">.</span>
          </span>
          <span
            title="O BIO está em período de validação — encontrou algo estranho? Avise a coordenação."
            className="mono-caps inline-flex items-center rounded-full border border-[#C4D4E2] bg-ceu-tint px-2 py-0.5 text-[10px] leading-none text-ceu"
          >
            Beta
          </span>
        </Link>

        {contexto ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="text-[20px] leading-none text-line-strong">
              /
            </span>
            <span className="mono-caps truncate text-[11px] text-ink-soft">
              {contexto}
            </span>
          </span>
        ) : (
          <span className="mono-caps hidden text-[11px] text-ink-soft sm:inline">
            Observatório de Oportunidades Ambientais
          </span>
        )}

        {pathname !== "/divulgar" && (
          <Link
            to="/divulgar"
            className="mono-caps ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-mata px-3.5 py-2 text-[11px] text-white shadow-[0_1px_2px_rgba(10,79,51,0.25)] transition-all duration-200 hover:-translate-y-px hover:bg-mata-deep hover:shadow-[0_4px_12px_-4px_rgba(10,79,51,0.45)]"
          >
            Divulgar vaga
            <span aria-hidden className="hidden sm:inline">↗</span>
          </Link>
        )}
      </div>

      {/* Mobile: tagline do observatório só na home (o contexto já aparece inline) */}
      {!contexto && (
        <div className="mx-auto max-w-[680px] px-4 pb-2 sm:hidden">
          <span className="mono-caps text-[10.5px] text-ink-soft">
            Observatório de Oportunidades Ambientais
          </span>
        </div>
      )}
    </header>
  );
}
