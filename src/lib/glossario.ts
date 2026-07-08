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

// Cursos do IFCE atendidos pelo BIO (curso_alvo, text[]). Código canônico → rótulos.
// `cursoLabel` = nome completo (edição); `cursoLabelCurto` = chip no card.
export const cursoLabel: Record<string, string> = {
  gestao_ambiental: "Gestão Ambiental",
  // cobre também "Engenharia Ambiental" (nome de mercado do mesmo campo)
  engenharia_sanitaria_ambiental: "Engenharia Ambiental e Sanitária",
  saneamento_ambiental: "Saneamento Ambiental",
  tecnico_meio_ambiente: "Técnico em Meio Ambiente",
  tecnico_saneamento: "Técnico em Saneamento",
};
export const cursoLabelCurto: Record<string, string> = {
  gestao_ambiental: "Gestão Ambiental",
  engenharia_sanitaria_ambiental: "Eng. Ambiental/Sanitária",
  saneamento_ambiental: "Saneamento Amb.",
  tecnico_meio_ambiente: "Téc. Meio Ambiente",
  tecnico_saneamento: "Téc. Saneamento",
};
// Opções para o multi-select de cursos (agrupadas por nível), na ordem de exibição.
export const cursosOpcoes: { codigo: string; nivel: "superior" | "tecnico" }[] = [
  { codigo: "gestao_ambiental", nivel: "superior" },
  { codigo: "engenharia_sanitaria_ambiental", nivel: "superior" },
  { codigo: "saneamento_ambiental", nivel: "superior" },
  { codigo: "tecnico_meio_ambiente", nivel: "tecnico" },
  { codigo: "tecnico_saneamento", nivel: "tecnico" },
];

export type SeloAderencia = "recomendado" | "relevante" | "superior";

// Selo de aderência: rótulo + classes visuais (tokens BIO).
export const seloAderenciaConfig: Record<
  SeloAderencia,
  { label: string; className: string; trilho: string }
> = {
  // Rótulo = FORÇA da aderência (não nomeia curso; os chips "Cursos" já dizem quais).
  // Antes dizia "Técnico em MA" fixo, o que carimbava errado vagas de nível superior.
  recomendado: {
    label: "Recomendado",
    className: "bg-mata-tint text-mata-deep border-mata-line",
    trilho: "linear-gradient(180deg, var(--mata), #4FA372)",
  },
  relevante: {
    label: "Relevante · área ambiental",
    className: "bg-surface-dim text-ink-soft border-line-strong",
    trilho: "linear-gradient(180deg, #7C9B84, #B3C4B4)",
  },
  superior: {
    label: "Área correlata",
    className: "bg-ceu-tint text-ceu border-[#C4D4E2]",
    trilho: "var(--line-strong)",
  },
};

// Opções do menu "Informar problema" (feedback do estudante).
// Rótulos e mensagens de confirmação conforme glossário institucional (F0-06).
export const feedbackOpcoes = [
  {
    tipo: "link_invalido",
    label: "O link não funciona",
    confirmacao: "Obrigado! Vamos verificar o link.",
  },
  {
    tipo: "vaga_encerrada",
    label: "A vaga já encerrou",
    confirmacao: "Obrigado! Vamos confirmar e atualizar.",
  },
  {
    tipo: "vaga_suspeita",
    label: "Esta vaga parece suspeita",
    confirmacao: "Obrigado pelo alerta. A vaga será verificada.",
  },
] as const;

// Badge de urgência derivado de score_urgencia (separado do selo de aderência).
export function urgenciaBadge(
  score: number,
): { label: string; className: string } | null {
  if (score >= 90) return { label: "Urgente", className: "bg-barro text-white border-barro" };
  if (score >= 60) return { label: "Vence em breve", className: "bg-sol-tint text-sol border-[#EBD5A8]" };
  if (score === 40) return { label: "Sem prazo definido", className: "bg-ceu-tint text-ceu border-[#C4D4E2]" };
  return null;
}
