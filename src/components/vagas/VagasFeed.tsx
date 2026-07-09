import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VagaCard, type VagaPublica } from "./VagaCard";

async function fetchVagas(): Promise<VagaPublica[]> {
  const { data, error } = await supabase
    .from("vagas_publicas")
    .select(
      "id, titulo, empresa_orgao, tipo, nivel, regiao, modalidade, municipio, carga_horaria, remuneracao_bolsa, curso_alvo, prazo_inscricao, sem_prazo_definido, data_publicacao, link_candidatura, forma_candidatura, score_urgencia, selo_aderencia, selo_parceiro",
    )
    // ordem final é decidida no cliente (o estudante pode inverter); isto é só o baseline
    .order("data_publicacao", { ascending: false })
    .order("score_urgencia", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VagaPublica[];
}

// Grupo 1 — TIPO: sempre exatamente uma opção ativa ("Todas" é o catch-all).
const TIPOS = [
  { key: "todas", label: "Todas" },
  { key: "estagio", label: "Estágio" },
  { key: "emprego", label: "Emprego" },
  { key: "processo_seletivo", label: "Seleção pública" },
] as const;

// Grupo 2 — REFINAR: cada chip liga/desliga sozinha (nenhuma ativa = sem recorte
// naquela dimensão). São facetas independentes do Tipo, por isso ficam numa
// linha separada, com rótulo próprio — evita o estudante achar que são o mesmo
// grupo exclusivo (clicar em "Técnico" não desliga "Estágio", por exemplo).
const NIVEIS = [
  { key: "tecnico", label: "Nível Técnico" },
  { key: "superior", label: "Nível Superior" },
] as const;
const REGIOES = [
  { key: "rmf", label: "Fortaleza + RMF" },
  { key: "interior_ceara", label: "Interior" },
] as const;

type Ordenacao = "recentes" | "antigas";

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Estilo de chip compartilhado pelos dois grupos (idêntico ao já usado no BIO).
const chipCls = (ativo: boolean) =>
  `mono-caps cursor-pointer rounded-full border-[1.5px] px-3.5 py-2 text-[12.5px] tracking-normal transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mata/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper ${
    ativo
      ? "border-ink bg-ink text-paper shadow-[0_2px_10px_-3px_rgba(27,42,33,0.5)]"
      : "border-line-strong bg-surface text-ink-soft hover:-translate-y-px hover:border-mata hover:text-mata-deep hover:shadow-[var(--shadow-card)]"
  }`;

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
  const [tipo, setTipo] = useState<string>("todas");
  const [nivel, setNivel] = useState<string | null>(null);
  const [regiao, setRegiao] = useState<string | null>(null);
  const [recomendadas, setRecomendadas] = useState(false);
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");

  const { data: vagas, isLoading, isError } = useQuery({
    queryKey: ["vagas_publicas"],
    queryFn: fetchVagas,
  });

  const filtrando =
    busca.trim() !== "" || tipo !== "todas" || nivel !== null || regiao !== null || recomendadas;

  const vagasFiltradas = useMemo(() => {
    const q = norm(busca.trim());
    const lista = (vagas ?? []).filter((v) => {
      if (tipo !== "todas" && v.tipo !== tipo) return false;
      if (nivel && v.nivel !== nivel && v.nivel !== "ambos") return false;
      if (regiao && v.regiao !== regiao) return false;
      if (recomendadas && v.selo_aderencia !== "recomendado") return false;
      if (q && !(norm(v.titulo).includes(q) || norm(v.empresa_orgao ?? "").includes(q))) return false;
      return true;
    });
    return [...lista].sort((a, b) => {
      const da = a.data_publicacao ? new Date(a.data_publicacao).getTime() : 0;
      const db = b.data_publicacao ? new Date(b.data_publicacao).getTime() : 0;
      return ordenacao === "recentes" ? db - da : da - db;
    });
  }, [vagas, busca, tipo, nivel, regiao, recomendadas, ordenacao]);

  function limpar() {
    setBusca("");
    setTipo("todas");
    setNivel(null);
    setRegiao(null);
    setRecomendadas(false);
    setOrdenacao("recentes");
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

      {/* Grupo TIPO — sempre uma opção ativa; "Todas" é o catch-all */}
      <div role="group" aria-label="Filtrar por tipo" className="mt-4 flex flex-wrap gap-2">
        {TIPOS.map((t) => {
          const ativo = tipo === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={ativo}
              onClick={() => setTipo(t.key)}
              className={chipCls(ativo)}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Grupo REFINAR — facetas independentes (nível, região, recomendadas);
          cada chip liga/desliga sozinha, por isso fica separada do grupo Tipo. */}
      <div className="mt-3">
        <p className="mono-caps mb-2 text-[10px] text-ink-faint">Refinar</p>
        <div role="group" aria-label="Refinar resultados" className="flex flex-wrap items-center gap-2">
          {NIVEIS.map((n) => (
            <button
              key={n.key}
              type="button"
              aria-pressed={nivel === n.key}
              onClick={() => setNivel((v) => (v === n.key ? null : n.key))}
              className={chipCls(nivel === n.key)}
            >
              {n.label}
            </button>
          ))}
          <span aria-hidden className="mx-0.5 hidden text-line-strong sm:inline">·</span>
          {REGIOES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={regiao === r.key}
              onClick={() => setRegiao((v) => (v === r.key ? null : r.key))}
              className={chipCls(regiao === r.key)}
            >
              {r.label}
            </button>
          ))}
          <span aria-hidden className="mx-0.5 hidden text-line-strong sm:inline">·</span>
          <button
            type="button"
            aria-pressed={recomendadas}
            onClick={() => setRecomendadas((v) => !v)}
            className={chipCls(recomendadas)}
          >
            Recomendadas p/ mim
          </button>
        </div>
      </div>

      {/* Contador / pulso + ordenação */}
      {!isLoading && !isError && vagas && (
        <div className="mb-5 mt-4 flex flex-wrap items-center justify-between gap-3">
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

          <label className="mono-caps flex items-center gap-2 text-[10.5px] text-ink-faint">
            Ordenar
            <select
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
              aria-label="Ordenar vagas"
              className="mono-caps cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface py-1.5 pl-3 pr-2.5 text-[11.5px] tracking-normal text-ink-soft focus:border-mata focus:outline-none"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
            </select>
          </label>
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
