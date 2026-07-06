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
          className="inline-flex items-baseline rounded-sm"
          aria-label="BIO — ir para o início do portal"
        >
          <span
            className="font-display text-3xl leading-none text-ink"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            BIO<span className="text-mata">.</span>
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
