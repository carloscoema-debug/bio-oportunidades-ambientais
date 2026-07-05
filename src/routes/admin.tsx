import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { Dashboard } from "@/components/admin/Dashboard";
import { CadastroVaga } from "@/components/admin/CadastroVaga";
import { FilaVagas } from "@/components/admin/FilaVagas";
import { Coleta } from "@/components/admin/Coleta";
import { Newsletter } from "@/components/admin/Newsletter";
import { Parceiros } from "@/components/admin/Parceiros";
import { Relatorios } from "@/components/admin/Relatorios";

const ABAS = ["painel", "fila", "cadastrar", "coleta", "newsletter", "parceiros", "relatorios"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/admin")({
  validateSearch: (s: Record<string, unknown>): { aba?: Aba } => ({
    aba: ABAS.includes(s.aba as Aba) ? (s.aba as Aba) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Painel da coordenação — BIO" },
      { name: "description", content: "Acesso restrito à coordenação do BIO." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Marca() {
  return (
    <Link
      to="/"
      className="font-display text-2xl leading-none text-ink"
      style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
      aria-label="BIO — voltar ao portal"
    >
      BIO<span className="text-mata">.</span>
    </Link>
  );
}

function Admin() {
  const { session, user, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="mono-caps text-[12px] text-ink-faint">Carregando…</p>
      </div>
    );
  }

  if (!session) return <Login signIn={signIn} />;

  return (
    <Painel email={user?.email ?? ""} signOut={signOut} />
  );
}

function Login({
  signIn,
}: {
  signIn: (e: string, p: string) => Promise<{ error: { message: string } | null }>;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    const { error } = await signIn(email.trim(), senha);
    setEntrando(false);
    if (error) {
      setErro("E-mail ou senha incorretos.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-[64px] max-w-[520px] items-center px-4 py-3">
          <Marca />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 items-center px-4 py-12">
        <div className="w-full rounded-[16px] border border-line bg-surface p-6 shadow-[0_1px_0_var(--line)] sm:p-8">
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
              <label htmlFor="email" className="mono-caps block text-[11px] text-ink">
                E-mail institucional
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none"
                placeholder="nome@ifce.edu.br"
              />
            </div>
            <div>
              <label htmlFor="senha" className="mono-caps block text-[11px] text-ink">
                Senha
              </label>
              <input
                id="senha"
                type="password"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1.5 block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-3 text-[15px] text-ink focus:border-mata focus:outline-none"
              />
            </div>

            {erro && (
              <p className="rounded-[9px] border border-[#EBC7BE] bg-barro-tint px-3 py-2 text-[13px] text-barro">
                {erro}
              </p>
            )}

            <button
              type="submit"
              disabled={entrando}
              className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center rounded-[9px] bg-mata px-4 text-[15px] font-semibold text-white transition-colors hover:bg-mata-deep disabled:opacity-60"
            >
              {entrando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function Painel({ email, signOut }: { email: string; signOut: () => void }) {
  const { aba: abaUrl } = Route.useSearch();
  const [aba, setAba] = useState<Aba>(abaUrl ?? "painel");

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex min-h-[64px] max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Marca />
            <span className="mono-caps text-[11px] text-ink-faint">
              Painel da coordenação
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[13px] text-ink-soft sm:inline">
              {email}
            </span>
            <button
              onClick={signOut}
              className="mono-caps rounded-full border border-line-strong px-3 py-1.5 text-[11px] text-ink-soft hover:border-barro hover:text-barro"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {(
            [
              ["painel", "Painel"],
              ["fila", "Fila de curadoria"],
              ["cadastrar", "Cadastrar vaga"],
              ["coleta", "Coleta"],
              ["newsletter", "Newsletter"],
              ["parceiros", "Parceiros"],
              ["relatorios", "Relatórios"],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setAba(v)}
              className={`rounded-full px-4 py-2 text-[14px] font-bold transition-colors ${
                aba === v
                  ? "bg-ink text-paper"
                  : "border border-line-strong bg-surface text-ink-soft hover:border-mata"
              }`}
            >
              {l}
            </button>
          ))}
        </div>

        {aba === "painel" && <Dashboard onIrParaFila={() => setAba("fila")} />}
        {aba === "fila" && <FilaVagas />}
        {aba === "cadastrar" && <CadastroVaga />}
        {aba === "coleta" && <Coleta />}
        {aba === "newsletter" && <Newsletter />}
        {aba === "parceiros" && <Parceiros />}
        {aba === "relatorios" && <Relatorios />}
      </main>
    </div>
  );
}
