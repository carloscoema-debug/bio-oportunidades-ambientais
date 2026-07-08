import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cursoLabelCurto } from "@/lib/glossario";

interface VagaRel {
  tipo: string;
  setor: string | null;
  nivel: string;
  regiao: string;
  status: string;
  score_aderencia: number;
  data_captura: string;
  data_publicacao: string | null;
  contagem_cliques: number;
  count_me_candidatei: number;
  origem: string | null;
  curso_alvo: string[] | null;
}

// Cursos do BIO por nível (para a leitura de mercado por formação).
const CURSOS_SUPERIOR = ["gestao_ambiental", "engenharia_sanitaria_ambiental", "saneamento_ambiental"];
const CURSOS_TECNICO = ["tecnico_meio_ambiente", "tecnico_saneamento"];

// Conta ocorrências de cada curso em curso_alvo (uma vaga pode atender vários cursos,
// então soma para cada um). Restringe aos códigos informados.
function contarCursos(lista: VagaRel[], codigos: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const c of codigos) m.set(c, 0);
  for (const v of lista) {
    for (const c of v.curso_alvo ?? []) {
      if (m.has(c)) m.set(c, (m.get(c) ?? 0) + 1);
    }
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
// Quantas VAGAS atendem ao menos um curso do grupo (nível), sem contar em dobro.
const vagasComCurso = (lista: VagaRel[], codigos: string[]) =>
  lista.filter((v) => (v.curso_alvo ?? []).some((c) => codigos.includes(c))).length;

const TIPO_LABEL: Record<string, string> = {
  estagio: "Estágio",
  emprego: "Emprego",
  processo_seletivo: "Processo seletivo",
  bolsa: "Bolsa",
};
const SETOR_LABEL: Record<string, string> = { publico: "Público", privado: "Privado" };
const NIVEL_LABEL: Record<string, string> = {
  tecnico: "Técnico",
  superior: "Superior",
  ambos: "Técnico ou superior",
};
const REGIAO_LABEL: Record<string, string> = {
  rmf: "Fortaleza + RMF",
  interior_ceara: "Interior do Ceará",
  fora_ceara: "Fora do Ceará",
  indefinido: "Indefinido",
};

function contar(lista: VagaRel[], chave: (v: VagaRel) => string | null) {
  const m = new Map<string, number>();
  for (const v of lista) {
    const k = chave(v);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function KPI({ rotulo, valor, sub }: { rotulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-5">
      <p className="mono-caps text-[11px] text-ink-faint">{rotulo}</p>
      <p className="mt-2 font-display text-[30px] font-bold leading-none text-ink">
        {valor}
      </p>
      {sub && <p className="mt-1 text-[12.5px] text-ink-soft">{sub}</p>}
    </div>
  );
}

function BarraLista({
  titulo,
  dados,
  rotular,
}: {
  titulo: string;
  dados: [string, number][];
  rotular: (k: string) => string;
}) {
  const max = Math.max(1, ...dados.map(([, n]) => n));
  return (
    <div className="rounded-[16px] border border-line bg-surface p-5">
      <p className="mono-caps text-[11px] text-ink-faint">{titulo}</p>
      <ul className="mt-3 space-y-2.5">
        {dados.length === 0 && (
          <li className="text-[13px] text-ink-soft">Sem dados no período.</li>
        )}
        {dados.map(([k, n]) => (
          <li key={k}>
            <div className="flex items-baseline justify-between text-[13.5px]">
              <span className="text-ink">{rotular(k)}</span>
              <span className="mono-caps text-[12px] text-ink-soft">{n}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-dim">
              <div
                className="h-full rounded-full bg-mata"
                style={{ width: `${(n / max) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const CSV_COLS = [
  "titulo", "empresa_orgao", "tipo", "nivel", "regiao", "municipio", "status",
  "origem", "score_aderencia", "contagem_cliques", "count_me_candidatei",
  "link_candidatura", "data_captura", "data_publicacao",
] as const;

function celulaCsv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function Relatorios() {
  const [periodo, setPeriodo] = useState<"30" | "90" | "tudo">("tudo");
  const [exportando, setExportando] = useState(false);

  async function exportarCSV() {
    setExportando(true);
    const { data } = await supabase
      .from("vagas")
      .select(CSV_COLS.join(", "))
      .order("data_captura", { ascending: false });
    setExportando(false);
    const rows = ((data ?? []) as unknown) as Record<string, unknown>[];
    const linhas = [
      CSV_COLS.join(";"),
      ...rows.map((r) => CSV_COLS.map((c) => celulaCsv(r[c])).join(";")),
    ];
    const blob = new Blob(["﻿" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bio-vagas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const { data: todas, isLoading } = useQuery({
    queryKey: ["relatorio_vagas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select(
          "tipo, setor, nivel, regiao, status, score_aderencia, data_captura, data_publicacao, contagem_cliques, count_me_candidatei, origem, curso_alvo",
        );
      if (error) throw error;
      return (data ?? []) as VagaRel[];
    },
  });

  const { data: totalInsercoes } = useQuery({
    queryKey: ["relatorio_insercoes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("insercoes_profissionais")
        .select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const r = useMemo(() => {
    const lista = (todas ?? []).filter((v) => {
      if (periodo === "tudo") return true;
      const dias = (Date.now() - new Date(v.data_captura).getTime()) / 86400000;
      return dias <= Number(periodo);
    });

    const publicadas = lista.filter((v) => v.status === "aprovada");
    const rejeitadas = lista.filter((v) => v.status === "rejeitada");
    const decididas = publicadas.length + rejeitadas.length;
    const taxaAprov = decididas ? Math.round((publicadas.length / decididas) * 100) : 0;

    const scoreMedio = publicadas.length
      ? Math.round(
          publicadas.reduce((s, v) => s + v.score_aderencia, 0) / publicadas.length,
        )
      : 0;

    const comPub = publicadas.filter((v) => v.data_publicacao);
    const tempoMedio = comPub.length
      ? comPub.reduce(
          (s, v) =>
            s +
            (new Date(v.data_publicacao!).getTime() -
              new Date(v.data_captura).getTime()) /
              86400000,
          0,
        ) / comPub.length
      : null;

    const tecnicas = publicadas.filter(
      (v) => v.nivel === "tecnico" || v.nivel === "ambos",
    ).length;
    const propTecnica = publicadas.length
      ? Math.round((tecnicas / publicadas.length) * 100)
      : 0;

    // funil: publicadas → cliques → candidaturas marcadas
    const totalCliques = publicadas.reduce((s, v) => s + (v.contagem_cliques ?? 0), 0);
    const totalCandidaturas = publicadas.reduce((s, v) => s + (v.count_me_candidatei ?? 0), 0);

    // aproveitamento por origem/fonte (aprovadas ÷ total captado)
    const om = new Map<string, { total: number; aprovadas: number }>();
    for (const v of lista) {
      const o = v.origem ?? "—";
      const e = om.get(o) ?? { total: 0, aprovadas: 0 };
      e.total++;
      if (v.status === "aprovada") e.aprovadas++;
      om.set(o, e);
    }
    const aproveitamento = [...om.entries()]
      .map(([origem, { total, aprovadas }]) => ({
        origem, total, aprovadas,
        pct: total ? Math.round((aprovadas / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Leitura de mercado por FORMAÇÃO (só publicadas): quantas vagas por curso e
    // como se dividem entre superior e técnico.
    const porCursoSuperior = contarCursos(publicadas, CURSOS_SUPERIOR);
    const porCursoTecnico = contarCursos(publicadas, CURSOS_TECNICO);
    const vagasSuperior = vagasComCurso(publicadas, CURSOS_SUPERIOR);
    const vagasTecnico = vagasComCurso(publicadas, CURSOS_TECNICO);
    const vagasAmbos = publicadas.filter(
      (v) =>
        (v.curso_alvo ?? []).some((c) => CURSOS_SUPERIOR.includes(c)) &&
        (v.curso_alvo ?? []).some((c) => CURSOS_TECNICO.includes(c)),
    ).length;

    return {
      totalCliques,
      totalCandidaturas,
      aproveitamento,
      total: lista.length,
      publicadas: publicadas.length,
      pendentes: lista.filter((v) => v.status === "pendente").length,
      taxaAprov,
      scoreMedio,
      tempoMedio,
      propTecnica,
      porTipo: contar(lista, (v) => v.tipo),
      porRegiao: contar(lista, (v) => v.regiao),
      porSetor: contar(lista, (v) => v.setor),
      porNivel: contar(lista, (v) => v.nivel),
      porCursoSuperior,
      porCursoTecnico,
      vagasSuperior,
      vagasTecnico,
      vagasAmbos,
    };
  }, [todas, periodo]);

  if (isLoading) return <p className="text-[14px] text-ink-soft">Carregando…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        {(
          [
            ["tudo", "Todo o período"],
            ["90", "Últimos 90 dias"],
            ["30", "Últimos 30 dias"],
          ] as const
        ).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setPeriodo(v)}
            className={`mono-caps rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] tracking-normal transition-colors ${
              periodo === v
                ? "border-ink bg-ink text-paper"
                : "border-line-strong bg-surface text-ink-soft hover:border-mata"
            }`}
          >
            {l}
          </button>
        ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportarCSV}
            disabled={exportando}
            className="mono-caps rounded-full border-[1.5px] border-line-strong bg-surface px-3.5 py-1.5 text-[12px] text-ink-soft hover:border-mata hover:text-mata disabled:opacity-60"
          >
            {exportando ? "Exportando…" : "Exportar CSV ↓"}
          </button>
          <a
            href="/relatorio"
            target="_blank"
            rel="noopener noreferrer"
            className="mono-caps rounded-full border-[1.5px] border-mata bg-mata-tint px-3.5 py-1.5 text-[12px] text-mata-deep hover:bg-mata hover:text-white"
          >
            Gerar PDF semestral ↗
          </a>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          rotulo="Vagas publicadas"
          valor={String(r.publicadas)}
          sub={`${r.total} no total · ${r.pendentes} pendentes`}
        />
        <KPI
          rotulo="Taxa de aprovação"
          valor={`${r.taxaAprov}%`}
          sub="das vagas decididas (aprovadas + rejeitadas)"
        />
        <KPI
          rotulo="Score médio (publicadas)"
          valor={String(r.scoreMedio)}
          sub="aderência ao Técnico em MA"
        />
        <KPI
          rotulo="Tempo médio até publicar"
          valor={r.tempoMedio == null ? "—" : `${r.tempoMedio.toFixed(1)} d`}
          sub="da captura à publicação"
        />
      </div>

      <div className="rounded-[16px] border border-mata-line bg-mata-tint p-5">
        <p className="mono-caps text-[11px] text-mata-deep">
          Proporção de vagas de nível técnico (publicadas)
        </p>
        <p className="mt-2 font-display text-[30px] font-bold text-mata-deep">
          {r.propTecnica}%
        </p>
        <p className="mt-1 text-[12.5px] text-mata-deep/80">
          Meta institucional: ≥ 50% do total publicado.
        </p>
      </div>

      {/* Funil de engajamento */}
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <p className="mono-caps text-[11px] text-ink-faint">
          Funil de engajamento (vagas publicadas no período)
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { n: r.publicadas, l: "Vagas publicadas", sub: "no portal" },
            {
              n: r.totalCliques, l: "Cliques em candidatar",
              sub: r.publicadas ? `${(r.totalCliques / r.publicadas).toFixed(1)} por vaga` : "—",
            },
            {
              n: r.totalCandidaturas, l: "“Me candidatei”",
              sub: r.totalCliques ? `${Math.round((r.totalCandidaturas / r.totalCliques) * 100)}% dos cliques` : "—",
            },
            { n: totalInsercoes ?? 0, l: "Inserções registradas", sub: "egressos (F4-02)" },
          ].map((e, i) => (
            <div key={i} className="rounded-[12px] bg-surface-dim/50 p-3.5">
              <p className="font-display text-[26px] font-bold leading-none text-ink">{e.n}</p>
              <p className="mt-1.5 text-[12.5px] font-semibold text-ink">{e.l}</p>
              <p className="mono-caps text-[10.5px] text-ink-faint">{e.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Aproveitamento por fonte */}
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <p className="mono-caps text-[11px] text-ink-faint">Aproveitamento por fonte</p>
        <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead className="bg-surface-dim/60 text-left">
              <tr className="mono-caps text-[10.5px] text-ink-soft">
                <th className="px-3 py-2 font-semibold">Fonte / origem</th>
                <th className="px-3 py-2 text-right font-semibold">Captadas</th>
                <th className="px-3 py-2 text-right font-semibold">Aprovadas</th>
                <th className="px-3 py-2 text-right font-semibold">Aproveit.</th>
              </tr>
            </thead>
            <tbody>
              {r.aproveitamento.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-3 text-ink-soft">Sem dados no período.</td></tr>
              )}
              {r.aproveitamento.map((a) => (
                <tr key={a.origem} className="border-t border-line">
                  <td className="px-3 py-2 text-ink">{a.origem}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{a.total}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{a.aprovadas}</td>
                  <td className="px-3 py-2 text-right font-bold text-mata-deep">{a.pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Perfil de mercado por FORMAÇÃO — como as vagas se distribuem entre os
          cursos do BIO e entre nível superior e técnico (visão estratégica). */}
      <div>
        <h3 className="mono-caps mb-3 text-[12px] text-ink-faint">
          Perfil de mercado por formação · vagas publicadas
        </h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <KPI
            rotulo="Vagas p/ nível superior"
            valor={String(r.vagasSuperior)}
            sub={r.publicadas ? `${Math.round((r.vagasSuperior / r.publicadas) * 100)}% das publicadas` : "—"}
          />
          <KPI
            rotulo="Vagas p/ nível técnico"
            valor={String(r.vagasTecnico)}
            sub={r.publicadas ? `${Math.round((r.vagasTecnico / r.publicadas) * 100)}% das publicadas` : "—"}
          />
          <KPI
            rotulo="Servem aos dois níveis"
            valor={String(r.vagasAmbos)}
            sub="atendem superior E técnico"
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <BarraLista
            titulo="Por curso · Superior"
            dados={r.porCursoSuperior}
            rotular={(k) => cursoLabelCurto[k] ?? k}
          />
          <BarraLista
            titulo="Por curso · Técnico"
            dados={r.porCursoTecnico}
            rotular={(k) => cursoLabelCurto[k] ?? k}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarraLista titulo="Por tipo" dados={r.porTipo} rotular={(k) => TIPO_LABEL[k] ?? k} />
        <BarraLista
          titulo="Por região"
          dados={r.porRegiao}
          rotular={(k) => REGIAO_LABEL[k] ?? k}
        />
        <BarraLista
          titulo="Por setor"
          dados={r.porSetor}
          rotular={(k) => SETOR_LABEL[k] ?? k}
        />
        <BarraLista
          titulo="Por nível"
          dados={r.porNivel}
          rotular={(k) => NIVEL_LABEL[k] ?? k}
        />
      </div>
    </div>
  );
}
