import { Link } from "@tanstack/react-router";

/**
 * Link padrão "voltar ao portal" no rodapé das páginas de conteúdo
 * (/divulgar, /como-se-candidatar, /política). Mantém a navegação consistente.
 */
export function VoltarPortal() {
  return (
    <div className="mt-10 border-t border-line pt-6">
      <Link
        to="/"
        className="group mono-caps inline-flex items-center gap-2 text-[12px] text-mata-deep underline decoration-transparent underline-offset-4 transition-colors hover:decoration-mata"
      >
        <span
          aria-hidden
          className="transition-transform duration-200 group-hover:-translate-x-0.5"
        >
          ←
        </span>
        Voltar às vagas
      </Link>
    </div>
  );
}
