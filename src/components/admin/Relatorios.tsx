import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VagaRel {
  tipo: string;
  setor: string | null;
  nivel: string;
  regiao: string;
  status: string;
  score_aderencia: number;
  data_captura: string;
  data_publicacao: string | null;
}

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

export function Relatorios() {
  const [periodo, setPeriodo] = useState<"30" | "90" | "tudo">("tudo");

  const { data: todas, isLoading } = useQuery({
    queryKey: ["relatorio_vagas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select(
          "tipo, setor, nivel, regiao, status, score_aderencia, data_captura, data_publicacao",
        );
      if (error) throw error;
      return (data ?? []) as VagaRel[];
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

    return {
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
    };
  }, [todas, periodo]);

  if (isLoading) return <p className="text-[14px] text-ink-soft">Carregando…</p>;

  return (
    <div className="space-y-5">
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
