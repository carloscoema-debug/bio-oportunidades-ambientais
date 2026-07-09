import { useState, type ReactNode } from "react";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { registrarFeedback } from "@/lib/feedback";
import {
  tipoLabel,
  modalidadeLabel,
  cursoLabelCurto,
  seloAderenciaConfig,
  urgenciaBadge,
  nivelUrgencia,
  feedbackOpcoes,
  type SeloAderencia,
} from "@/lib/glossario";

export interface VagaPublica {
  id: string;
  titulo: string;
  empresa_orgao: string | null;
  tipo: string;
  nivel: string;
  regiao: string;
  modalidade: string | null;
  municipio: string | null;
  carga_horaria: string | null;
  remuneracao_bolsa: string | null;
  curso_alvo: string[] | null;
  prazo_inscricao: string | null;
  sem_prazo_definido: boolean;
  data_publicacao: string | null;
  link_candidatura: string | null;
  forma_candidatura: string | null;
  score_urgencia: number;
  selo_aderencia: SeloAderencia;
  selo_parceiro: boolean;
}

const DISCLAIMER =
  "Divulgação informativa — o IFCE não conduz este processo seletivo.";

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span
      className={`mono-caps inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${className}`}
    >
      {children}
    </span>
  );
}

export function VagaCard({ vaga }: { vaga: VagaPublica }) {
  const [copiado, setCopiado] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const selo = seloAderenciaConfig[vaga.selo_aderencia];
  const badge = urgenciaBadge(vaga.score_urgencia, vaga.prazo_inscricao);
  const urgencia = nivelUrgencia(vaga.score_urgencia);
  // só aceita link http(s) — proteção final contra javascript:/data: na renderização
  const link =
    vaga.link_candidatura && /^https?:\/\//i.test(vaga.link_candidatura)
      ? vaga.link_candidatura
      : undefined;

  // não expõe a FONTE de origem como se fosse a empresa (o Canal B grava o nome da
  // fonte, ex.: "Indeed Alerts", em empresa_orgao) — o usuário não precisa ver a fonte.
  const empresa =
    vaga.empresa_orgao && !/\balert/i.test(vaga.empresa_orgao)
      ? vaga.empresa_orgao
      : null;

  // cursos do IFCE atendidos pela vaga (chips no card)
  const cursos = (vaga.curso_alvo ?? [])
    .map((c) => cursoLabelCurto[c])
    .filter(Boolean) as string[];

  const metadados = [
    tipoLabel[vaga.tipo] ?? vaga.tipo,
    vaga.municipio,
    vaga.modalidade ? modalidadeLabel[vaga.modalidade] : null,
    vaga.carga_horaria,
    vaga.remuneracao_bolsa,
  ].filter(Boolean) as string[];

  const prazoTexto = vaga.sem_prazo_definido
    ? "Sem prazo definido"
    : vaga.prazo_inscricao
      ? `Inscrições até ${format(parseISO(vaga.prazo_inscricao), "d 'de' MMMM", { locale: ptBR })}`
      : null;
  const prazoClasse =
    vaga.score_urgencia >= 90
      ? "text-barro"
      : vaga.score_urgencia >= 60
        ? "text-sol"
        : "text-ink-soft";

  const publicadaTexto = vaga.data_publicacao
    ? `Publicada no BIO em ${format(parseISO(vaga.data_publicacao), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
    : null;

  function compartilharWhatsApp() {
    const texto = link ? `${vaga.titulo} — ${link}` : vaga.titulo;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(texto)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function candidatar() {
    supabase.rpc("registrar_clique", { p_vaga_id: vaga.id }).then(() => {});
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }

  async function copiarLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* ignore */
    }
  }

  async function enviarFeedback(opcao: (typeof feedbackOpcoes)[number]) {
    // Confirmação otimista: mostramos a mensagem mesmo se for feedback repetido
    // (o banco deduplica silenciosamente). Erros de rede não expõem detalhe técnico.
    setMenuAberto(false);
    setFeedbackMsg(opcao.confirmacao);
    await registrarFeedback(vaga.id, opcao.tipo);
  }

  async function marcarCandidatura() {
    setMenuAberto(false);
    setFeedbackMsg("Boa sorte! Isso ajuda a medir o alcance das vagas.");
    await registrarFeedback(vaga.id, "me_candidatei");
  }

  // Destaque de PRAZO no card inteiro (não só o badge) — some sozinho quando não
  // há prazo definido ou faltam mais de 7 dias; some espontaneamente quando o
  // cron de expiração remove a vaga (não precisa de lógica extra aqui).
  const tomPrazo =
    urgencia === "urgente"
      ? "border-barro/45 bg-barro-tint/35 hover:border-barro/65"
      : urgencia === "breve"
        ? "border-sol/50 bg-sol-tint/35 hover:border-sol/70"
        : "border-line bg-surface hover:border-mata-line";

  return (
    <article
      className={`group relative overflow-hidden rounded-[18px] border p-5 pb-4 shadow-[var(--shadow-card)] transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out hover:-translate-y-1 hover:shadow-[var(--shadow-card-hover)] sm:p-6 sm:pb-5 ${tomPrazo}`}
    >
      {/* trilho de aderência */}
      <span
        className="absolute inset-y-0 left-0 w-[5px] transition-[width] duration-300 group-hover:w-[7px]"
        style={{ background: selo.trilho }}
        aria-hidden
      />

      {/* selos + badge */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Pill className={selo.className}>{selo.label}</Pill>
        {badge && (
          <Pill className={badge.className}>
            {urgencia === "urgente" && (
              <span className="relative flex h-[6px] w-[6px]" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70 motion-reduce:hidden" />
                <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-white" />
              </span>
            )}
            {badge.label}
          </Pill>
        )}
        {vaga.selo_parceiro && (
          <Pill className="border-dashed border-line-strong bg-surface text-ink-soft">
            Parceiro do curso
          </Pill>
        )}
      </div>

      <h2 className="font-display text-[20px] font-bold leading-[1.22] tracking-[-0.01em] text-ink">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => supabase.rpc("registrar_clique", { p_vaga_id: vaga.id })}
            className="hover:text-mata-deep hover:underline hover:decoration-2 hover:underline-offset-[3px]"
          >
            {vaga.titulo}
          </a>
        ) : (
          vaga.titulo
        )}
      </h2>

      {empresa && (
        <p className="mt-0.5 text-[14.5px] font-bold text-ink-soft">
          {empresa}
        </p>
      )}

      <div className="mono-caps mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[12.5px] font-medium normal-case tracking-normal text-ink-soft">
        {metadados.map((m, i) => (
          <span key={i}>
            {i > 0 && <span className="mr-3 text-ink-faint">◦</span>}
            {m}
          </span>
        ))}
      </div>

      {cursos.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mono-caps text-[10.5px] text-ink-faint">Cursos:</span>
          {cursos.map((c) => (
            <span
              key={c}
              className="mono-caps rounded-full border border-mata-line bg-mata-tint px-2 py-0.5 text-[10.5px] text-mata-deep"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      {prazoTexto && (
        <p className={`mt-3 text-[14px] ${prazoClasse}`}>
          <span className="font-bold">{prazoTexto}</span>
        </p>
      )}

      {publicadaTexto && (
        <p className="mono-caps mt-2 text-[11px] tracking-normal text-ink-faint">
          {publicadaTexto}
        </p>
      )}

      {/* ações */}
      <div className="mt-5 flex flex-wrap gap-2.5">
        {link && (
          <button
            onClick={candidatar}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-1.5 rounded-[11px] bg-mata px-4 text-[15px] font-bold text-white shadow-[0_1px_2px_rgba(10,79,51,0.25)] transition-all duration-200 hover:-translate-y-px hover:bg-mata-deep hover:shadow-[0_4px_14px_-4px_rgba(10,79,51,0.4)]"
          >
            Candidatar-se
            <span aria-hidden className="text-[13px] transition-transform duration-200 group-hover:translate-x-0.5">↗</span>
          </button>
        )}
        <button
          onClick={compartilharWhatsApp}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-line-strong bg-surface px-4 text-[15px] font-bold text-ink transition-all duration-200 hover:-translate-y-px hover:border-whatsapp hover:text-whatsapp"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-whatsapp" aria-hidden>
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.4 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.2-4.7-4.1-4.9-4.3-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.9 1.5 2 2.4 1.4 1.2 2.5 1.6 2.9 1.7.3.2.5.1.7-.1l1-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4.1.1.1.7-.1 1.3Z" />
          </svg>
          Compartilhar
        </button>
        {link && (
          <button
            onClick={copiarLink}
            title="Copiar link"
            aria-label="Copiar link da vaga"
            className="inline-flex min-h-[48px] items-center justify-center rounded-[11px] border-[1.5px] border-line-strong bg-surface px-3.5 text-[15px] text-ink-soft transition-colors hover:border-ink hover:text-ink"
          >
            {copiado ? "✓" : "⧉"}
          </button>
        )}
      </div>

      {/* rodapé do card */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-line pt-3">
        <span className="max-w-[38ch] text-[12.5px] text-ink-faint">
          {DISCLAIMER}
        </span>
        {feedbackMsg ? (
          <span className="text-[13px] font-bold text-mata-deep">
            ✓ {feedbackMsg}
          </span>
        ) : (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={marcarCandidatura}
              className="text-[13px] font-bold text-mata-deep underline decoration-dotted underline-offset-[3px] hover:text-mata"
            >
              Já me candidatei
            </button>
            <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuAberto}
              onClick={() => setMenuAberto((v) => !v)}
              className="text-[13px] font-bold text-ink-soft underline decoration-dotted underline-offset-[3px] hover:text-barro"
            >
              Informar problema
            </button>
            {menuAberto && (
              <>
                {/* fecha ao clicar fora */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuAberto(false)}
                  aria-hidden
                />
                {/* abre para cima, dentro do card (evita clip do overflow-hidden) */}
                <div
                  role="menu"
                  className="absolute bottom-full right-0 z-50 mb-2 w-60 overflow-hidden rounded-[9px] border border-line bg-surface p-1 shadow-[0_10px_30px_-10px_rgba(27,42,33,0.35)]"
                >
                  {feedbackOpcoes.map((opcao) => (
                    <button
                      key={opcao.tipo}
                      type="button"
                      role="menuitem"
                      onClick={() => enviarFeedback(opcao)}
                      className="block w-full rounded-[6px] px-3 py-2.5 text-left text-[14px] text-ink hover:bg-surface-dim"
                    >
                      {opcao.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
