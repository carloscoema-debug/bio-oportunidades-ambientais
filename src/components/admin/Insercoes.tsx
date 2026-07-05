import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const VINCULOS = [
  ["estagio", "Estágio"],
  ["emprego_clt", "Emprego (CLT)"],
  ["emprego_pj", "Emprego (PJ)"],
  ["bolsa", "Bolsa"],
  ["voluntario", "Voluntário"],
] as const;
const ORIGENS = [
  ["autodeclaracao", "Autodeclaração"],
  ["indicacao_docente", "Indicação de docente"],
  ["comprovante_tce", "Comprovante / TCE"],
  ["suap", "SUAP"],
  ["outros", "Outros"],
] as const;
const VINCULO_LABEL: Record<string, string> = Object.fromEntries(VINCULOS);

const inputCls =
  "mt-1.5 block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none";
const labelCls = "mono-caps block text-[11px] text-ink";

const FORM_VAZIO = {
  nome_estudante: "", matricula_estudante: "", empresa_orgao: "",
  tipo_vinculo: "estagio", origem_registro: "autodeclaracao",
  data_inicio: "", vaga_id: "", observacoes: "",
};

export function Insercoes() {
  const qc = useQueryClient();
  const [f, setF] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const { data: insercoes } = useQuery({
    queryKey: ["admin_insercoes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("insercoes_profissionais")
        .select("id, nome_estudante, empresa_orgao, tipo_vinculo, data_inicio, created_at")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });
  const { data: vagas } = useQuery({
    queryKey: ["insercoes_vagas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vagas").select("id, titulo, empresa_orgao").eq("status", "aprovada").order("titulo");
      return data ?? [];
    },
  });

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!f.nome_estudante.trim() && !f.matricula_estudante.trim()) {
      setMsg({ ok: false, texto: "Informe ao menos nome ou matrícula do estudante." });
      return;
    }
    setSalvando(true);
    setMsg(null);
    const { error } = await supabase.from("insercoes_profissionais").insert({
      nome_estudante: f.nome_estudante.trim() || null,
      matricula_estudante: f.matricula_estudante.trim() || null,
      empresa_orgao: f.empresa_orgao.trim() || null,
      tipo_vinculo: f.tipo_vinculo,
      origem_registro: f.origem_registro,
      data_inicio: f.data_inicio || null,
      vaga_id: f.vaga_id || null,
      observacoes: f.observacoes.trim() || null,
    });
    setSalvando(false);
    if (error) {
      setMsg({ ok: false, texto: "Não foi possível registrar." });
      return;
    }
    setMsg({ ok: true, texto: "Inserção registrada." });
    setF(FORM_VAZIO);
    qc.invalidateQueries({ queryKey: ["admin_insercoes"] });
    qc.invalidateQueries({ queryKey: ["relatorio_insercoes"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-[20px] font-bold text-ink">Inserções profissionais</h2>
        <p className="mt-1 max-w-[64ch] text-[14px] text-ink-soft">
          Registro de estudantes/egressos que conseguiram estágio ou emprego — indicador de
          empregabilidade do curso. Uso interno; dados tratados como política pública (LGPD).
        </p>
      </div>

      {msg && (
        <p className={`rounded-[9px] border px-3 py-2.5 text-[14px] ${
          msg.ok ? "border-mata-line bg-mata-tint text-mata-deep" : "border-[#EBC7BE] bg-barro-tint text-barro"
        }`}>{msg.texto}</p>
      )}

      <form onSubmit={salvar} className="grid gap-4 rounded-[12px] border border-line bg-surface-dim/40 p-4 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Nome do estudante</span>
          <input className={inputCls} value={f.nome_estudante} onChange={(e) => set("nome_estudante", e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Matrícula</span>
          <input className={inputCls} value={f.matricula_estudante} onChange={(e) => set("matricula_estudante", e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Empresa / órgão</span>
          <input className={inputCls} value={f.empresa_orgao} onChange={(e) => set("empresa_orgao", e.target.value)} />
        </label>
        <label>
          <span className={labelCls}>Tipo de vínculo</span>
          <select className={inputCls} value={f.tipo_vinculo} onChange={(e) => set("tipo_vinculo", e.target.value)}>
            {VINCULOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>Origem do registro</span>
          <select className={inputCls} value={f.origem_registro} onChange={(e) => set("origem_registro", e.target.value)}>
            {ORIGENS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>Data de início</span>
          <input type="date" className={inputCls} value={f.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelCls}>Vaga relacionada (opcional)</span>
          <select className={inputCls} value={f.vaga_id} onChange={(e) => set("vaga_id", e.target.value)}>
            <option value="">— nenhuma —</option>
            {vagas?.map((v) => (
              <option key={v.id} value={v.id}>{v.titulo}{v.empresa_orgao ? ` — ${v.empresa_orgao}` : ""}</option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2">
          <span className={labelCls}>Observações</span>
          <textarea className={inputCls} rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={salvando} className="rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-60">
            {salvando ? "Salvando…" : "Registrar inserção"}
          </button>
        </div>
      </form>

      <div>
        <p className="mono-caps mb-3 text-[11px] text-ink-faint">
          Registradas · {(insercoes ?? []).length}
        </p>
        <div className="grid gap-2">
          {(insercoes ?? []).length === 0 && (
            <p className="text-[13px] text-ink-soft">Nenhuma inserção registrada ainda.</p>
          )}
          {(insercoes ?? []).map((i) => (
            <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-3.5 py-2.5">
              <span className="text-[13.5px] text-ink">
                <strong>{i.nome_estudante ?? "—"}</strong>
                {i.empresa_orgao ? ` · ${i.empresa_orgao}` : ""}
              </span>
              <span className="mono-caps text-[11.5px] text-ink-soft">
                {VINCULO_LABEL[i.tipo_vinculo] ?? i.tipo_vinculo}
                {i.data_inicio ? ` · ${format(parseISO(i.data_inicio), "dd/MM/yyyy")}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
