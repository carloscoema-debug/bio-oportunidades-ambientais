import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="mx-auto flex min-h-[64px] max-w-[680px] items-center px-4 py-3">
        <Link
          to="/"
          className="inline-flex items-baseline gap-3 rounded-sm"
          aria-label="BIO — Observatório de Oportunidades Ambientais, ir para o início"
        >
          <span
            className="font-display text-3xl leading-none text-ink"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            BIO<span className="text-mata">.</span>
          </span>
          <span className="mono-caps hidden text-[11px] text-ink-soft sm:inline">
            Observatório de Oportunidades Ambientais
          </span>
        </Link>
      </div>
      <div className="mx-auto max-w-[680px] px-4 pb-2 sm:hidden">
        <span className="mono-caps text-[10.5px] text-ink-soft">
          Observatório de Oportunidades Ambientais
        </span>
      </div>
    </header>
  );
}
