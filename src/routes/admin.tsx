import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel da coordenação — BIO" },
      { name: "description", content: "Acesso restrito à coordenação do BIO." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Autenticação será configurada na próxima etapa.
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-[64px] max-w-[520px] items-center px-4 py-3">
          <Link
            to="/"
            className="font-display text-2xl leading-none text-ink"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
            aria-label="BIO — voltar ao portal"
          >
            BIO<span className="text-mata">.</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 items-center px-4 py-12">
        <div className="w-full rounded-[var(--radius)] border border-line bg-surface p-6 sm:p-8 shadow-[0_1px_0_var(--line)]">
          <p className="mono-caps text-[11px] text-ink-faint">Acesso restrito</p>
          <h1
            className="mt-2 font-display text-ink"
            style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            Painel da coordenação
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            Área destinada à equipe curadora do BIO.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mono-caps block text-[11px] text-ink"
              >
                E-mail institucional
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-mata"
                placeholder="nome@ifce.edu.br"
              />
            </div>
            <div>
              <label
                htmlFor="senha"
                className="mono-caps block text-[11px] text-ink"
              >
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1.5 block w-full rounded-[var(--radius-sm)] border border-line-strong bg-surface px-3 py-3 text-[15px] text-ink focus:border-mata"
              />
            </div>

            <button
              type="submit"
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-[var(--radius-sm)] bg-mata px-4 text-[15px] font-semibold text-white transition-colors hover:bg-mata-deep"
            >
              Entrar
            </button>
          </form>

          <p className="mono-caps mt-6 text-[10.5px] text-ink-faint">
            Autenticação será configurada na próxima etapa
          </p>
        </div>
      </main>
    </div>
  );
}
