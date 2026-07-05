import { useQuery } from "@tanstack/react-query";
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const isoDia = (d: Date) => d.toISOString().slice(0, 10);

async function carregarDashboard() {
  const hoje = new Date();
  const em3 = new Date(hoje);
  em3.setDate(em3.getDate() + 3);

  const [pend, pub, susp, venc, ultima] = await Promise.all([
    supabase.from("vagas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
    supabase.from("vagas").select("id", { count: "exact", head: true }).eq("status", "aprovada"),
    supabase.from("vagas").select("id", { count: "exact", head: true }).eq("status", "suspensa"),
    supabase
      .from("vagas")
      .select("id, titulo, data_expiracao_calculada")
      .eq("status", "aprovada")
      .not("data_expiracao_calculada", "is", null)
      .gte("data_expiracao_calculada", isoDia(hoje))
      .lte("data_expiracao_calculada", isoDia(em3))
      .order("data_expiracao_calculada", { ascending: true })
      .limit(6),
    supabase
      .from("vagas")
      .select("data_publicacao")
      .eq("status", "aprovada")
      .not("data_publicacao", "is", null)
      .order("data_publicacao", { ascending: false })
      .limit(1),
  ]);

  const ultimaPub = ultima.data?.[0]?.data_publicacao ?? null;
  return {
    pendentes: pend.count ?? 0,
    publicadas: pub.count ?? 0,
    suspensas: susp.count ?? 0,
    vencendo: (venc.data ?? []) as {
      id: string;
      titulo: string;
      data_expiracao_calculada: string;
    }[],
    diasDesdeUltima:
      ultimaPub != null
        ? differenceInCalendarDays(new Date(), new Date(ultimaPub))
        : null,
  };
}

function Card({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-line bg-surface p-5">
      <p className="mono-caps text-[11px] text-ink-faint">{rotulo}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function Dashboard({ onIrParaFila }: { onIrParaFila: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin_dashboard"],
    queryFn: carregarDashboard,
  });

  if (isLoading || !data) {
    return <p className="text-[14px] text-ink-soft">Carregando painel…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Pergunta 1 */}
        <Card rotulo="O que revisar hoje?">
          <p className="font-display text-[40px] font-bold leading-none text-ink">
            {data.pendentes}
          </p>
          <p className="mt-1 text-[14px] text-ink-soft">
            {data.pendentes === 1 ? "vaga pendente" : "vagas pendentes"} de curadoria
          </p>
          {data.pendentes > 0 && (
            <button
              onClick={onIrParaFila}
              className="mt-4 rounded-[9px] bg-mata px-4 py-2 text-[14px] font-bold text-white hover:bg-mata-deep"
            >
              Ir para a fila →
            </button>
          )}
        </Card>

        {/* Pergunta 2 */}
        <Card rotulo="Quais vagas vencem em breve?">
          {data.vencendo.length === 0 ? (
            <p className="text-[14px] text-ink-soft">
              Nenhuma vaga vence nos próximos 3 dias.
            </p>
          ) : (
            <ul className="space-y-2">
              {data.vencendo.map((v) => {
                const dias = differenceInCalendarDays(
                  parseISO(v.data_expiracao_calculada),
                  new Date(),
                );
                return (
                  <li key={v.id} className="text-[13.5px] leading-snug">
                    <span className="font-bold text-ink">{v.titulo}</span>
                    <span
                      className={
                        dias <= 0
                          ? "text-barro"
                          : dias < 3
                            ? "text-sol"
                            : "text-ink-soft"
                      }
                    >
                      {" — "}
                      {dias <= 0
                        ? "vence hoje"
                        : `vence em ${dias} ${dias === 1 ? "dia" : "dias"} (${format(
                            parseISO(v.data_expiracao_calculada),
                            "d 'de' MMM",
                            { locale: ptBR },
                          )})`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Pergunta 3 */}
        <Card rotulo="Coleta automática">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            A coleta automática está <strong className="text-ink">ativa</strong> (RSS/Google
            Alerts e e-mail). As vagas chegam sozinhas à fila como pendentes — acompanhe e
            dispare na aba <strong className="text-ink">Coleta</strong>.
          </p>
        </Card>
      </div>

      {/* Faixa de números */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card rotulo="Vagas publicadas (ativas)">
          <p className="font-display text-[28px] font-bold text-ink">
            {data.publicadas}
          </p>
        </Card>
        <Card rotulo="Suspensas (investigação)">
          <p
            className={`font-display text-[28px] font-bold ${
              data.suspensas > 0 ? "text-barro" : "text-ink"
            }`}
          >
            {data.suspensas}
          </p>
        </Card>
        <Card rotulo="Dias desde a última publicação">
          <p className="font-display text-[28px] font-bold text-ink">
            {data.diasDesdeUltima === null ? "—" : data.diasDesdeUltima}
          </p>
        </Card>
      </div>
    </div>
  );
}
