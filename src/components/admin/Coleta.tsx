import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const STATUS_FONTE: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-mata-tint text-mata-deep border-mata-line" },
  em_teste: { label: "Em teste", cls: "bg-mata-tint text-mata-deep border-mata-line" },
  pausada: { label: "Pausada", cls: "bg-surface-dim text-ink-soft border-line-strong" },
  quarentena: { label: "Quarentena", cls: "bg-sol-tint text-sol border-[#EBD5A8]" },
  bloqueada: { label: "Bloqueada", cls: "bg-barro-tint text-barro border-[#EBC7BE]" },
};
const CANAL_LABEL: Record<string, string> = {
  canal_a_http: "RSS / HTTP",
  canal_b_email: "E-mail",
  canal_c_assistido: "Assistido",
};

const desde = (iso: string | null) =>
  iso ? `há ${formatDistanceToNow(new Date(iso), { locale: ptBR })}` : "nunca";

export function Coleta() {
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<
    { fonte: string; encontrados: number; novos: number; duplicados: number; status: string }[] | null
  >(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: fontes } = useQuery({
    queryKey: ["coleta_fontes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fontes_coleta")
        .select("id, nome, canal, metodo_coleta, status, ultima_execucao, taxa_aproveitamento, falhas_consecutivas")
        .order("status")
        .order("nome");
      return data ?? [];
    },
  });

  const { data: execucoes } = useQuery({
    queryKey: ["coleta_execucoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("execucoes_coleta")
        .select("id, inicio, itens_encontrados, itens_novos, itens_erro, status, fontes_coleta(nome)")
        .order("inicio", { ascending: false })
        .limit(12);
      return data ?? [];
    },
  });

  async function coletarAgora() {
    setErro(null);
    setResultado(null);
    setRodando(true);
    const { data, error } = await supabase.functions.invoke("coletar-rss");
    setRodando(false);
    if (error) {
      setErro("Não foi possível executar a coleta agora. Tente novamente.");
      return;
    }
    setResultado((data as { fontes: typeof resultado })?.fontes ?? []);
    qc.invalidateQueries({ queryKey: ["coleta_fontes"] });
    qc.invalidateQueries({ queryKey: ["coleta_execucoes"] });
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink">
            Coleta automática
          </h2>
          <p className="mt-1 max-w-[62ch] text-[14px] text-ink-soft">
            A coleta roda sozinha todo dia às 6h. Fontes RSS/Atom viram vagas
            <strong className="text-ink"> pendentes</strong> na fila; a curadoria
            segue sendo sua. Você também pode disparar uma coleta agora.
          </p>
        </div>
        <button
          onClick={coletarAgora}
          disabled={rodando}
          className="shrink-0 rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-60"
        >
          {rodando ? "Coletando…" : "Coletar agora"}
        </button>
      </div>

      {erro && (
        <p className="rounded-[9px] border border-[#EBC7BE] bg-barro-tint px-3 py-2.5 text-[14px] text-barro">
          {erro}
        </p>
      )}
      {resultado && (
        <div className="rounded-[12px] border border-mata-line bg-mata-tint p-4">
          <p className="mono-caps text-[11px] text-mata-deep">Resultado da coleta</p>
          <ul className="mt-2 space-y-1 text-[13px] text-mata-deep">
            {resultado.map((r) => (
              <li key={r.fonte}>
                <strong>{r.fonte}</strong>: {r.encontrados} encontrados ·{" "}
                {r.novos} nova(s) · {r.duplicados} duplicada(s)
              </li>
            ))}
            {resultado.every((r) => r.novos === 0) && (
              <li className="text-mata-deep/80">
                Nenhuma vaga nova desta vez — os alertas populam com o tempo.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Fontes */}
      <div>
        <p className="mono-caps mb-3 text-[11px] text-ink-faint">Fontes de coleta</p>
        <div className="overflow-hidden rounded-[12px] border border-line">
          <table className="w-full border-collapse text-[13.5px]">
            <thead className="bg-surface-dim/60 text-left">
              <tr className="mono-caps text-[11px] text-ink-soft">
                <th className="px-4 py-2.5 font-semibold">Fonte</th>
                <th className="px-4 py-2.5 font-semibold">Canal</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Última coleta</th>
                <th className="px-4 py-2.5 font-semibold">Aproveitamento</th>
              </tr>
            </thead>
            <tbody>
              {fontes?.map((f) => {
                const s = STATUS_FONTE[f.status] ?? STATUS_FONTE.pausada;
                return (
                  <tr key={f.id} className="border-t border-line bg-surface">
                    <td className="px-4 py-2.5">
                      <span className="font-bold text-ink">{f.nome}</span>
                      {f.falhas_consecutivas >= 3 && (
                        <span className="ml-2 text-[11px] text-barro">
                          {f.falhas_consecutivas} falhas
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {CANAL_LABEL[f.canal] ?? f.canal}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`mono-caps inline-flex rounded-full border px-2 py-0.5 text-[10.5px] ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {desde(f.ultima_execucao)}
                    </td>
                    <td className="px-4 py-2.5 text-ink-soft">
                      {Number(f.taxa_aproveitamento).toFixed(0)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Execuções recentes */}
      <div>
        <p className="mono-caps mb-3 text-[11px] text-ink-faint">Execuções recentes</p>
        <div className="grid gap-2">
          {execucoes?.length === 0 && (
            <p className="text-[13px] text-ink-soft">Nenhuma execução ainda.</p>
          )}
          {execucoes?.map((e) => {
            const fc = e.fontes_coleta as unknown as
              | { nome: string }
              | { nome: string }[]
              | null;
            const nome = (Array.isArray(fc) ? fc[0]?.nome : fc?.nome) ?? "—";
            const cor =
              e.status === "sucesso"
                ? "text-mata-deep"
                : e.status === "falha_parcial"
                  ? "text-sol"
                  : "text-barro";
            return (
              <div
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-3.5 py-2"
              >
                <span className="text-[13.5px] font-bold text-ink">{nome}</span>
                <span className="mono-caps text-[11.5px] text-ink-soft">
                  {e.itens_encontrados} enc · {e.itens_novos} novas ·{" "}
                  {e.itens_erro} erro ·{" "}
                  <span className={cor}>{e.status}</span> · {desde(e.inicio)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
