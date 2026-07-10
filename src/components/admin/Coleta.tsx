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
const STATUS_EMAIL: Record<string, { label: string; cls: string }> = {
  processado: { label: "Processado", cls: "bg-mata-tint text-mata-deep border-mata-line" },
  reprocessado: { label: "Reprocessado", cls: "bg-surface-dim text-ink-soft border-line-strong" },
  nao_reconhecido: { label: "Não reconhecido", cls: "bg-sol-tint text-sol border-[#EBD5A8]" },
  erro: { label: "Erro", cls: "bg-barro-tint text-barro border-[#EBC7BE]" },
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
  const [reprocessando, setReprocessando] = useState<string | null>(null);
  const [msgEmail, setMsgEmail] = useState<string | null>(null);
  const [classificando, setClassificando] = useState(false);
  const [msgIa, setMsgIa] = useState<string | null>(null);

  // Canal D — print/PDF assistido por IA
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [msgUpload, setMsgUpload] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"];

  function validarArquivo(f: File | null | undefined): f is File {
    if (!f) return false;
    if (!TIPOS_ACEITOS.includes(f.type)) {
      setMsgUpload({ tipo: "erro", texto: "Formato não aceito — use PNG, JPG, WEBP, HEIC ou PDF." });
      return false;
    }
    if (f.size > 8 * 1024 * 1024) {
      setMsgUpload({ tipo: "erro", texto: "Arquivo maior que 8MB — reduza o tamanho e tente de novo." });
      return false;
    }
    return true;
  }

  function definirArquivo(f: File) {
    setMsgUpload(null);
    setArquivo(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  function onSelecionarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (validarArquivo(f)) definirArquivo(f);
    e.target.value = "";
  }
  function onDropArquivo(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (validarArquivo(f)) definirArquivo(f);
  }
  function onPasteArquivo(e: React.ClipboardEvent) {
    const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
    const f = item?.getAsFile();
    if (validarArquivo(f)) definirArquivo(f);
  }
  function limparArquivo() {
    setArquivo(null);
    setPreview(null);
    setMsgUpload(null);
  }

  function arquivoParaBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });
  }

  async function enviarImagem() {
    if (!arquivo) return;
    setEnviandoImagem(true);
    setMsgUpload(null);
    try {
      const imagem_base64 = await arquivoParaBase64(arquivo);
      const { data, error } = await supabase.functions.invoke("extrair-vaga-imagem", {
        body: { imagem_base64, mime_type: arquivo.type },
      });
      const r = data as
        | { ok?: boolean; titulo?: string; recomendacao?: string; motivo?: string; detalhe?: string; erro?: string }
        | null;
      if (error || !r?.ok) {
        const texto =
          r?.motivo === "nao_e_vaga"
            ? (r.detalhe ?? "Isso não parece ser uma vaga.")
            : (r?.erro ?? "Não foi possível ler a imagem agora. Tente novamente.");
        setMsgUpload({ tipo: "erro", texto });
        return;
      }
      setMsgUpload({
        tipo: "ok",
        texto: `Vaga extraída: "${r.titulo}" — já está na fila de curadoria (IA: ${r.recomendacao}). Confira na aba "Fila de curadoria".`,
      });
      setArquivo(null);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["admin_vagas"] });
      qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
    } finally {
      setEnviandoImagem(false);
    }
  }

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

  const { data: emails } = useQuery({
    queryKey: ["coleta_emails"],
    queryFn: async () => {
      const { data } = await supabase
        .from("emails_recebidos")
        .select("id, remetente, assunto, status_parsing, vagas_geradas, created_at")
        .order("created_at", { ascending: false })
        .limit(15);
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

  async function classificarAgora() {
    setMsgIa(null);
    setClassificando(true);
    const { data, error } = await supabase.functions.invoke("classificar-vagas");
    setClassificando(false);
    const r = data as { classificadas?: number; resumo?: Record<string, number> } | null;
    if (error) {
      setMsgIa("Não foi possível classificar agora. Tente novamente.");
      return;
    }
    const n = r?.classificadas ?? 0;
    const s = r?.resumo;
    setMsgIa(
      n === 0
        ? "Nenhuma vaga pendente para classificar."
        : `IA classificou ${n} vaga(s)${s ? ` · ${s.aprovar ?? 0} aprovar / ${s.revisar ?? 0} revisar / ${s.descartar ?? 0} descartar` : ""}.`,
    );
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
    qc.invalidateQueries({ queryKey: ["admin_dashboard"] });
  }

  async function reprocessar(id: string) {
    setMsgEmail(null);
    setReprocessando(id);
    const { data, error } = await supabase.functions.invoke("reprocessar-email", {
      body: { email_id: id },
    });
    setReprocessando(null);
    const r = data as { reconhecido?: boolean; novas?: number } | null;
    if (error) {
      setMsgEmail("Não foi possível reprocessar. Tente novamente.");
    } else if (r?.reconhecido) {
      setMsgEmail(`Reprocessado: ${r.novas ?? 0} vaga(s) nova(s) na fila.`);
    } else {
      setMsgEmail("Reprocessado, mas o remetente ainda não está mapeado numa fonte.");
    }
    qc.invalidateQueries({ queryKey: ["coleta_emails"] });
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
            A coleta roda sozinha (6h e 15h). Fontes RSS/Atom viram vagas
            <strong className="text-ink"> pendentes</strong> na fila; a curadoria
            segue sendo sua. A <strong className="text-ink">IA</strong> lê cada vaga e
            sugere aprovar/revisar/descartar. Você pode disparar os dois agora.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            onClick={coletarAgora}
            disabled={rodando}
            className="rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-60"
          >
            {rodando ? "Coletando…" : "Coletar agora"}
          </button>
          <button
            onClick={classificarAgora}
            disabled={classificando}
            className="rounded-[9px] border-[1.5px] border-mata-line bg-surface px-5 py-2.5 text-[14px] font-bold text-mata-deep hover:border-mata hover:bg-mata-tint disabled:opacity-60"
          >
            {classificando ? "Classificando…" : "Classificar com IA"}
          </button>
        </div>
      </div>

      {msgIa && (
        <p className="rounded-[9px] border border-mata-line bg-mata-tint px-3 py-2.5 text-[14px] text-mata-deep">
          {msgIa}
        </p>
      )}

      {/* Canal D — print/PDF assistido por IA */}
      <div className="rounded-[16px] border border-mata-line bg-mata-tint/30 p-4 sm:p-5">
        <p className="mono-caps text-[11px] text-mata-deep">Canal D · print / PDF</p>
        <h3 className="mt-1 font-display text-[17px] font-bold text-ink">
          Enviar print ou PDF de uma vaga
        </h3>
        <p className="mt-1 max-w-[64ch] text-[13.5px] leading-relaxed text-ink-soft">
          Cole (Ctrl/Cmd+V), arraste ou selecione um flyer de empresa, captura de tela
          de site, ou PDF recebido por grupo/e-mail. A IA lê a imagem inteira e já
          cria a vaga pendente na fila — a curadoria segue no controle, como nos
          outros canais.
        </p>

        <div
          onPaste={onPasteArquivo}
          onDrop={onDropArquivo}
          onDragOver={(e) => e.preventDefault()}
          tabIndex={0}
          aria-label="Área para colar ou soltar o print/PDF da vaga"
          className="mt-3 flex min-h-[130px] flex-col items-center justify-center gap-2.5 rounded-[12px] border-2 border-dashed border-mata-line bg-surface px-4 py-6 text-center focus:outline-none focus:ring-2 focus:ring-mata/30"
        >
          {preview ? (
            <img
              src={preview}
              alt="Pré-visualização do print enviado"
              className="max-h-[170px] rounded-[8px] border border-line object-contain"
            />
          ) : arquivo ? (
            <p className="text-[13.5px] font-bold text-ink">📄 {arquivo.name}</p>
          ) : (
            <>
              <p className="text-[13.5px] text-ink-soft">
                Cole aqui (Ctrl/Cmd+V) ou arraste a imagem/PDF
              </p>
              <label className="mono-caps cursor-pointer rounded-full border-[1.5px] border-line-strong bg-surface px-3.5 py-1.5 text-[11px] text-ink-soft hover:border-mata hover:text-mata-deep">
                ou selecionar arquivo
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
                  className="hidden"
                  onChange={onSelecionarArquivo}
                />
              </label>
            </>
          )}
        </div>

        {msgUpload && (
          <p
            className={`mt-3 rounded-[9px] border px-3 py-2.5 text-[13.5px] ${
              msgUpload.tipo === "ok"
                ? "border-mata-line bg-mata-tint text-mata-deep"
                : "border-[#EBC7BE] bg-barro-tint text-barro"
            }`}
          >
            {msgUpload.texto}
          </p>
        )}

        {arquivo && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={enviarImagem}
              disabled={enviandoImagem}
              className="rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-60"
            >
              {enviandoImagem ? "Lendo com IA…" : "Extrair vaga com IA"}
            </button>
            <button
              onClick={limparArquivo}
              disabled={enviandoImagem}
              className="rounded-[9px] border border-line-strong px-4 py-2.5 text-[14px] font-bold text-ink-soft hover:border-barro hover:text-barro disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        )}
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

      {/* E-mails recebidos (Canal B) */}
      <div>
        <p className="mono-caps mb-3 text-[11px] text-ink-faint">
          E-mails recebidos (Canal B)
        </p>
        {msgEmail && (
          <p className="mb-2 rounded-[9px] border border-mata-line bg-mata-tint px-3 py-2 text-[13px] text-mata-deep">
            {msgEmail}
          </p>
        )}
        <div className="grid gap-2">
          {emails?.length === 0 && (
            <p className="text-[13px] text-ink-soft">
              Nenhum e-mail recebido ainda. Quando os alertas do Indeed/LinkedIn
              chegarem à caixa, eles aparecem aqui.
            </p>
          )}
          {emails?.map((em) => {
            const s = STATUS_EMAIL[em.status_parsing] ?? STATUS_EMAIL.nao_reconhecido;
            const podeReprocessar =
              em.status_parsing === "nao_reconhecido" || em.status_parsing === "erro";
            return (
              <div
                key={em.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-3.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-ink">
                    {em.assunto || "(sem assunto)"}
                  </p>
                  <p className="mono-caps text-[11px] text-ink-faint">
                    {em.remetente || "(remetente vazio)"} · {desde(em.created_at)}
                    {em.vagas_geradas > 0 && ` · ${em.vagas_geradas} vaga(s)`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`mono-caps inline-flex rounded-full border px-2 py-0.5 text-[10.5px] ${s.cls}`}
                  >
                    {s.label}
                  </span>
                  {podeReprocessar && (
                    <button
                      onClick={() => reprocessar(em.id)}
                      disabled={reprocessando === em.id}
                      className="mono-caps rounded-full border border-line-strong px-2.5 py-1 text-[10.5px] text-ink-soft hover:border-mata hover:text-mata disabled:opacity-60"
                    >
                      {reprocessando === em.id ? "…" : "Reprocessar"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
