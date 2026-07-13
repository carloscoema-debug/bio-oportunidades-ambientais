import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EditarVaga } from "./EditarVaga";

const STATUS = [
  ["pendente", "Pendentes"],
  ["aprovada", "Publicadas"],
  ["link_inativo", "Link inativo"],
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
  data_ultima_verificacao_link: string | null;
  link_candidatura: string | null;
  imagem_fonte_url: string | null;
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
// Baldes orientados pelo VEREDITO DA IA (que lê a área), não pelo score_aderencia
// (que é cego à área — pontua nível/região/completude). Mutuamente exclusivos:
// descartar → pronta → atenção (o resto). Assim IA:descartar não vaza p/ "prontas".
const ehDescartar = (v: VagaAdmin) => v.ai_recomendacao === "descartar";
const estaPronta = (v: VagaAdmin) =>
  v.ai_recomendacao === "aprovar" && flagsAtivas(v).length === 0 && !municipioIndefinido(v);
const precisaAtencao = (v: VagaAdmin) => !ehDescartar(v) && !estaPronta(v);

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
  // seleção em massa (rejeitar várias de uma vez com o mesmo motivo)
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [motivoMassa, setMotivoMassa] = useState("fora_do_perfil");
  const [acaoMassa, setAcaoMassa] = useState(false);
  const [classificando, setClassificando] = useState(false);
  const [abrindoImagem, setAbrindoImagem] = useState<string | null>(null);

  // Canal D (print/PDF): gera uma URL assinada sob demanda — o bucket é privado,
  // então não guardamos link público, só o caminho do arquivo.
  async function verImagemOriginal(caminho: string) {
    setAbrindoImagem(caminho);
    const { data, error } = await supabase.storage.from("capturas-vagas").createSignedUrl(caminho, 3600);
    setAbrindoImagem(null);
    if (error || !data?.signedUrl) {
      setErro("Não foi possível abrir a imagem original.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const { data: vagas, isLoading } = useQuery({
    queryKey: ["admin_vagas", status],
    queryFn: async () => {
      let q = supabase
        .from("vagas")
        .select(
          "id, titulo, empresa_orgao, tipo, nivel, municipio, regiao, score_aderencia, score_urgencia, flags_incompatibilidade, status, origem, origem_externa_nao_verificada, contato_submissao, status_link, mensagem_verificacao_link, data_ultima_verificacao_link, link_candidatura, imagem_fonte_url, forma_candidatura, remuneracao_bolsa, carga_horaria, modalidade, prazo_inscricao, sem_prazo_definido, descricao, uf, ai_recomendacao, ai_score, ai_justificativa, ai_modalidade",
        );
      if (status === "link_inativo") {
        // vagas aprovadas cujo link caiu (tiradas do ar) — a "área de alerta"
        q = q.eq("status", "aprovada").eq("status_link", "inacessivel");
      } else if (status === "aprovada") {
        // Publicadas = aprovadas AINDA no ar (exclui as de link inativo)
        q = q.eq("status", "aprovada").neq("status_link", "inacessivel");
      } else {
        q = q.eq("status", status);
      }
      const { data, error } = await q.order("score_aderencia", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VagaAdmin[];
    },
  });

  // Alerta: quantas vagas foram tiradas do ar por link inativo (para o badge da aba)
  const { data: linkInativoCount = 0 } = useQuery({
    queryKey: ["admin_link_inativo_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("vagas")
        .select("id", { count: "exact", head: true })
        .eq("status", "aprovada")
        .eq("status_link", "inacessivel");
      return count ?? 0;
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

  // Marca o link como ativo de novo (falso positivo do checker automático —
  // comum em sites com bloqueio anti-bot, ex.: Catho devolve 404 fake pra
  // requisição sem navegador). O coordenador confirmou manualmente que abre.
  async function republicar(v: VagaAdmin) {
    setErro(null);
    const { error } = await supabase
      .from("vagas")
      .update({
        status_link: "ativo",
        link_falhas_consecutivas: 0,
        mensagem_verificacao_link: null,
        data_ultima_verificacao_link: new Date().toISOString(),
      })
      .eq("id", v.id);
    if (error) return setErro(`Erro ao republicar: ${error.message}`);
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_link_inativo_count"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
    qc.invalidateQueries({ queryKey: ["vagas_publicas"] });
  }

  // Duplica a vaga (útil p/ concurso com vários cargos: 1 card por cargo). A cópia
  // entra como PENDENTE ("Cópia — …") e o editor abre nela p/ ajustar cargo/curso/salário.
  async function duplicar(v: VagaAdmin) {
    setErro(null);
    const { data, error } = await supabase.rpc("bio_duplicar_vaga", { p_id: v.id });
    if (error) return setErro("Não foi possível duplicar a vaga: " + error.message);
    await qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
    setRejeitando(null);
    setStatus("pendente"); // a cópia é pendente — vai p/ essa aba
    setEditando(data as string); // abre o editor no novo card
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
    qc.invalidateQueries({ queryKey: ["admin_link_inativo_count"] });
  }

  function toggleSel(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleTodasVisiveis(ids: string[]) {
    setSelecionadas((s) => {
      const marcadas = ids.length > 0 && ids.every((i) => s.has(i));
      const n = new Set(s);
      if (marcadas) ids.forEach((i) => n.delete(i));
      else ids.forEach((i) => n.add(i));
      return n;
    });
  }
  const limparSel = () => setSelecionadas(new Set());

  // rejeita TODAS as selecionadas de uma vez, com o mesmo motivo (uma query só)
  async function rejeitarEmMassa() {
    const ids = [...selecionadas];
    if (ids.length === 0) return;
    setErro(null);
    setAcaoMassa(true);
    const { error } = await supabase
      .from("vagas")
      .update({ status: "rejeitada", motivo_rejeicao_categoria: motivoMassa, motivo_rejeicao_detalhe: null })
      .in("id", ids);
    setAcaoMassa(false);
    if (error) return setErro(`Erro ao rejeitar em massa: ${error.message}`);
    limparSel();
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_duplicatas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin_link_inativo_count"] });
  }

  // roda a IA nas pendentes ainda não classificadas (para a fila já vir organizada)
  async function classificarPendentes() {
    setErro(null);
    setClassificando(true);
    const { error } = await supabase.functions.invoke("classificar-vagas");
    setClassificando(false);
    if (error) return setErro(`Erro ao classificar: ${error.message}`);
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
              setBalde("todas");
              setRejeitando(null);
              setErro(null);
              limparSel();
            }}
            className={`mono-caps rounded-full border-[1.5px] px-3.5 py-1.5 text-[12px] tracking-normal transition-colors ${
              status === v
                ? "border-ink bg-ink text-paper"
                : v === "link_inativo" && linkInativoCount > 0
                  ? "border-barro bg-barro-tint text-barro hover:border-barro"
                  : "border-line-strong bg-surface text-ink-soft hover:border-mata"
            }`}
          >
            {l}
            {v === "link_inativo" && linkInativoCount > 0 ? ` (${linkInativoCount})` : ""}
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
              onClick={() => { setBalde(v); limparSel(); }}
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

      {/* Banner: pendentes que a IA ainda não classificou (a fila fica desorganizada
          sem o veredito da IA). Um clique roda a IA e organiza os baldes. */}
      {status === "pendente" && (vagas?.filter((v) => v.ai_recomendacao == null).length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-[#EBD5A8] bg-sol-tint px-4 py-2.5">
          <span className="text-[13.5px] text-ink">
            <strong>{vagas!.filter((v) => v.ai_recomendacao == null).length}</strong> vaga(s) ainda não classificadas pela IA — os baldes só ficam certos depois disso.
          </span>
          <button
            onClick={classificarPendentes}
            disabled={classificando}
            className="mono-caps rounded-full bg-mata px-3.5 py-1.5 text-[12px] font-bold tracking-normal text-white hover:bg-mata-deep disabled:opacity-60"
          >
            {classificando ? "Classificando…" : "Classificar com IA"}
          </button>
        </div>
      )}

      {/* Barra de ação em massa (só em pendentes): seleção + rejeição com 1 motivo. */}
      {status === "pendente" && (vagas?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border border-line-strong bg-surface px-4 py-2.5">
          <label className="flex items-center gap-2 text-[13px] font-bold text-ink-soft">
            <input
              type="checkbox"
              checked={visiveis.length > 0 && visiveis.every((v) => selecionadas.has(v.id))}
              onChange={() => toggleTodasVisiveis(visiveis.map((v) => v.id))}
            />
            Selecionar todas ({visiveis.length})
          </label>
          {selecionadas.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono-caps text-[11px] text-ink-faint">{selecionadas.size} selecionada(s) · rejeitar como</span>
              <select
                value={motivoMassa}
                onChange={(e) => setMotivoMassa(e.target.value)}
                className="rounded-[8px] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              >
                {MOTIVOS.map(([mv, ml]) => <option key={mv} value={mv}>{ml}</option>)}
              </select>
              <button
                onClick={rejeitarEmMassa}
                disabled={acaoMassa}
                className="rounded-[8px] bg-barro px-3.5 py-1.5 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-60"
              >
                {acaoMassa ? "Rejeitando…" : `Rejeitar ${selecionadas.size}`}
              </button>
              <button onClick={limparSel} className="text-[13px] font-bold text-ink-soft hover:text-ink">
                limpar
              </button>
            </div>
          ) : (
            <span className="text-[12.5px] text-ink-faint">
              marque as vagas fora do perfil e rejeite todas de uma vez
            </span>
          )}
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
            <div
              key={v.id}
              className={`rounded-[12px] border bg-surface p-4 ${
                selecionadas.has(v.id) ? "border-mata ring-2 ring-mata/25" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    {status === "pendente" && (
                      <input
                        type="checkbox"
                        aria-label="Selecionar para ação em massa"
                        className="mr-1 h-4 w-4 shrink-0 cursor-pointer"
                        checked={selecionadas.has(v.id)}
                        onChange={() => toggleSel(v.id)}
                      />
                    )}
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
                  {v.status_link === "inacessivel" && (
                    <p className="mt-1.5 rounded-[8px] border border-[#EBC7BE] bg-barro-tint px-2.5 py-1.5 text-[12px] leading-relaxed text-barro">
                      <span className="mono-caps text-[10px]">Fora do ar · </span>
                      Removida do portal público — o link não respondeu em 3 verificações
                      {v.mensagem_verificacao_link ? ` (${v.mensagem_verificacao_link})` : ""}
                      {v.data_ultima_verificacao_link ? ` · última checagem ${v.data_ultima_verificacao_link.slice(0, 10)}` : ""}.
                      Corrija o link em "Editar" ou rejeite a vaga.
                    </p>
                  )}
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
                  {v.imagem_fonte_url && (
                    <p className="mt-1.5 text-[12px]">
                      <button
                        type="button"
                        onClick={() => verImagemOriginal(v.imagem_fonte_url!)}
                        disabled={abrindoImagem === v.imagem_fonte_url}
                        className="mono-caps text-ceu underline underline-offset-2 hover:text-ceu disabled:opacity-60"
                      >
                        {abrindoImagem === v.imagem_fonte_url ? "Abrindo…" : "Ver print/PDF original ↗"}
                      </button>
                    </p>
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
                {(status === "pendente" || status === "aprovada" || status === "link_inativo") && (
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {status === "pendente" && (
                      <button
                        onClick={() => aprovar(v)}
                        className="rounded-[8px] bg-mata px-3.5 py-2 text-[13px] font-bold text-white hover:bg-mata-deep"
                      >
                        Aprovar
                      </button>
                    )}
                    {status === "link_inativo" && (
                      <button
                        onClick={() => republicar(v)}
                        title="Use quando conferir manualmente que o link abre normal (falso positivo do checker automático)"
                        className="rounded-[8px] bg-mata px-3.5 py-2 text-[13px] font-bold text-white hover:bg-mata-deep"
                      >
                        Republicar (verifiquei, está ativo)
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
                    <button
                      onClick={() => duplicar(v)}
                      title="Criar uma cópia editável (útil p/ concurso com vários cargos)"
                      className="rounded-[8px] border border-line-strong px-3.5 py-2 text-[13px] font-bold text-ink-soft hover:border-ceu hover:text-ceu"
                    >
                      Duplicar
                    </button>
                    {(status === "pendente" || status === "link_inativo") && (
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
