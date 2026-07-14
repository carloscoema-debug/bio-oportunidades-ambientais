import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cursoLabel } from "@/lib/glossario";

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
  area_tematica_id: string | null;
  remuneracao_bolsa: string | null;
  empresa_orgao: string | null;
  status_link: string | null;
}

const TIPOS_ORDEM = ["estagio", "emprego", "processo_seletivo", "bolsa"];

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
const STATUS_LINK_LABEL: Record<string, string> = {
  ativo: "Ativo",
  redirecionado: "Redirecionado",
  inacessivel: "Inacessível",
  nao_verificado: "Ainda não verificado",
};
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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

// Extrai valor(es) numérico(s) de um texto livre de remuneração (ex.: "R$ 2.500",
// "R$ 4.750,00", "R$ 1.500 a R$ 2.000"). Só tenta parsear se houver "R$" explícito —
// evita interpretar "A combinar", carga horária ou outro texto como valor.
// Formato BR: "." separa milhar, "," separa decimal (ex.: "2.182,34" → 2182.34).
function parseValorMonetario(s: string | null): number | null {
  if (!s || !/r\$/i.test(s)) return null;
  const brutos = s.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) ?? [];
  const parseOne = (n: string): number => {
    let limpo = n;
    if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
    return parseFloat(limpo);
  };
  // faixa ("R$ 1.500 a R$ 2.000") vira a média dos valores encontrados no texto
  const valores = brutos.map(parseOne).filter((v) => Number.isFinite(v) && v >= 50 && v <= 100000);
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

