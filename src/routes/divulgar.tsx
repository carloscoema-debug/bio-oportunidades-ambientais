import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SiteLayout } from "../components/layout/SiteLayout";
import { VoltarPortal } from "../components/layout/VoltarPortal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/divulgar")({
  head: () => ({
    meta: [
      { title: "Divulgue uma oportunidade — BIO" },
      {
        name: "description",
        content:
          "Empresas e órgãos podem enviar vagas de estágio e emprego na área ambiental. Toda vaga passa por curadoria antes de ser publicada.",
      },
    ],
  }),
  component: Divulgar,
});

const TIPOS = [
  ["estagio", "Estágio"],
  ["emprego", "Emprego"],
  ["processo_seletivo", "Processo seletivo / edital"],
  ["bolsa", "Bolsa"],
] as const;
const REGIOES = [
  ["rmf", "Região Metropolitana de Fortaleza"],
  ["interior_ceara", "Interior do Ceará"],
  ["fora_ceara", "Fora do Ceará"],
  ["indefinido", "A confirmar / não sei"],
] as const;

const MOTIVOS: Record<string, string> = {
  titulo_curto: "Descreva melhor o título da vaga.",
  tipo_invalido: "Escolha o tipo da vaga.",
  email_invalido: "Confira o e-mail de contato.",
  sem_forma_candidatura: "Informe um link ou uma forma de candidatura.",
  limite_excedido: "Você atingiu o limite de envios por hora. Tente mais tarde.",
};

