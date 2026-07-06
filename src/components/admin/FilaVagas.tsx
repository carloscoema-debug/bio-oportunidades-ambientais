import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditarVaga } from "./EditarVaga";

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
  link_candidatura: string | null;
  forma_candidatura: string | null;
  remuneracao_bolsa: string | null;
  carga_horaria: string | null;
  modalidade: string | null;
  prazo_inscricao: string | null;
  sem_prazo_definido: boolean | null;
  descricao: string | null;
  uf: string | null;
  ai_recomendacao: string | null;
  ai_score: number | null;
  ai_justificativa: string | null;
  ai_modalidade: string | null;
}

const MODALIDADE_LABEL: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

// Recomendação da IA (curadoria assistida) — pílula + rótulo
const AI_RECO: Record<string, { label: string; cls: string }> = {
  aprovar: { label: "IA: aprovar", cls: "bg-mata-tint text-mata-deep border-mata-line" },
  revisar: { label: "IA: revisar", cls: "bg-sol-tint text-sol border-[#EBD5A8]" },
  descartar: { label: "IA: descartar", cls: "bg-barro-tint text-barro border-[#EBC7BE]" },
};

interface Dup {
  vaga_id: string;
  dup_id: string;
  dup_titulo: string;
  dup_empresa: string | null;
  dup_origem: string | null;
  dup_status: string;
  similaridade: number;
}
const STATUS_DUP: Record<string, string> = {
  pendente: "também na fila",
  aprovada: "já publicada",
};

// Link "genérico" = aponta só para a home do domínio (sem caminho da vaga).
// O candidato não conseguiria ver a vaga original — o coordenador precisa
// abrir e substituir pelo link específico antes de aprovar.
function linkGenerico(url: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" && !u.search;
  } catch {
    return false;
  }
}