interface RemStats {
  media: number | null;
  min: number | null;
  max: number | null;
  n: number;
}
function remuneracaoStats(lista: VagaRel[]): RemStats {
  const valores = lista
    .map((v) => parseValorMonetario(v.remuneracao_bolsa))
    .filter((v): v is number => v != null);
  if (valores.length === 0) return { media: null, min: null, max: null, n: 0 };
  return {
    media: valores.reduce((a, b) => a + b, 0) / valores.length,
    min: Math.min(...valores),
    max: Math.max(...valores),
    n: valores.length,
  };
}
const fmtReais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function porMes(lista: VagaRel[]): [string, number][] {
  const m = new Map<string, number>();
  for (const v of lista) {
    if (!v.data_publicacao) continue;
    const d = new Date(v.data_publicacao);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    m.set(chave, (m.get(chave) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
function rotularMes(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MESES_ABREV[Number(mes) - 1]}/${ano}`;
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
          "tipo, setor, nivel, regiao, status, score_aderencia, data_captura, data_publicacao, contagem_cliques, count_me_candidatei, origem, curso_alvo, area_tematica_id, remuneracao_bolsa, empresa_orgao, status_link",
        );
      if (error) throw error;
      return (data ?? []) as VagaRel[];
    },
  });

  // rótulos das áreas temáticas (id → nome) para a leitura de demanda por área
  const { data: areasMap = {} } = useQuery({
    queryKey: ["relatorio_areas"],
    queryFn: async () => {
      const { data } = await supabase.from("areas_tematicas").select("id, label_display");
      const m: Record<string, string> = {};
      for (const a of (data ?? []) as { id: string; label_display: string }[]) m[a.id] = a.label_display;
      return m;
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
    // Detalhe POR CURSO: total (atende) + EXCLUSIVAS (destinadas apenas àquele curso)
    // + remuneração média (só das vagas do curso que informaram valor em R$).
    const porCursoDetalhe = [
      ...CURSOS_SUPERIOR.map((c) => [c, "superior"] as const),
      ...CURSOS_TECNICO.map((c) => [c, "tecnico"] as const),
    ].map(([codigo, nivel]) => {
      const doCurso = publicadas.filter((v) => (v.curso_alvo ?? []).includes(codigo));
      return {
        codigo,
        nivel,
        total: doCurso.length,
        exclusiva: publicadas.filter(
          (v) => (v.curso_alvo ?? []).length === 1 && v.curso_alvo![0] === codigo,
        ).length,
        rem: remuneracaoStats(doCurso),
      };
    }).sort((a, b) => b.total - a.total);

    // CURSO × TIPO (publicadas): p/ cada curso, quantas são estágio, emprego, etc.
    const cursoXtipo = [
      ...CURSOS_SUPERIOR.map((c) => [c, "superior"] as const),
      ...CURSOS_TECNICO.map((c) => [c, "tecnico"] as const),
    ].map(([codigo, nivel]) => {
      const doCurso = publicadas.filter((v) => (v.curso_alvo ?? []).includes(codigo));
      const porTipo: Record<string, number> = {};
      for (const t of TIPOS_ORDEM) porTipo[t] = doCurso.filter((v) => v.tipo === t).length;
      return { codigo, nivel, total: doCurso.length, porTipo };
    });

    // DEMANDA POR ÁREA TEMÁTICA ambiental (publicadas) — leitura de mercado por área.
    const porArea = contar(publicadas, (v) => v.area_tematica_id ?? "__sem__");
    const semArea = publicadas.filter((v) => !v.area_tematica_id).length;
    const vagasAmbos = publicadas.filter(
      (v) =>
        (v.curso_alvo ?? []).some((c) => CURSOS_SUPERIOR.includes(c)) &&
        (v.curso_alvo ?? []).some((c) => CURSOS_TECNICO.includes(c)),
    ).length;

    // Remuneração geral (só publicadas com valor em R$ informado — a maioria não informa).
    const rem = remuneracaoStats(publicadas);
    const remPorTipo = TIPOS_ORDEM.map((t) => ({
      tipo: t,
      ...remuneracaoStats(publicadas.filter((v) => v.tipo === t)),
    })).filter((e) => e.n > 0);

    // Principais empregadores (publicadas) — concentração de demanda; exclui
    // identificações genéricas que não representam um empregador real.
    const SEM_NOME = new Set(["não informado", "empresa confidencial", "confidencial", "—", ""]);
    const porEmpregador = contar(
      publicadas,
      (v) => (v.empresa_orgao && !SEM_NOME.has(v.empresa_orgao.trim().toLowerCase()) ? v.empresa_orgao.trim() : null),
    ).slice(0, 10);

    // Evolução mensal de vagas aprovadas — tendência/sazonalidade pra leitura estratégica.
    const evolucaoMensal = porMes(publicadas);

    // Saúde dos links das vagas aprovadas — quantas ainda respondem, quantas nunca
    // foram checadas, quantas já caíram (indicador operacional de curadoria).
    const porStatusLink = contar(publicadas, (v) => v.status_link ?? "nao_verificado");

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
      // Corrigido: essas quatro contagens refletem só vagas APROVADAS — antes usavam
      // `lista` (todo o período, incluindo rejeitadas), inflando os números muito
      // acima da realidade (ex.: 219 rejeitadas somadas às 22 aprovadas).
      porTipo: contar(publicadas, (v) => v.tipo),
      porRegiao: contar(publicadas, (v) => v.regiao),
      porSetor: contar(publicadas, (v) => v.setor),
      porNivel: contar(publicadas, (v) => v.nivel),
      porCursoSuperior,
      porCursoTecnico,
      porCursoDetalhe,
      cursoXtipo,
      porArea,
      semArea,
      vagasSuperior,
      vagasTecnico,
      vagasAmbos,
      rem,
      remPorTipo,
      porEmpregador,
      evolucaoMensal,
      porStatusLink,
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

      <p className="rounded-[10px] border border-line bg-surface-dim/40 px-4 py-2.5 text-[12.5px] leading-relaxed text-ink-soft">
        Salvo indicação em contrário, todos os números abaixo contam apenas{" "}
        <strong className="text-ink">vagas com status "Aprovada"</strong> — vagas
        pendentes, rejeitadas, suspensas ou expiradas não entram nessas contagens.
        A única exceção é "Aproveitamento por fonte", que compara de propósito o total
        captado (todos os status) com o que foi aprovado.
      </p>

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

      {/* Remuneração — a maioria das vagas não informa valor, então isto reflete só
          a fatia que informou; o "n" em cada card mostra o tamanho real da amostra. */}
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="mono-caps text-[11px] text-ink-faint">
            Remuneração informada · vagas aprovadas
          </p>
          <p className="mono-caps text-[10.5px] text-ink-faint">
            {r.rem.n} de {r.publicadas} vaga(s) informaram valor em R$
          </p>
        </div>
        {r.rem.n === 0 ? (
          <p className="mt-3 text-[13.5px] text-ink-soft">
            Nenhuma vaga aprovada no período informou remuneração em R$.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[12px] bg-surface-dim/50 p-3.5">
                <p className="font-display text-[24px] font-bold leading-none text-ink">
                  {fmtReais(r.rem.media!)}
                </p>
                <p className="mono-caps mt-1.5 text-[10.5px] text-ink-faint">Média</p>
              </div>
              <div className="rounded-[12px] bg-surface-dim/50 p-3.5">
                <p className="font-display text-[24px] font-bold leading-none text-ink">
                  {fmtReais(r.rem.min!)}
                </p>
                <p className="mono-caps mt-1.5 text-[10.5px] text-ink-faint">Mínima observada</p>
              </div>
              <div className="rounded-[12px] bg-surface-dim/50 p-3.5">
                <p className="font-display text-[24px] font-bold leading-none text-ink">
                  {fmtReais(r.rem.max!)}
                </p>
                <p className="mono-caps mt-1.5 text-[10.5px] text-ink-faint">Máxima observada</p>
              </div>
            </div>
            {r.remPorTipo.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-[10px] border border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-surface-dim/60 text-left">
                    <tr className="mono-caps text-[10.5px] text-ink-soft">
                      <th className="px-3 py-2 font-semibold">Por tipo</th>
                      <th className="px-3 py-2 text-right font-semibold">Média</th>
                      <th className="px-3 py-2 text-right font-semibold">n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.remPorTipo.map((e) => (
                      <tr key={e.tipo} className="border-t border-line">
                        <td className="px-3 py-2 text-ink">{TIPO_LABEL[e.tipo] ?? e.tipo}</td>
                        <td className="px-3 py-2 text-right font-bold text-mata-deep">
                          {fmtReais(e.media!)}
                        </td>
                        <td className="px-3 py-2 text-right text-ink-soft">{e.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
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

      {/* Aproveitamento por fonte — única seção que soma TODOS os status de propósito,
          pra comparar o que cada fonte trouxe com o que de fato foi aprovado. */}
      <div className="rounded-[16px] border border-line bg-surface p-5">
        <p className="mono-caps text-[11px] text-ink-faint">Aproveitamento por fonte</p>
        <p className="mt-1 text-[12px] text-ink-faint">
          "Captadas" conta todos os status (inclui rejeitadas); "Aprovadas" e "Aproveit."
          mostram o quanto disso virou vaga publicada.
        </p>
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
        <div className="mt-4 overflow-x-auto rounded-[16px] border border-line bg-surface">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="mono-caps border-b border-line text-left text-[11px] text-ink-faint">
                <th className="px-4 py-2.5">Curso</th>
                <th className="px-3 py-2.5 text-right">Vagas</th>
                <th className="px-3 py-2.5 text-right">Só este curso</th>
                <th className="px-3 py-2.5 text-right">Remun. média</th>
              </tr>
            </thead>
            <tbody>
              {r.porCursoDetalhe.map((c) => (
                <tr key={c.codigo} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">
                    {cursoLabel[c.codigo] ?? c.codigo}
                    <span className="mono-caps ml-2 text-[10px] text-ink-faint">
                      {c.nivel === "superior" ? "superior" : "técnico"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-mata-deep">{c.total}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">{c.exclusiva}</td>
                  <td className="px-3 py-2 text-right text-ink-soft">
                    {c.rem.n === 0 ? "—" : `${fmtReais(c.rem.media!)} (n=${c.rem.n})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[12px] text-ink-faint">
          "Vagas" conta toda vaga que atende o curso (uma vaga pode atender mais de um);
          "Só este curso" são as destinadas exclusivamente a ele. "Remun. média" só conta
          vagas do curso que informaram valor em R$ — amostra pequena (n), leia com cautela.
        </p>

        {/* Curso × tipo: que tipo de oportunidade (estágio/emprego/…) o mercado
            demanda por formação — insumo para ajustes estratégicos nos cursos. */}
        <p className="mono-caps mt-6 mb-2 text-[11px] text-ink-faint">
          Tipo de oportunidade por curso
        </p>
        <div className="overflow-x-auto rounded-[16px] border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="mono-caps border-b border-line text-left text-[10.5px] text-ink-faint">
                <th className="px-4 py-2.5">Curso</th>
                {TIPOS_ORDEM.map((t) => (
                  <th key={t} className="px-3 py-2.5 text-right">{TIPO_LABEL[t] ?? t}</th>
                ))}
                <th className="px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {r.cursoXtipo.map((c) => (
                <tr key={c.codigo} className="border-b border-line last:border-0">
                  <td className="px-4 py-2 text-ink">
                    {cursoLabel[c.codigo] ?? c.codigo}
                    <span className="mono-caps ml-2 text-[10px] text-ink-faint">
                      {c.nivel === "superior" ? "superior" : "técnico"}
                    </span>
                  </td>
                  {TIPOS_ORDEM.map((t) => (
                    <td key={t} className="px-3 py-2 text-right text-ink-soft">
                      {c.porTipo[t] || "—"}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-mata-deep">{c.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Demanda por ÁREA TEMÁTICA ambiental — que áreas do mercado estão contratando
          (leitura estratégica p/ ajustes nos cursos). A IA classifica a área. */}
      <div>
        <h3 className="mono-caps mb-3 text-[12px] text-ink-faint">
          Demanda por área temática · vagas publicadas
        </h3>
        <BarraLista
          titulo="Áreas ambientais que estão contratando"
          dados={r.porArea}
          rotular={(k) => (k === "__sem__" ? "Não classificada" : (areasMap[k] ?? k))}
        />
        {r.semArea > 0 && (
          <p className="mt-2 text-[12px] text-ink-faint">
            {r.semArea} vaga(s) ainda sem área definida — a IA classifica ao processar; as
            antigas podem ser ajustadas na edição.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarraLista titulo="Por tipo · vagas aprovadas" dados={r.porTipo} rotular={(k) => TIPO_LABEL[k] ?? k} />
        <BarraLista
          titulo="Por região · vagas aprovadas"
          dados={r.porRegiao}
          rotular={(k) => REGIAO_LABEL[k] ?? k}
        />
        <BarraLista
          titulo="Por setor · vagas aprovadas"
          dados={r.porSetor}
          rotular={(k) => SETOR_LABEL[k] ?? k}
        />
        <BarraLista
          titulo="Por nível · vagas aprovadas"
          dados={r.porNivel}
          rotular={(k) => NIVEL_LABEL[k] ?? k}
        />
      </div>

      {/* Principais empregadores — concentração de demanda; útil pra mapear
          parcerias e empresas que já contratam do perfil do curso. */}
      <div>
        <h3 className="mono-caps mb-3 text-[12px] text-ink-faint">
          Principais empregadores · vagas aprovadas
        </h3>
        <BarraLista
          titulo="Quem mais publicou vaga aderente ao perfil do curso"
          dados={r.porEmpregador}
          rotular={(k) => k}
        />
        <p className="mt-2 text-[12px] text-ink-faint">
          Exclui identificações genéricas ("Empresa Confidencial", "Não Informado").
        </p>
      </div>

      {/* Evolução mensal — tendência/sazonalidade de aprovação, útil pra planejar
          picos de curadoria e comparar semestres. */}
      <div>
        <h3 className="mono-caps mb-3 text-[12px] text-ink-faint">
          Evolução mensal · vagas aprovadas
        </h3>
        <BarraLista
          titulo="Vagas publicadas por mês"
          dados={r.evolucaoMensal}
          rotular={rotularMes}
        />
      </div>

      {/* Saúde dos links — indicador operacional: quantas vagas aprovadas ainda
          respondem, quantas nunca foram checadas pelo verificador automático. */}
      <div>
        <h3 className="mono-caps mb-3 text-[12px] text-ink-faint">
          Saúde dos links · vagas aprovadas
        </h3>
        <BarraLista
          titulo="Status do link de candidatura"
          dados={r.porStatusLink}
          rotular={(k) => STATUS_LINK_LABEL[k] ?? k}
        />
      </div>
    </div>
  );
}