function Campo({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mono-caps block text-[11px] text-ink">{label}</span>
      {hint && <span className="mt-0.5 block text-[12px] text-ink-faint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputCls =
  "block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none";

function Divulgar() {
  const [form, setForm] = useState({
    titulo: "", tipo: "estagio", empresa_orgao: "", regiao: "rmf",
    descricao: "", link_candidatura: "", forma_candidatura: "",
    contato_nome: "", contato_email: "", website: "",
  });
  const [aceite, setAceite] = useState(false);
  const [estado, setEstado] = useState<"idle" | "enviando" | "ok" | "erro">("idle");
  const [msg, setMsg] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aceite) return;
    setEstado("enviando");
    setMsg("");
    const { data, error } = await supabase.functions.invoke("submeter-vaga", { body: form });
    const r = data as { ok?: boolean; motivo?: string } | null;
    if (error || !r?.ok) {
      setEstado("erro");
      setMsg(MOTIVOS[r?.motivo ?? ""] ?? "Não foi possível enviar agora. Tente novamente.");
      return;
    }
    setEstado("ok");
  }

  if (estado === "ok") {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-[540px] py-14">
          <div className="overflow-hidden rounded-[20px] border border-mata-line bg-mata-tint p-8 text-center shadow-[var(--shadow-card)] sm:p-10">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-mata text-[22px] text-white shadow-[0_6px_16px_-6px_rgba(10,79,51,0.5)]" aria-hidden>
              ✓
            </span>
            <p className="mono-caps mt-4 text-[11px] text-mata-deep">Oportunidade recebida</p>
            <h1 className="mt-1.5 font-display text-[25px] font-bold leading-tight text-ink" style={{ letterSpacing: "-0.02em" }}>
              Obrigado! Já está com a coordenação.
            </h1>
            <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-relaxed text-ink-soft">
              Toda vaga passa pela <strong className="text-ink">curadoria</strong> antes de ir ao ar.
              Se faltar algum detalhe, falamos com você pelo e-mail informado.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <a href="/" className="mono-caps inline-flex items-center gap-1.5 rounded-full bg-mata px-5 py-2.5 text-[12px] text-white transition-colors hover:bg-mata-deep">
                Ver as vagas do portal ↗
              </a>
              <a
                href="https://portal.ifce.edu.br/cursos/fortaleza-tecnico-subsequente-meio-ambiente/"
                target="_blank"
                rel="noopener noreferrer"
                className="mono-caps inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-mata-line bg-surface px-5 py-2.5 text-[12px] text-mata-deep transition-colors hover:border-mata hover:bg-mata-tint"
              >
                Conheça o curso técnico ↗
              </a>
            </div>
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
              O BIO é mantido pelo Curso Técnico em Meio Ambiente do IFCE — formando
              profissionais para a área que você contrata.
            </p>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <section className="mx-auto max-w-[620px] py-8">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          Para empresas e órgãos
        </p>
        <h1 className="mt-3 font-display text-[30px] font-bold leading-[1.08] text-ink" style={{ letterSpacing: "-0.025em" }}>
          Divulgue uma oportunidade
        </h1>
        <p className="mt-3 max-w-[58ch] text-[15.5px] leading-relaxed text-ink-soft">
          O BIO é o observatório de oportunidades ambientais do IFCE Campus Fortaleza, com uma
          base de estudantes e egressos do Curso Técnico em Meio Ambiente. Tem uma vaga na área?
          Envie abaixo — toda oportunidade passa pela{" "}
          <strong className="text-ink">curadoria da coordenação</strong> antes de aparecer no
          portal. Nada é publicado automaticamente.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-[20px] border border-line bg-surface p-6 shadow-[var(--shadow-card)] sm:p-8">
          <Campo label="Título da vaga *">
            <input required value={form.titulo} onChange={(e) => set("titulo", e.target.value)}
              placeholder="Ex.: Estágio em Educação Ambiental" className={inputCls} />
          </Campo>

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="Tipo *">
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={inputCls}>
                {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Campo>
            <Campo label="Região">
              <select value={form.regiao} onChange={(e) => set("regiao", e.target.value)} className={inputCls}>
                {REGIOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </Campo>
          </div>

          <Campo label="Empresa / órgão">
            <input value={form.empresa_orgao} onChange={(e) => set("empresa_orgao", e.target.value)}
              placeholder="Nome da instituição" className={inputCls} />
          </Campo>

          <Campo label="Descrição" hint="Atividades, requisitos, prazo, bolsa/salário…">
            <textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)}
              rows={4} className={inputCls} />
          </Campo>

          <Campo label="Link de candidatura" hint="Página da vaga ou formulário de inscrição">
            <input type="url" value={form.link_candidatura} onChange={(e) => set("link_candidatura", e.target.value)}
              placeholder="https://…" className={inputCls} />
          </Campo>
          <Campo label="…ou forma de candidatura" hint="Se não houver link — ex.: enviar CV para e-mail X">
            <input value={form.forma_candidatura} onChange={(e) => set("forma_candidatura", e.target.value)}
              placeholder="Ex.: enviar currículo para rh@empresa.org" className={inputCls} />
          </Campo>

          <div className="grid gap-5 sm:grid-cols-2">
            <Campo label="Seu nome">
              <input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)}
                className={inputCls} />
            </Campo>
            <Campo label="Seu e-mail *" hint="Para contato da coordenação">
              <input type="email" required value={form.contato_email}
                onChange={(e) => set("contato_email", e.target.value)}
                placeholder="voce@empresa.org" className={inputCls} />
            </Campo>
          </div>

          {/* honeypot */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
            value={form.website} onChange={(e) => set("website", e.target.value)}
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }} />

          <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
            <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6B44]" />
            <span>
              Declaro que as informações são verídicas e autorizo a coordenação a usar meus dados de
              contato para validar esta oportunidade, conforme a{" "}
              <a href="/politica-de-privacidade" className="text-mata-deep underline">
                política de privacidade
              </a>.
            </span>
          </label>

          {estado === "erro" && <p className="text-[13px] text-barro">{msg}</p>}

          <button type="submit" disabled={estado === "enviando" || !aceite}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-[11px] bg-mata px-6 text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(10,79,51,0.25)] transition-all duration-200 hover:-translate-y-px hover:bg-mata-deep hover:shadow-[0_4px_14px_-4px_rgba(10,79,51,0.4)] disabled:pointer-events-none disabled:opacity-50 sm:w-auto">
            {estado === "enviando" ? "Enviando…" : <>Enviar oportunidade <span aria-hidden>↗</span></>}
          </button>
        </form>

        <VoltarPortal />
      </section>
    </SiteLayout>
  );
}
