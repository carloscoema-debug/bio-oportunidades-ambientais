import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VagaCard, type VagaPublica } from "./VagaCard";

async function fetchVagas(): Promise<VagaPublica[]> {
  const { data, error } = await supabase
    .from("vagas_publicas")
    .select(
      "id, titulo, empresa_orgao, tipo, regiao, modalidade, municipio, carga_horaria, remuneracao_bolsa, prazo_inscricao, sem_prazo_definido, link_candidatura, forma_candidatura, score_urgencia, selo_aderencia, selo_parceiro",
    )
    .order("score_urgencia", { ascending: false })
    .order("data_publicacao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VagaPublica[];
}

type Filtro = { key: string; label: string; test: (v: VagaPublica) => boolean };

const FILTROS: Filtro[] = [
  { key: "todas", label: "Todas", test: () => true },
  { key: "estagio", label: "Estágio", test: (v) => v.tipo === "estagio" },
  { key: "emprego", label: "Emprego", test: (v) => v.tipo === "emprego" },
  { key: "selecao", label: "Seleção pública", test: (v) => v.tipo === "processo_seletivo" },
  { key: "rmf", label: "Fortaleza + RMF", test: (v) => v.regiao === "rmf" },
  { key: "interior", label: "Interior", test: (v) => v.regiao === "interior_ceara" },
  { key: "recomendadas", label: "Recomendadas p/ mim", test: (v) => v.selo_aderencia === "recomendado" },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-line bg-surface p-5">
      <span className="absolute inset-y-0 left-0 w-[5px] bg-line-strong" aria-hidden />
      <div className="mb-3 h-5 w-40 animate-pulse rounded-full bg-surface-dim" />
      <div className="h-6 w-3/4 animate-pulse rounded bg-surface-dim" />
      <div className="mt-2 h-4 w-1/3 animate-pulse rounded bg-surface-dim" />
      <div className="mt-4 h-11 w-full animate-pulse rounded-[9px] bg-surface-dim" />
    </div>
  );
}

export function VagasFeed() {
  const [busca, setBusca] = useState("");
  const [filtroKey, setFiltroKey] = useState("todas");

  const { data: vagas, isLoading, isError } = useQuery({
    queryKey: ["vagas_publicas"],
    queryFn: fetchVagas,
  });

  const filtrando = busca.trim() !== "" || filtroKey !== "todas";

  const vagasFiltradas = useMemo(() => {
    const q = norm(busca.trim());
    const filtro = FILTROS.find((f) => f.key === filtroKey) ?? FILTROS[0];
    return (vagas ?? []).filter(
      (v) =>
        filtro.test(v) &&
        (q === "" ||
          norm(v.titulo).includes(q) ||
          norm(v.empresa_orgao ?? "").includes(q)),
    );
  }, [vagas, busca, filtroKey]);

  function limpar() {
    setBusca("");
    setFiltroKey("todas");
  }

  return (
    <section aria-label="Vagas" className="mt-8">
      {/* Busca */}
      <div className="relative">
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cargo, órgão ou palavra-chave…"
          aria-label="Buscar vagas"
          className="w-full rounded-[14px] border-[1.5px] border-line-strong bg-surface py-3.5 pl-11 pr-4 text-[16px] text-ink shadow-[var(--shadow-card)] transition-shadow placeholder:text-ink-faint focus:border-mata focus:outline-none focus:ring-4 focus:ring-mata/15"
        />
      </div>

      {/* Chips de filtro — quebram em linha (sem scroll oculto que corta filtros) */}
      <div
        role="group"
        aria-label="Filtros"
        className="mt-3 flex flex-wrap gap-2"
      >
        {FILTROS.map((f) => {
          const ativo = f.key === filtroKey;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={ativo}
              onClick={() => setFiltroKey(f.key)}
              className={`mono-caps cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] tracking-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mata/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
                ativo
                  ? "border-ink bg-ink text-paper shadow-[0_2px_10px_-3px_rgba(27,42,33,0.5)]"
                  : "border-line-strong bg-surface text-ink-soft hover:-translate-y-px hover:border-mata hover:text-mata-deep hover:shadow-[var(--shadow-card)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Contador / pulso */}
      {!isLoading && !isError && vagas && (
        <div className="mb-5 mt-4">
          {filtrando ? (
            <span className="mono-caps text-[12px] text-ink-faint">
              {vagasFiltradas.length}{" "}
              {vagasFiltradas.length === 1 ? "resultado" : "resultados"}
              {" · "}
              <button
                onClick={limpar}
                className="text-mata-deep underline underline-offset-2 hover:text-mata"
              >
                limpar
              </button>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full border border-mata-line bg-mata-tint px-3 py-1.5">
              <span className="relative flex h-[7px] w-[7px]">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mata opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-mata" />
              </span>
              <span className="mono-caps text-[12px] text-mata-deep">
                {vagas.length} {vagas.length === 1 ? "vaga ativa" : "vagas ativas"} · atualizado hoje
              </span>
            </span>
          )}
        </div>
      )}

      <div className="grid gap-4">
        {isLoading && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}

        {isError && (
          <div className="rounded-[16px] border border-line bg-surface p-6 text-center">
            <p className="text-[15px] text-ink-soft">
              Não foi possível carregar as vagas. Tente novamente em instantes.
            </p>
          </div>
        )}

        {!isLoading && !isError && vagas && vagas.length === 0 && (
          <div className="rounded-[18px] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)]">
            <p className="font-display text-[19px] font-bold text-ink">
              Nenhuma vaga aberta neste momento
            </p>
            <p className="mx-auto mt-2 max-w-[44ch] text-[14.5px] leading-relaxed text-ink-soft">
              A curadoria publica novas oportunidades toda semana. Cadastre seu e-mail
              logo abaixo e seja o primeiro a saber quando a próxima chegar.
            </p>
            <a
              href="#news-title"
              className="mono-caps mt-4 inline-flex items-center gap-1.5 rounded-full bg-mata px-4 py-2 text-[12px] text-white transition-colors hover:bg-mata-deep"
            >
              Receber por e-mail ↓
            </a>
          </div>
        )}

        {!isLoading &&
          !isError &&
          vagas &&
          vagas.length > 0 &&
          vagasFiltradas.length === 0 && (
            <div className="rounded-[16px] border border-line bg-surface p-8 text-center">
              <p className="text-[15px] text-ink-soft">
                Nenhuma vaga corresponde à sua busca ou filtro.
              </p>
              <button
                onClick={limpar}
                className="mono-caps mt-3 rounded-full border-[1.5px] border-line-strong px-4 py-2 text-[12.5px] tracking-normal text-ink-soft hover:border-mata hover:text-mata-deep"
              >
                Limpar filtros
              </button>
            </div>
          )}

        {!isLoading &&
          !isError &&
          vagasFiltradas.map((vaga, i) => (
            <div
              key={vaga.id}
              className="motion-safe:animate-[surgir_0.5s_cubic-bezier(0.2,0.7,0.3,1)_both]"
              style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
            >
              <VagaCard vaga={vaga} />
            </div>
          ))}
      </div>
    </section>
  );
}
