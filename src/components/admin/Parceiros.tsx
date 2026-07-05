import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const TIPOS = [
  ["empresa_privada", "Empresa privada"],
  ["orgao_publico", "Órgão público"],
  ["ong", "ONG"],
  ["consultoria", "Consultoria"],
  ["laboratorio", "Laboratório"],
] as const;
const TIPO_LABEL: Record<string, string> = Object.fromEntries(TIPOS);

const inputCls =
  "block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none";

const FORM_VAZIO = {
  nome: "", tipo: "empresa_privada", municipio: "", area_atuacao: "",
  cnpj: "", contato_nome: "", contato_email: "", contato_telefone: "",
  criterio: false, observacoes: "",
};

export function Parceiros() {
  const qc = useQueryClient();
  const [form, setForm] = useState(FORM_VAZIO);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const { data: parceiros } = useQuery({
    queryKey: ["admin_parceiros"],
    queryFn: async () => {
      const { data } = await supabase
        .from("parceiros")
        .select("*")
        .order("criterio_parceiro_atendido", { ascending: false })
        .order("nome");
      return data ?? [];
    },
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    setMsg(null);
    const { error } = await supabase.from("parceiros").insert({
      nome: form.nome.trim(),
      tipo: form.tipo,
      municipio: form.municipio.trim() || null,
      area_atuacao: form.area_atuacao.trim() || null,
      cnpj: form.cnpj.trim() || null,
      contato_nome: form.contato_nome.trim() || null,
      contato_email: form.contato_email.trim() || null,
      contato_telefone: form.contato_telefone.trim() || null,
      criterio_parceiro_atendido: form.criterio,
      observacoes: form.observacoes.trim() || null,
    });
    setSalvando(false);
    if (error) {
      setMsg({ tipo: "erro", texto: "Não foi possível salvar. Confira os dados." });
      return;
    }
    setMsg({ tipo: "ok", texto: "Parceiro cadastrado." });
    setForm(FORM_VAZIO);
    setMostrarForm(false);
    qc.invalidateQueries({ queryKey: ["admin_parceiros"] });
  }

  async function toggle(id: string, campo: string, valor: boolean) {
    await supabase.from("parceiros").update({ [campo]: valor }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin_parceiros"] });
    qc.invalidateQueries({ queryKey: ["vagas_publicas"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[20px] font-bold text-ink">Parceiros</h2>
          <p className="mt-1 max-w-[62ch] text-[14px] text-ink-soft">
            Instituições que colaboram com o curso. Marcar <strong className="text-ink">
            "critério atendido"</strong> faz o selo <strong className="text-ink">
            "Parceiro do curso"</strong> aparecer no portal nas vagas atribuídas a elas.
          </p>
        </div>
        <button
          onClick={() => setMostrarForm((v) => !v)}
          className="shrink-0 rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep"
        >
          {mostrarForm ? "Fechar" : "Novo parceiro"}
        </button>
      </div>

      {msg && (
        <p className={`rounded-[9px] border px-3 py-2.5 text-[14px] ${
          msg.tipo === "ok" ? "border-mata-line bg-mata-tint text-mata-deep" : "border-[#EBC7BE] bg-barro-tint text-barro"
        }`}>{msg.texto}</p>
      )}

      {mostrarForm && (
        <form onSubmit={salvar} className="space-y-4 rounded-[12px] border border-line bg-surface-dim/40 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Nome *</span>
              <input required value={form.nome} onChange={(e) => set("nome", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Tipo</span>
              <select value={form.tipo} onChange={(e) => set("tipo", e.target.value)} className={`mt-1.5 ${inputCls}`}>
                {TIPOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Município</span>
              <input value={form.municipio} onChange={(e) => set("municipio", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Área de atuação</span>
              <input value={form.area_atuacao} onChange={(e) => set("area_atuacao", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">CNPJ</span>
              <input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Contato — nome</span>
              <input value={form.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Contato — e-mail</span>
              <input type="email" value={form.contato_email} onChange={(e) => set("contato_email", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
            <label className="block">
              <span className="mono-caps block text-[11px] text-ink">Contato — telefone</span>
              <input value={form.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} className={`mt-1.5 ${inputCls}`} />
            </label>
          </div>
          <label className="block">
            <span className="mono-caps block text-[11px] text-ink">Observações</span>
            <textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} className={`mt-1.5 ${inputCls}`} />
          </label>
          <label className="flex items-center gap-2.5 text-[14px] text-ink">
            <input type="checkbox" checked={form.criterio} onChange={(e) => set("criterio", e.target.checked)} className="h-4 w-4 accent-[#0D6B44]" />
            Critério de parceiro atendido (exibe o selo no portal)
          </label>
          <button type="submit" disabled={salvando} className="rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-60">
            {salvando ? "Salvando…" : "Salvar parceiro"}
          </button>
        </form>
      )}

      <div className="grid gap-2">
        {(parceiros ?? []).length === 0 && (
          <p className="rounded-[12px] border border-line bg-surface p-6 text-center text-[14px] text-ink-soft">
            Nenhum parceiro cadastrado ainda.
          </p>
        )}
        {(parceiros ?? []).map((p) => (
          <div key={p.id} className="rounded-[12px] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  {p.criterio_parceiro_atendido && (
                    <span className="mono-caps rounded-full border border-mata-line bg-mata-tint px-2 py-0.5 text-[10.5px] text-mata-deep">Qualificado</span>
                  )}
                  {!p.ativo && (
                    <span className="mono-caps rounded-full border border-line-strong bg-surface-dim px-2 py-0.5 text-[10.5px] text-ink-soft">Inativo</span>
                  )}
                  {p.cnpj_verificado && (
                    <span className="mono-caps rounded-full border border-line-strong bg-surface-dim px-2 py-0.5 text-[10.5px] text-ink-soft">CNPJ verificado</span>
                  )}
                </div>
                <p className="font-display text-[16px] font-bold text-ink">{p.nome}</p>
                <p className="mono-caps mt-0.5 text-[11.5px] text-ink-soft">
                  {[TIPO_LABEL[p.tipo] ?? p.tipo, p.municipio, p.area_atuacao].filter(Boolean).join(" · ")}
                </p>
                {(p.contato_email || p.contato_telefone) && (
                  <p className="mt-1 text-[12.5px] text-ink-soft">
                    {[p.contato_nome, p.contato_email, p.contato_telefone].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-1.5 text-[12px]">
                <button
                  onClick={() => toggle(p.id, "criterio_parceiro_atendido", !p.criterio_parceiro_atendido)}
                  className="mono-caps rounded-full border border-line-strong px-2.5 py-1 text-ink-soft hover:border-mata hover:text-mata"
                >
                  {p.criterio_parceiro_atendido ? "Remover selo" : "Marcar qualificado"}
                </button>
                <button
                  onClick={() => toggle(p.id, "ativo", !p.ativo)}
                  className="mono-caps rounded-full border border-line-strong px-2.5 py-1 text-ink-soft hover:border-barro hover:text-barro"
                >
                  {p.ativo ? "Desativar" : "Reativar"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
