import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TIPOS = [
  ["estagio", "Estágio"],
  ["emprego", "Emprego"],
  ["processo_seletivo", "Processo seletivo"],
  ["bolsa", "Bolsa"],
] as const;
const NIVEIS = [
  ["tecnico", "Nível técnico"],
  ["superior", "Nível superior"],
  ["ambos", "Técnico ou superior"],
] as const;
const SETORES = [
  ["publico", "Setor público"],
  ["privado", "Setor privado"],
] as const;
const MODALIDADES = [
  ["presencial", "Presencial"],
  ["remoto", "Remoto"],
  ["hibrido", "Híbrido"],
] as const;
const SUBTIPOS = [
  ["nao_aplicavel", "Não se aplica"],
  ["obrigatorio", "Estágio curricular obrigatório"],
  ["nao_obrigatorio", "Estágio não obrigatório"],
  ["extracurricular", "Estágio extracurricular"],
] as const;

const inputCls =
  "mt-1.5 block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none focus:ring-2 focus:ring-mata/15";
const labelCls = "mono-caps block text-[11px] text-ink";

function Campo({
  label,
  children,
  span2 = false,
}: {
  label: string;
  children: React.ReactNode;
  span2?: boolean;
}) {
  return (
    <label className={span2 ? "sm:col-span-2" : ""}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function CadastroVaga() {
  const qc = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const [f, setF] = useState({
    titulo: "",
    empresa_orgao: "",
    tipo: "estagio",
    subtipo_estagio: "nao_aplicavel",
    setor: "publico",
    nivel: "tecnico",
    municipio: "",
    modalidade: "presencial",
    area_tematica_id: "",
    carga_horaria: "",
    remuneracao_bolsa: "",
    requisitos: "",
    atividades: "",
    descricao: "",
    forma_candidatura: "",
    link_candidatura: "",
    sem_prazo_definido: false,
    prazo_inscricao: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) =>
    setF((p) => ({ ...p, [k]: v }));

  const { data: municipios } = useQuery({
    queryKey: ["ref_municipios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("municipios_referencia")
        .select("municipio")
        .eq("ativo", true)
        .order("municipio");
      return (data ?? []) as { municipio: string }[];
    },
  });
  const { data: areas } = useQuery({
    queryKey: ["ref_areas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("areas_tematicas")
        .select("id, label_display")
        .eq("ativo", true)
        .order("label_display");
      return (data ?? []) as { id: string; label_display: string }[];
    },
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!f.titulo.trim() || !f.empresa_orgao.trim()) {
      setMsg({ ok: false, texto: "Preencha ao menos título e empresa/órgão." });
      return;
    }
    if (!f.link_candidatura.trim() && !f.forma_candidatura.trim()) {
      setMsg({
        ok: false,
        texto: "Informe o link OU a forma de candidatura (pelo menos um).",
      });
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("vagas").insert({
      titulo: f.titulo.trim(),
      empresa_orgao: f.empresa_orgao.trim(),
      tipo: f.tipo,
      subtipo_estagio: f.tipo === "estagio" ? f.subtipo_estagio : "nao_aplicavel",
      natureza_processo:
        f.tipo === "processo_seletivo"
          ? "processo_seletivo_simplificado"
          : "nao_aplicavel",
      setor: f.setor,
      nivel: f.nivel,
      curso_alvo: ["tecnico_meio_ambiente"],
      area_tematica_id: f.area_tematica_id || null,
      municipio: f.municipio || null,
      modalidade: f.modalidade,
      carga_horaria: f.carga_horaria.trim() || null,
      remuneracao_bolsa: f.remuneracao_bolsa.trim() || null,
      requisitos: f.requisitos.trim() || null,
      atividades: f.atividades.trim() || null,
      descricao: f.descricao.trim() || null,
      forma_candidatura: f.forma_candidatura.trim() || null,
      link_candidatura: f.link_candidatura.trim() || null,
      sem_prazo_definido: f.sem_prazo_definido,
      prazo_inscricao: f.sem_prazo_definido ? null : f.prazo_inscricao || null,
      origem: "cadastro manual",
      status: "pendente",
    });
    setSalvando(false);
    if (error) {
      setMsg({ ok: false, texto: `Erro ao salvar: ${error.message}` });
      return;
    }
    setMsg({
      ok: true,
      texto: "Vaga cadastrada como pendente. Revise e aprove na fila de curadoria.",
    });
    setF((p) => ({
      ...p,
      titulo: "",
      empresa_orgao: "",
      municipio: "",
      carga_horaria: "",
      remuneracao_bolsa: "",
      requisitos: "",
      atividades: "",
      descricao: "",
      forma_candidatura: "",
      link_candidatura: "",
      prazo_inscricao: "",
    }));
    qc.invalidateQueries({ queryKey: ["admin_vagas"] });
  }

  return (
    <form onSubmit={salvar} className="max-w-[720px]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Título da vaga *" span2>
          <input
            className={inputCls}
            value={f.titulo}
            onChange={(e) => set("titulo", e.target.value)}
            placeholder="Ex.: Estágio em Monitoramento da Qualidade da Água"
          />
        </Campo>
        <Campo label="Empresa / órgão *">
          <input
            className={inputCls}
            value={f.empresa_orgao}
            onChange={(e) => set("empresa_orgao", e.target.value)}
          />
        </Campo>
        <Campo label="Tipo">
          <select
            className={inputCls}
            value={f.tipo}
            onChange={(e) => set("tipo", e.target.value)}
          >
            {TIPOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        {f.tipo === "estagio" && (
          <Campo label="Tipo de estágio">
            <select
              className={inputCls}
              value={f.subtipo_estagio}
              onChange={(e) => set("subtipo_estagio", e.target.value)}
            >
              {SUBTIPOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <Campo label="Nível">
          <select
            className={inputCls}
            value={f.nivel}
            onChange={(e) => set("nivel", e.target.value)}
          >
            {NIVEIS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Setor">
          <select
            className={inputCls}
            value={f.setor}
            onChange={(e) => set("setor", e.target.value)}
          >
            {SETORES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Município">
          <select
            className={inputCls}
            value={f.municipio}
            onChange={(e) => set("municipio", e.target.value)}
          >
            <option value="">— selecionar —</option>
            {municipios?.map((m) => (
              <option key={m.municipio} value={m.municipio}>
                {m.municipio}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Modalidade">
          <select
            className={inputCls}
            value={f.modalidade}
            onChange={(e) => set("modalidade", e.target.value)}
          >
            {MODALIDADES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Área temática">
          <select
            className={inputCls}
            value={f.area_tematica_id}
            onChange={(e) => set("area_tematica_id", e.target.value)}
          >
            <option value="">— selecionar —</option>
            {areas?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label_display}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Carga horária">
          <input
            className={inputCls}
            value={f.carga_horaria}
            onChange={(e) => set("carga_horaria", e.target.value)}
            placeholder="Ex.: 20h/semana"
          />
        </Campo>
        <Campo label="Remuneração / bolsa">
          <input
            className={inputCls}
            value={f.remuneracao_bolsa}
            onChange={(e) => set("remuneracao_bolsa", e.target.value)}
            placeholder="Ex.: R$ 800 + auxílio-transporte"
          />
        </Campo>
        <Campo label="Link de candidatura">
          <input
            className={inputCls}
            value={f.link_candidatura}
            onChange={(e) => set("link_candidatura", e.target.value)}
            placeholder="https://…"
          />
        </Campo>
        <Campo label="Forma de candidatura (se não houver link)">
          <input
            className={inputCls}
            value={f.forma_candidatura}
            onChange={(e) => set("forma_candidatura", e.target.value)}
            placeholder="Ex.: enviar CV para rh@empresa.com"
          />
        </Campo>
        <Campo label="Requisitos" span2>
          <textarea
            className={inputCls}
            rows={2}
            value={f.requisitos}
            onChange={(e) => set("requisitos", e.target.value)}
          />
        </Campo>
        <Campo label="Atividades" span2>
          <textarea
            className={inputCls}
            rows={2}
            value={f.atividades}
            onChange={(e) => set("atividades", e.target.value)}
          />
        </Campo>
        <Campo label="Descrição / resumo" span2>
          <textarea
            className={inputCls}
            rows={2}
            value={f.descricao}
            onChange={(e) => set("descricao", e.target.value)}
          />
        </Campo>
        <div className="sm:col-span-2 flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-[14px] text-ink">
            <input
              type="checkbox"
              checked={f.sem_prazo_definido}
              onChange={(e) => set("sem_prazo_definido", e.target.checked)}
            />
            Sem prazo definido
          </label>
          {!f.sem_prazo_definido && (
            <label>
              <span className={labelCls}>Prazo de inscrição</span>
              <input
                type="date"
                className={inputCls}
                value={f.prazo_inscricao}
                onChange={(e) => set("prazo_inscricao", e.target.value)}
              />
            </label>
          )}
        </div>
      </div>

      {msg && (
        <p
          className={`mt-4 rounded-[9px] border px-3 py-2.5 text-[14px] ${
            msg.ok
              ? "border-mata-line bg-mata-tint text-mata-deep"
              : "border-[#EBC7BE] bg-barro-tint text-barro"
          }`}
        >
          {msg.texto}
        </p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-[9px] bg-mata px-6 text-[15px] font-bold text-white transition-colors hover:bg-mata-deep disabled:opacity-60"
      >
        {salvando ? "Salvando…" : "Cadastrar vaga"}
      </button>
    </form>
  );
}
