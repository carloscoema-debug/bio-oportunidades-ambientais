import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VagaCard, type VagaPublica } from "./VagaCard";

async function fetchVagas(): Promise<VagaPublica[]> {
  const { data, error } = await supabase
    .from("vagas_publicas")
    .select(
      "id, titulo, empresa_orgao, tipo, modalidade, municipio, carga_horaria, remuneracao_bolsa, prazo_inscricao, sem_prazo_definido, link_candidatura, forma_candidatura, score_urgencia, selo_aderencia, selo_parceiro",
    )
    .order("score_urgencia", { ascending: false })
    .order("data_publicacao", { ascending: false });
  if (error) throw error;
  return (data ?? []) as VagaPublica[];
}

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
  const { data: vagas, isLoading, isError } = useQuery({
    queryKey: ["vagas_publicas"],
    queryFn: fetchVagas,
  });

  return (
    <section aria-label="Vagas" className="mt-8">
      {/* Indicador de vitalidade (pulso) */}
      {!isLoading && !isError && vagas && vagas.length > 0 && (
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-mata-line bg-mata-tint px-3 py-1.5">
          <span className="relative flex h-[7px] w-[7px]">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mata opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-mata" />
          </span>
          <span className="mono-caps text-[12px] text-mata-deep">
            {vagas.length} {vagas.length === 1 ? "vaga ativa" : "vagas ativas"} · atualizado hoje
          </span>
        </span>
      )}

      <div className="grid gap-4">
        {isLoading &&
          [0, 1, 2].map((i) => <SkeletonCard key={i} />)}

        {isError && (
          <div className="rounded-[16px] border border-line bg-surface p-6 text-center">
            <p className="text-[15px] text-ink-soft">
              Não foi possível carregar as vagas. Tente novamente em instantes.
            </p>
          </div>
        )}

        {!isLoading && !isError && vagas && vagas.length === 0 && (
          <div className="rounded-[16px] border border-line bg-surface p-8 text-center">
            <p className="font-display text-[18px] font-bold text-ink">
              Nenhuma vaga disponível no momento
            </p>
            <p className="mx-auto mt-2 max-w-[42ch] text-[14px] text-ink-soft">
              Cadastre seu e-mail para ser avisado assim que novas oportunidades forem
              publicadas.
            </p>
            <input
              type="email"
              disabled
              placeholder="Cadastro de e-mail — em breve"
              className="mx-auto mt-4 block w-full max-w-[280px] cursor-not-allowed rounded-[9px] border border-line-strong bg-surface-dim px-3 py-2.5 text-[14px] text-ink-faint"
            />
          </div>
        )}

        {!isLoading &&
          !isError &&
          vagas?.map((vaga, i) => (
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
