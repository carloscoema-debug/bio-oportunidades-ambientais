import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/relatorio")({
  head: () => ({
    meta: [
      { title: "Relatório semestral — BIO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RelatorioSemestral,
});

const TIPO_LABEL: Record<string, string> = {
  estagio: "Estágio", emprego: "Emprego", processo_seletivo: "Processo seletivo", bolsa: "Bolsa",
};
const REGIAO_LABEL: Record<string, string> = {
  rmf: "Fortaleza + RMF", interior_ceara: "Interior do Ceará", fora_ceara: "Fora do Ceará", indefinido: "Indefinido",
};

interface VagaR {
  tipo: string; nivel: string; regiao: string; status: string; origem: string | null;
  score_aderencia: number; data_captura: string; data_publicacao: string | null;
  contagem_cliques: number; count_me_candidatei: number;
}

function periodoSemestre(chave: string): { inicio: Date; fim: Date; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const semAtual = now.getMonth() < 6 ? 1 : 2;
  let ano = y, sem = semAtual;
  if (chave === "anterior") {
    if (semAtual === 1) { ano = y - 1; sem = 2; } else { sem = 1; }
  }
  const inicio = new Date(ano, sem === 1 ? 0 : 6, 1);
  const fim = new Date(ano, sem === 1 ? 6 : 12, 1);
  return { inicio, fim, label: `${sem}º semestre de ${ano}` };
}

function conta(lista: VagaR[], chave: (v: VagaR) => string | null): [string, number][] {
  const m = new Map<string, number>();
  for (const v of lista) {
    const k = chave(v);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function RelatorioSemestral() {
  const { session, loading } = useAuth();
  const [semestre, setSemestre] = useState<"atual" | "anterior" | "tudo">("atual");

  const { data: vagas } = useQuery({
    queryKey: ["rel_pdf_vagas"],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("vagas")
        .select("tipo, nivel, regiao, status, origem, score_aderencia, data_captura, data_publicacao, contagem_cliques, count_me_candidatei");
      return (data ?? []) as VagaR[];
    },
  });
  const { data: insercoes } = useQuery({
    queryKey: ["rel_pdf_insercoes"],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase.from("insercoes_profissionais").select("created_at");
      return (data ?? []) as { created_at: string }[];
    },
  });

  const per = useMemo(() => periodoSemestre(semestre), [semestre]);

  const r = useMemo(() => {
    const dentro = (iso: string | null) => {
      if (semestre === "tudo") return true;
      if (!iso) return false;
      const d = new Date(iso);
      return d >= per.inicio && d < per.fim;
    };
    const lista = (vagas ?? []).filter((v) => dentro(v.data_captura));
    const publicadas = lista.filter((v) => v.status === "aprovada");
    const rejeitadas = lista.filter((v) => v.status === "rejeitada");
    const decididas = publicadas.length + rejeitadas.length;
    const taxaAprov = decididas ? Math.round((publicadas.length / decididas) * 100) : 0;
    const scoreMedio = publicadas.length
      ? Math.round(publicadas.reduce((s, v) => s + v.score_aderencia, 0) / publicadas.length) : 0;
    const tecnicas = publicadas.filter((v) => v.nivel === "tecnico" || v.nivel === "ambos").length;
    const propTecnica = publicadas.length ? Math.round((tecnicas / publicadas.length) * 100) : 0;
    const cliques = publicadas.reduce((s, v) => s + (v.contagem_cliques ?? 0), 0);
    const candidaturas = publicadas.reduce((s, v) => s + (v.count_me_candidatei ?? 0), 0);
    const insercoesN = (insercoes ?? []).filter((i) => dentro(i.created_at)).length;

    const om = new Map<string, { total: number; aprov: number }>();
    for (const v of lista) {
      const o = v.origem ?? "—";
      const e = om.get(o) ?? { total: 0, aprov: 0 };
      e.total++; if (v.status === "aprovada") e.aprov++;
      om.set(o, e);
    }
    const aproveitamento = [...om.entries()]
      .map(([origem, { total, aprov }]) => ({ origem, total, aprov, pct: total ? Math.round(aprov / total * 100) : 0 }))
      .sort((a, b) => b.total - a.total);

    return {
      total: lista.length, publicadas: publicadas.length, taxaAprov, scoreMedio, propTecnica,
      cliques, candidaturas, insercoes: insercoesN,
      porTipo: conta(lista, (v) => v.tipo), porRegiao: conta(lista, (v) => v.regiao), aproveitamento,
    };
  }, [vagas, insercoes, semestre, per]);

  if (loading) return <div className="p-10 text-center text-ink-soft">Carregando…</div>;
  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="text-[14px] text-ink-soft">
          Acesso restrito. <a href="/admin" className="text-mata-deep underline">Entrar no painel</a>.
        </p>
      </div>
    );
  }

  const Secao = ({ titulo, dados, rot }: { titulo: string; dados: [string, number][]; rot: (k: string) => string }) => (
    <div>
      <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#0D6B44]">{titulo}</h3>
      <table className="w-full border-collapse text-[12.5px]">
        <tbody>
          {dados.map(([k, n]) => (
            <tr key={k} className="border-b border-[#E7E1D3]">
              <td className="py-1.5 text-[#1B2A21]">{rot(k)}</td>
              <td className="py-1.5 text-right font-semibold text-[#1B2A21]">{n}</td>
            </tr>
          ))}
          {dados.length === 0 && <tr><td className="py-1.5 text-ink-soft">Sem dados.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0EEE6] py-8 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 1.6cm; } @media print { .no-print { display:none !important; } }`}</style>

      {/* controles (não imprimem) */}
      <div className="no-print mx-auto mb-4 flex max-w-[794px] flex-wrap items-center justify-between gap-3 px-4">
        <div className="flex gap-2">
          {([["atual", "Semestre atual"], ["anterior", "Semestre anterior"], ["tudo", "Todo o período"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => setSemestre(v)}
              className={`mono-caps rounded-full border-[1.5px] px-3 py-1.5 text-[12px] ${semestre === v ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-soft hover:border-mata"}`}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => window.print()}
          className="rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep">
          Salvar como PDF ↓
        </button>
      </div>

      {/* folha A4 */}
      <div className="mx-auto max-w-[794px] bg-white p-12 shadow-[0_2px_20px_rgba(0,0,0,0.08)] print:max-w-none print:p-0 print:shadow-none"
        style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
        <header className="mb-6 border-b-2 border-[#0D6B44] pb-4">
          <p className="text-[26px] font-extrabold leading-none text-[#0D6B44]">BIO<span className="text-[#B97A1B]">.</span></p>
          <h1 className="mt-2 text-[20px] font-bold text-[#1B2A21]">Relatório Semestral de Oportunidades</h1>
          <p className="mt-1 text-[13px] text-[#5B6B60]">
            {semestre === "tudo" ? "Todo o período" : per.label} · Curso Técnico em Meio Ambiente (EaD) — IFCE Campus Fortaleza
          </p>
          <p className="mt-0.5 text-[11px] text-[#8A968C]">
            Gerado em {format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </header>

        <section className="mb-6">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#0D6B44]">Indicadores</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { n: r.publicadas, l: "Vagas publicadas" },
              { n: `${r.taxaAprov}%`, l: "Taxa de aprovação" },
              { n: r.scoreMedio, l: "Score médio" },
              { n: `${r.propTecnica}%`, l: "Nível técnico" },
            ].map((e, i) => (
              <div key={i} className="rounded-[8px] border border-[#E7E1D3] p-3">
                <p className="text-[24px] font-bold leading-none text-[#1B2A21]">{e.n}</p>
                <p className="mt-1 text-[10.5px] text-[#5B6B60]">{e.l}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#0D6B44]">Funil de engajamento</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              { n: r.publicadas, l: "Publicadas" }, { n: r.cliques, l: "Cliques" },
              { n: r.candidaturas, l: "Candidaturas" }, { n: r.insercoes, l: "Inserções" },
            ].map((e, i) => (
              <div key={i} className="rounded-[8px] bg-[#EAF3EE] p-3">
                <p className="text-[24px] font-bold leading-none text-[#0D6B44]">{e.n}</p>
                <p className="mt-1 text-[10.5px] text-[#5B6B60]">{e.l}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 grid grid-cols-2 gap-8">
          <Secao titulo="Por tipo" dados={r.porTipo} rot={(k) => TIPO_LABEL[k] ?? k} />
          <Secao titulo="Por região" dados={r.porRegiao} rot={(k) => REGIAO_LABEL[k] ?? k} />
        </section>

        <section className="mb-2">
          <h3 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-[#0D6B44]">Aproveitamento por fonte</h3>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b-2 border-[#E7E1D3] text-left text-[#5B6B60]">
                <th className="py-1.5 font-semibold">Fonte / origem</th>
                <th className="py-1.5 text-right font-semibold">Captadas</th>
                <th className="py-1.5 text-right font-semibold">Aprovadas</th>
                <th className="py-1.5 text-right font-semibold">%</th>
              </tr>
            </thead>
            <tbody>
              {r.aproveitamento.map((a) => (
                <tr key={a.origem} className="border-b border-[#E7E1D3]">
                  <td className="py-1.5 text-[#1B2A21]">{a.origem}</td>
                  <td className="py-1.5 text-right text-[#5B6B60]">{a.total}</td>
                  <td className="py-1.5 text-right text-[#5B6B60]">{a.aprov}</td>
                  <td className="py-1.5 text-right font-bold text-[#0D6B44]">{a.pct}%</td>
                </tr>
              ))}
              {r.aproveitamento.length === 0 && <tr><td className="py-1.5 text-ink-soft">Sem dados.</td></tr>}
            </tbody>
          </table>
        </section>

        <footer className="mt-8 border-t border-[#E7E1D3] pt-3 text-[10px] text-[#8A968C]">
          BIO — Observatório Institucional de Oportunidades Ambientais · Documento gerado automaticamente para o PPC e avaliações do curso.
        </footer>
      </div>
    </div>
  );
}
