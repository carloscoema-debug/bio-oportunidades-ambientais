import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STATUS = [
  ["pendente", "Pendentes"],
  ["aprovada", "Publicadas"],
  ["rejeitada", "Rejeitadas"],
  ["suspensa", "Suspensas"],
  ["expirada", "Expiradas"],
] as const;

const MOTIVOS = [
  ["fora_do_perfil", "Fora do perfil do curso"],
  ["fonte_duvidosa", "Fonte duvidosa"],
  ["suspeita_fraude", "Suspeita de fraude"],
  ["duplicata", "Duplicata"],
  ["prazo_expirado", "Prazo expirado"],
  ["incompativel_tecnico", "Incompatível com nível técnico"],
  ["outros", "Outros"],
] as const;

interface VagaAdmin {
  id: string;
  titulo: string;
  empresa_orgao: string | null;
  tipo: string;
  nivel: string;
  municipio: string | null;
  regiao: string;
  score_aderencia: number;
  status: string;
  link_candidatura: string | null;
  forma_candidatura: string | null;
  prazo_inscricao: string | null;
  sem_prazo_definido: boolean;
}

function mensagemBloqueio(msg: string): string {
  if (msg.includes("BLOQUEIO_B1"))
    return "Não publicável: vaga fora do Ceará. Corrija o município ou rejeite.";
  if (msg.includes("BLOQUEIO_B2"))
    return "Não publicável: sem link nem forma de candidatura. Edite a vaga e preencha um deles.";
  if (msg.includes("BLOQUEIO_B4"))
    return "Não publicável: origem externa ainda não verificada.";
  if (msg.includes("BLOQUEIO_B5"))
    return "Não publicável: vaga sob suspeita (2+ denúncias) — investigue antes.";
  return `Erro: ${msg}`;
}

export function FilaVagas() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pendente");
  const [erro, setErro] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("fora_do_perfil");
  const [detalhe, setDetalhe] = useState("");

  const { data: vagas, isLoading } = useQuery({
    queryKey: ["admin_vagas", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select(
          "id, titulo, empresa_orgao, tipo, nivel, municipio, regiao, score_aderencia, status, link_candidatura, forma_candidatura, prazo_inscricao, sem_prazo_definido",
        )
        .eq("status", status)
        .order("score_aderencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VagaAdmin[];
    },
  });

  async function aprovar(id: string) {
    setErro(null);
    const { error } = await supabase
      .from("vagas")
      .update({ status: "aprovada" })
      .eq("id", id);
    if (error) {
      setErro(mensagemBloqueio(error.message));
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["vagas_publicas"] });
  }

  async function confirmarRejeicao(id: string) {
    setErro(null);
    const { error } = await supabase
      .from("vagas")
      .update({
        status: "rejeitada",
        motivo_rejeicao_categoria: motivo,
        motivo_rejeicao_detalhe: detalhe.trim() || null,
      })
      .eq("id", id);
    if (error) {
      setErro(`Erro ao rejeitar: ${error.message}`);
      return;
    }
    setRejeitando(null);
    setDetalhe("");
    setMotivo("fora_do_perfil");
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
  }

  return (
    <div>
      {/* filtro por status */}
      <div className="flex flex-wrap gap-2">
        {STATUS.map(([v, l]) => (
          <button
            key={v}
            onClick={() => {
              setStatus(v);
              setRejeitando(null);
              setErro(null);
            }}
            className={`mono-caps rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] tracking-normal transition-colors ${
              status === v
                ? "border-ink bg-ink text-paper"
                : "border-line-strong bg-surface text-ink-soft hover:border-mata"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {erro && (
        <p className="mt-4 rounded-[9px] border border-[#EBC7BE] bg-barro-tint px-3 py-2.5 text-[14px] text-barro">
          {erro}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {isLoading && (
          <p className="text-[14px] text-ink-soft">Carregando…</p>
        )}
        {!isLoading && vagas && vagas.length === 0 && (
          <p className="rounded-[12px] border border-line bg-surface p-6 text-center text-[14px] text-ink-soft">
            Nenhuma vaga com este status.
          </p>
        )}
        {vagas?.map((v) => (
          <div
            key={v.id}
            className="rounded-[12px] border border-line bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[16px] font-bold leading-tight text-ink">
                  {v.titulo}
                </p>
                <p className="mono-caps mt-1 text-[11.5px] text-ink-soft">
                  {v.empresa_orgao ?? "—"} · {v.municipio ?? "sem município"} ·{" "}
                  {v.nivel} · aderência {v.score_aderencia}
                </p>
              </div>
              {status === "pendente" && (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => aprovar(v.id)}
                    className="rounded-[8px] bg-mata px-3.5 py-2 text-[13px] font-bold text-white hover:bg-mata-deep"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() =>
                      setRejeitando(rejeitando === v.id ? null : v.id)
                    }
                    className="rounded-[8px] border border-line-strong px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-barro hover:text-barro"
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </div>

            {rejeitando === v.id && (
              <div className="mt-3 rounded-[9px] border border-line bg-paper p-3">
                <span className="mono-caps block text-[11px] text-ink">
                  Motivo da rejeição
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="rounded-[8px] border border-line-strong bg-surface px-2.5 py-2 text-[14px] text-ink"
                  >
                    {MOTIVOS.map(([mv, ml]) => (
                      <option key={mv} value={mv}>
                        {ml}
                      </option>
                    ))}
                  </select>
                  <input
                    value={detalhe}
                    onChange={(e) => setDetalhe(e.target.value)}
                    placeholder="Detalhe (opcional)"
                    className="min-w-[180px] flex-1 rounded-[8px] border border-line-strong bg-surface px-2.5 py-2 text-[14px] text-ink"
                  />
                  <button
                    onClick={() => confirmarRejeicao(v.id)}
                    className="rounded-[8px] bg-barro px-3.5 py-2 text-[13px] font-bold text-white hover:opacity-90"
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
