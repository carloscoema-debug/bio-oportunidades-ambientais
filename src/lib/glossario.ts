// Glossário institucional (F0-06): mapeia valores de ENUM para rótulos amigáveis.
// Regra do projeto: o estudante nunca vê o valor cru do ENUM.

export const tipoLabel: Record<string, string> = {
  estagio: "Estágio",
  emprego: "Emprego",
  processo_seletivo: "Processo seletivo",
  bolsa: "Bolsa",
};

export const modalidadeLabel: Record<string, string> = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
};

export const nivelLabel: Record<string, string> = {
  tecnico: "Nível técnico",
  superior: "Nível superior",
  ambos: "Técnico ou superior",
};

export type SeloAderencia = "recomendado" | "relevante" | "superior";

// Selo de aderência: rótulo + classes visuais (tokens BIO).
export const seloAderenciaConfig: Record<
  SeloAderencia,
  { label: string; className: string; trilho: string }
> = {
  recomendado: {
    label: "Recomendado · Técnico em MA",
    className: "bg-mata-tint text-mata-deep border-mata-line",
    trilho: "linear-gradient(180deg, var(--mata), #4FA372)",
  },
  relevante: {
    label: "Relevante · área ambiental",
    className: "bg-surface-dim text-ink-soft border-line-strong",
    trilho: "linear-gradient(180deg, #7C9B84, #B3C4B4)",
  },
  superior: {
    label: "Nível superior / afins",
    className: "bg-ceu-tint text-ceu border-[#C4D4E2]",
    trilho: "var(--line-strong)",
  },
};

// Badge de urgência derivado de score_urgencia (separado do selo de aderência).
export function urgenciaBadge(
  score: number,
): { label: string; className: string } | null {
  if (score >= 90) return { label: "Urgente", className: "bg-barro text-white border-barro" };
  if (score >= 60) return { label: "Vence em breve", className: "bg-sol-tint text-sol border-[#EBD5A8]" };
  if (score === 40) return { label: "Sem prazo definido", className: "bg-ceu-tint text-ceu border-[#C4D4E2]" };
  return null;
}