function dominioDe(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
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
  if (msg.includes("BLOQUEIO_B6"))
    return "Não publicável: presencial/híbrida fora do Ceará. Só vaga 100% remota pode ser de outro estado (ou corrija a UF/modalidade).";
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
  const [balde, setBalde] = useState<"todas" | "prontas" | "atencao" | "ia_descartar">("todas");
  const [erro, setErro] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("fora_do_perfil");
  const [detalhe, setDetalhe] = useState("");

  const { data: vagas, isLoading } = useQuery({
    queryKey: ["admin_vagas", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select(
          "id, titulo, empresa_orgao, tipo, nivel, municipio, regiao, score_aderencia, score_urgencia, flags_incompatibilidade, status, origem, origem_externa_nao_verificada, contato_submissao, status_link, mensagem_verificacao_link, link_candidatura, forma_candidatura, remuneracao_bolsa, carga_horaria, modalidade, prazo_inscricao, sem_prazo_definido, descricao, uf, ai_recomendacao, ai_score, ai_justificativa, ai_modalidade",
        )
        .eq("status", status)
        .order("score_aderencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VagaAdmin[];
    },
  });

  // P3 · possíveis duplicatas (título semelhante entre pendentes e já publicadas)
  const { data: duplicatas } = useQuery({
    queryKey: ["admin_duplicatas"],
    enabled: status === "pendente",
    queryFn: async () => {
      const { data } = await supabase.rpc("bio_duplicatas_fila");
      const mapa: Record<string, Dup[]> = {};
      for (const d of (data ?? []) as Dup[]) {
        (mapa[d.vaga_id] ??= []).push(d);
      }
      return mapa;
    },
  });

  const visiveis = useMemo(() => {
    const lista = vagas ?? [];
    if (status !== "pendente" || balde === "todas") return lista;
    if (balde === "ia_descartar") return lista.filter((v) => v.ai_recomendacao === "descartar");
    if (balde === "prontas") return lista.filter(estaPronta);
    return lista.filter(precisaAtencao);
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
    qc.invalidateQueries({ queryKey: ["admin_duplicatas"] });
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
    qc.invalidateQueries({ queryKey: ["admin_duplicatas"] });
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
              ["ia_descartar", `IA sugere descartar (${vagas.filter((v) => v.ai_recomendacao === "descartar").length})`],
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
          const detalhes = [
            v.remuneracao_bolsa,
            v.carga_horaria,
            v.modalidade ? MODALIDADE_LABEL[v.modalidade] ?? v.modalidade : null,
            !v.sem_prazo_definido && v.prazo_inscricao
              ? `Inscrições até ${v.prazo_inscricao}`
              : null,
          ].filter(Boolean) as string[];
          const dups = duplicatas?.[v.id] ?? [];
          return (
            <div key={v.id} className="rounded-[12px] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {v.ai_recomendacao && AI_RECO[v.ai_recomendacao] && (
                      <Pill cls={AI_RECO[v.ai_recomendacao].cls}>
                        {AI_RECO[v.ai_recomendacao].label}
                        {typeof v.ai_score === "number" ? ` · ${v.ai_score}` : ""}
                      </Pill>
                    )}
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
                    {linkGenerico(v.link_candidatura) && (
                      <Pill cls="bg-sol-tint text-sol border-[#EBD5A8]">Link genérico</Pill>
                    )}
                    {dups.length > 0 && (
                      <Pill cls="bg-ceu-tint text-ceu border-[#C4D4E2]">
                        Possível duplicata
                      </Pill>
                    )}
                  </div>
                  <p className="font-display text-[16px] font-bold leading-tight text-ink">
                    {v.titulo}
                  </p>
                  <p className="mono-caps mt-1 text-[11.5px] text-ink-soft">
                    {v.empresa_orgao ?? "—"} · {v.municipio ?? "sem município"} · {v.nivel}
                    {v.uf ? ` · ${v.uf}` : ""}
                    {v.ai_modalidade ? ` · ${MODALIDADE_LABEL[v.ai_modalidade] ?? v.ai_modalidade}` : ""}
                  </p>
                  {v.ai_justificativa && (
                    <p className="mt-1.5 rounded-[8px] border border-line bg-surface-dim/40 px-2.5 py-1.5 text-[12px] leading-relaxed text-ink-soft">
                      <span className="mono-caps text-[10px] text-ink-faint">Leitura da IA · </span>
                      {v.ai_justificativa}
                    </p>
                  )}
                  {v.link_candidatura ? (
                    <p className="mt-1.5 text-[12px]">
                      <a
                        href={v.link_candidatura}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mono-caps text-mata-deep underline underline-offset-2 hover:text-mata"
                      >
                        Ver vaga na fonte ↗
                      </a>
                      <span className="text-ink-faint"> · {dominioDe(v.link_candidatura)}</span>
                      {linkGenerico(v.link_candidatura) && (
                        <span className="mt-1 block text-[12px] text-sol">
                          Este link abre só a página inicial do site — encontre o endereço
                          específico da vaga e edite antes de aprovar, para o candidato ver os detalhes.
                        </span>
                      )}
                    </p>
                  ) : (
                    v.forma_candidatura && (
                      <p className="mt-1.5 text-[12px] text-ink-soft">
                        <span className="mono-caps text-ink-faint">Candidatura:</span>{" "}
                        {v.forma_candidatura}
                      </p>
                    )
                  )}
                  {detalhes.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-x-2 text-[12.5px] text-ink">
                      {detalhes.map((d, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mr-2 text-ink-faint">◦</span>}
                          {d}
                        </span>
                      ))}
                    </p>
                  )}
                  {v.descricao && (
                    <p className="mt-1.5 line-clamp-2 max-w-[70ch] text-[12.5px] leading-relaxed text-ink-soft">
                      {v.descricao}
                    </p>
                  )}
                  {dups.length > 0 && (
                    <div className="mt-2 rounded-[8px] border border-[#C4D4E2] bg-ceu-tint/40 px-2.5 py-2">
                      <p className="mono-caps text-[10.5px] text-ceu">
                        Título semelhante a {dups.length === 1 ? "outra vaga" : `${dups.length} vagas`}
                      </p>
                      {dups.slice(0, 3).map((d) => (
                        <p key={d.dup_id} className="mt-1 text-[12px] text-ink-soft">
                          <span className="font-bold text-ink">{d.dup_titulo}</span>{" "}
                          <span className="text-ink-faint">
                            ({STATUS_DUP[d.dup_status] ?? d.dup_status}
                            {d.dup_origem ? ` · ${d.dup_origem}` : ""} ·{" "}
                            {Math.round(d.similaridade * 100)}%)
                          </span>
                        </p>
                      ))}
                    </div>
                  )}
                  {v.origem_externa_nao_verificada && v.contato_submissao && (
                    <p className="mt-1.5 text-[12px] text-ink-soft">
                      <span className="mono-caps text-ink-faint">Enviada por</span>{" "}
                      {v.contato_submissao} — confira a origem antes de aprovar.
                    </p>
                  )}
                </div>
                {(status === "pendente" || status === "aprovada") && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {status === "pendente" && (
                      <button
                        onClick={() => aprovar(v)}
                        className="rounded-[8px] bg-mata px-3.5 py-2 text-[13px] font-bold text-white hover:bg-mata-deep"
                      >
                        Aprovar
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditando(editando === v.id ? null : v.id);
                        setRejeitando(null);
                      }}
                      className="rounded-[8px] border border-line-strong px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-mata hover:text-mata"
                    >
                      {editando === v.id ? "Fechar" : "Editar"}
                    </button>
                    {status === "pendente" && (
                      <button
                        onClick={() => {
                          setRejeitando(rejeitando === v.id ? null : v.id);
                          setEditando(null);
                        }}
                        className="rounded-[8px] border border-line-strong px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-barro hover:text-barro"
                      >
                        Rejeitar
                      </button>
                    )}
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

              {editando === v.id && (
                <div className="mt-3 rounded-[9px] border border-mata-line bg-paper p-3 sm:p-4">
                  <EditarVaga id={v.id} onClose={() => setEditando(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
