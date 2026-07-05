import { useMemo, useState } from "react";
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

const FLAG_LABEL: Record<string, string> = {
  superior_completo: "Exige superior completo",
  conselho_profissional: "Exige conselho profissional",
  cnh_incompativel: "CNH incompatível",
  experiencia_excessiva: "Experiência excessiva",
};

interface VagaAdmin {
  id: string;
  titulo: string;
  empresa_orgao: string | null;
  tipo: string;
  nivel: string;
  municipio: string | null;
  regiao: string;
  score_aderencia: number;
  score_urgencia: number;
  flags_incompatibilidade: Record<string, boolean> | null;
  status: string;
  origem: string | null;
  origem_externa_nao_verificada: boolean | null;
  contato_submissao: string | null;
  status_link: string | null;
  mensagem_verificacao_link: string | null;
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

function flagsAtivas(v: VagaAdmin): string[] {
  const f = v.flags_incompatibilidade ?? {};
  return Object.keys(f).filter((k) => f[k]);
}
const municipioIndefinido = (v: VagaAdmin) =>
  !v.municipio || v.regiao === "indefinido";
const estaPronta = (v: VagaAdmin) =>
  v.score_aderencia >= 70 && flagsAtivas(v).length === 0 && !municipioIndefinido(v);
const precisaAtencao = (v: VagaAdmin) =>
  flagsAtivas(v).length > 0 || municipioIndefinido(v) || v.score_aderencia < 40;

function seloAderencia(score: number) {
  if (score >= 70)
    return { label: "Alta aderência", cls: "bg-mata-tint text-mata-deep border-mata-line" };
  if (score >= 40)
    return { label: "Relevante", cls: "bg-surface-dim text-ink-soft border-line-strong" };
  return { label: "Baixa aderência", cls: "bg-ceu-tint text-ceu border-[#C4D4E2]" };
}
function badgeUrgencia(u: number) {
  if (u >= 90) return { label: "Urgente", cls: "bg-barro text-white border-barro" };
  if (u >= 60) return { label: "Vence em breve", cls: "bg-sol-tint text-sol border-[#EBD5A8]" };
  if (u === 40) return { label: "Sem prazo", cls: "bg-ceu-tint text-ceu border-[#C4D4E2]" };
  return null;
}

function Pill({ children, cls }: { children: React.ReactNode; cls: string }) {
  return (
    <span
      className={`mono-caps inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] ${cls}`}
    >
      {children}
    </span>
  );
}

export function FilaVagas() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pendente");
  const [balde, setBalde] = useState<"todas" | "prontas" | "atencao">("todas");
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
          "id, titulo, empresa_orgao, tipo, nivel, municipio, regiao, score_aderencia, score_urgencia, flags_incompatibilidade, status, origem, origem_externa_nao_verificada, contato_submissao, status_link, mensagem_verificacao_link",
        )
        .eq("status", status)
        .order("score_aderencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VagaAdmin[];
    },
  });

  const visiveis = useMemo(() => {
    const lista = vagas ?? [];
    if (status !== "pendente" || balde === "todas") return lista;
    return lista.filter((v) => (balde === "prontas" ? estaPronta(v) : precisaAtencao(v)));
  }, [vagas, status, balde]);

  async function aprovar(v: VagaAdmin) {
    setErro(null);
    const patch: Record<string, unknown> = { status: "aprovada" };
    // aprovar uma vaga de origem externa É a revisão manual exigida pelo bloqueio B4
    if (v.origem_externa_nao_verificada) {
      patch.revisao_manual_origem_externa = true;
      patch.data_revisao_origem_externa = new Date().toISOString();
    }
    const { error } = await supabase.from("vagas").update(patch).eq("id", v.id);
    if (error) return setErro(mensagemBloqueio(error.message));
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
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
    if (error) return setErro(`Erro ao rejeitar: ${error.message}`);
    setRejeitando(null);
    setDetalhe("");
    setMotivo("fora_do_perfil");
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
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
              setBalde("todas");
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

      {/* baldes de triagem (só em pendentes) */}
      {status === "pendente" && vagas && vagas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            [
              ["todas", `Todas (${vagas.length})`],
              ["prontas", `Prontas p/ aprovar (${vagas.filter(estaPronta).length})`],
              ["atencao", `Precisam de atenção (${vagas.filter(precisaAtencao).length})`],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setBalde(v)}
              className={`rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors ${
                balde === v
                  ? "bg-mata-tint text-mata-deep"
                  : "text-ink-soft hover:text-mata-deep"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {erro && (
        <p className="mt-4 rounded-[9px] border border-[#EBC7BE] bg-barro-tint px-3 py-2.5 text-[14px] text-barro">
          {erro}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {isLoading && <p className="text-[14px] text-ink-soft">Carregando…</p>}
        {!isLoading && visiveis.length === 0 && (
          <p className="rounded-[12px] border border-line bg-surface p-6 text-center text-[14px] text-ink-soft">
            Nenhuma vaga aqui.
          </p>
        )}
        {visiveis.map((v) => {
          const selo = seloAderencia(v.score_aderencia);
          const urg = badgeUrgencia(v.score_urgencia);
          const flags = flagsAtivas(v);
          return (
            <div key={v.id} className="rounded-[12px] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <Pill cls={selo.cls}>{selo.label} · {v.score_aderencia}</Pill>
                    {urg && <Pill cls={urg.cls}>{urg.label}</Pill>}
                    {municipioIndefinido(v) && (
                      <Pill cls="bg-sol-tint text-sol border-[#EBD5A8]">
                        Município indefinido
                      </Pill>
                    )}
                    {flags.map((f) => (
                      <Pill key={f} cls="bg-barro-tint text-barro border-[#EBC7BE]">
                        {FLAG_LABEL[f] ?? f}
                      </Pill>
                    ))}
                    {v.origem_externa_nao_verificada && (
                      <Pill cls="bg-sol-tint text-sol border-[#EBD5A8]">Origem externa</Pill>
                    )}
                    {v.status_link === "inacessivel" && (
                      <Pill cls="bg-barro-tint text-barro border-[#EBC7BE]">Link inacessível</Pill>
                    )}
                  </div>
                  <p className="font-display text-[16px] font-bold leading-tight text-ink">
                    {v.titulo}
                  </p>
                  <p className="mono-caps mt-1 text-[11.5px] text-ink-soft">
                    {v.empresa_orgao ?? "—"} · {v.municipio ?? "sem município"} · {v.nivel}
                  </p>
                  {v.origem_externa_nao_verificada && v.contato_submissao && (
                    <p className="mt-1.5 text-[12px] text-ink-soft">
                      <span className="mono-caps text-ink-faint">Enviada por</span>{" "}
                      {v.contato_submissao} — confira a origem antes de aprovar.
                    </p>
                  )}
                </div>
                {status === "pendente" && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => aprovar(v)}
                      className="rounded-[8px] bg-mata px-3.5 py-2 text-[13px] font-bold text-white hover:bg-mata-deep"
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => setRejeitando(rejeitando === v.id ? null : v.id)}
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
          );
        })}
      </div>
    </div>
  );
}
