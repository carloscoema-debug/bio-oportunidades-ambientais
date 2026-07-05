import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const desde = (iso: string | null) =>
  iso ? `há ${formatDistanceToNow(new Date(iso), { locale: ptBR })}` : "—";

export function Newsletter() {
  const qc = useQueryClient();
  const [selec, setSelec] = useState<Set<string>>(new Set());
  const [assunto, setAssunto] = useState("BIO · novas oportunidades ambientais");
  const [testeEmail, setTesteEmail] = useState("");
  const [rodando, setRodando] = useState<null | "teste" | "envio">(null);
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  const { data: vagas } = useQuery({
    queryKey: ["nl_vagas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vagas")
        .select("id, titulo, empresa_orgao, regiao, data_envio_newsletter")
        .eq("status", "aprovada")
        .order("data_envio_newsletter", { ascending: true, nullsFirst: true })
        .order("data_publicacao", { ascending: false });
      return data ?? [];
    },
  });

  const { data: assinantes } = useQuery({
    queryKey: ["nl_assinantes"],
    queryFn: async () => {
      const { count } = await supabase
        .from("assinantes_email")
        .select("id", { count: "exact", head: true })
        .eq("ativo", true);
      return count ?? 0;
    },
  });

  const { data: envios } = useQuery({
    queryKey: ["nl_envios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes_enviadas")
        .select("id, data_envio, assunto, total_destinatarios, status_envio")
        .order("data_envio", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // pré-seleciona as vagas ainda não enviadas (fecha o ciclo do aviso semanal)
  const preselecionou = useRef(false);
  useEffect(() => {
    if (preselecionou.current || !vagas || vagas.length === 0) return;
    preselecionou.current = true;
    const novas = vagas.filter((v) => !v.data_envio_newsletter).map((v) => v.id);
    if (novas.length > 0) setSelec(new Set(novas));
  }, [vagas]);

  const ids = [...selec];
  const novasCount = (vagas ?? []).filter((v) => !v.data_envio_newsletter).length;

  function toggle(id: string) {
    setSelec((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function todas() {
    setSelec(new Set((vagas ?? []).map((v) => v.id)));
  }

  async function invocar(payload: Record<string, unknown>) {
    return supabase.functions.invoke("enviar-newsletter", { body: payload });
  }

  async function enviarTeste() {
    if (ids.length === 0 || !testeEmail.trim()) return;
    setMsg(null);
    setRodando("teste");
    const { data, error } = await invocar({
      vaga_ids: ids,
      assunto,
      teste_para: testeEmail.trim(),
    });
    setRodando(null);
    const ok = (data as { ok?: boolean } | null)?.ok;
    setMsg(
      error || !ok
        ? { tipo: "erro", texto: "Falha ao enviar o teste." }
        : { tipo: "ok", texto: `Teste enviado para ${testeEmail.trim()}.` },
    );
  }

  async function enviar() {
    if (ids.length === 0) return;
    setConfirmando(false);
    setMsg(null);
    setRodando("envio");
    const { data, error } = await invocar({ vaga_ids: ids, assunto });
    setRodando(null);
    const r = data as { ok?: boolean; enviados?: number; status?: string } | null;
    if (error || !r?.ok) {
      setMsg({ tipo: "erro", texto: "Não foi possível enviar a newsletter." });
      return;
    }
    setMsg({ tipo: "ok", texto: `Newsletter enviada para ${r.enviados ?? 0} assinante(s).` });
    setSelec(new Set());
    qc.invalidateQueries({ queryKey: ["nl_envios"] });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-[20px] font-bold text-ink">Newsletter</h2>
        <p className="mt-1 max-w-[62ch] text-[14px] text-ink-soft">
          Selecione as vagas, revise o assunto e envie o boletim para{" "}
          <strong className="text-ink">{assinantes ?? 0}</strong> assinante(s) ativo(s).
          Envie um teste para você antes do disparo real.
        </p>
      </div>

      {msg && (
        <p
          className={`rounded-[9px] border px-3 py-2.5 text-[14px] ${
            msg.tipo === "ok"
              ? "border-mata-line bg-mata-tint text-mata-deep"
              : "border-[#EBC7BE] bg-barro-tint text-barro"
          }`}
        >
          {msg.texto}
        </p>
      )}

      {/* Assunto */}
      <div>
        <label className="mono-caps block text-[11px] text-ink-soft">Assunto</label>
        <input
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          className="mt-1.5 block w-full rounded-[9px] border border-line-strong bg-surface px-3 py-2.5 text-[14px] text-ink focus:border-mata focus:outline-none"
        />
      </div>

      {/* Vagas */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="mono-caps text-[11px] text-ink-faint">
            Vagas a incluir · {selec.size} selecionada(s)
            {novasCount > 0 && ` · ${novasCount} nova(s) pré-selecionada(s)`}
          </p>
          <div className="flex gap-2">
            <button onClick={todas} className="mono-caps text-[11px] text-mata-deep hover:underline">
              Selecionar todas
            </button>
            <button onClick={() => setSelec(new Set())} className="mono-caps text-[11px] text-ink-soft hover:underline">
              Limpar
            </button>
          </div>
        </div>
        <div className="grid gap-2">
          {(vagas ?? []).length === 0 && (
            <p className="text-[13px] text-ink-soft">Nenhuma vaga aprovada para incluir.</p>
          )}
          {(vagas ?? []).map((v) => (
            <label
              key={v.id}
              className="flex cursor-pointer items-start gap-3 rounded-[9px] border border-line bg-surface px-3.5 py-2.5 hover:border-mata"
            >
              <input
                type="checkbox"
                checked={selec.has(v.id)}
                onChange={() => toggle(v.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6B44]"
              />
              <span>
                <span className="block text-[14px] font-semibold text-ink">
                  {v.titulo}
                  {v.data_envio_newsletter && (
                    <span className="mono-caps ml-2 rounded-full bg-surface-dim px-2 py-0.5 text-[10px] font-normal text-ink-soft">
                      já enviada
                    </span>
                  )}
                </span>
                <span className="mono-caps text-[11px] text-ink-faint">
                  {[v.empresa_orgao, v.regiao].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="space-y-3 rounded-[12px] border border-line bg-surface-dim/40 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="email"
            value={testeEmail}
            onChange={(e) => setTesteEmail(e.target.value)}
            placeholder="e-mail para teste"
            className="min-h-[42px] flex-1 rounded-[9px] border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none"
          />
          <button
            onClick={enviarTeste}
            disabled={rodando !== null || selec.size === 0 || !testeEmail.trim()}
            className="min-h-[42px] shrink-0 rounded-[9px] border border-line-strong bg-surface px-4 text-[14px] font-bold text-ink-soft hover:border-mata hover:text-mata disabled:opacity-50"
          >
            {rodando === "teste" ? "Enviando…" : "Enviar teste"}
          </button>
        </div>

        {confirmando ? (
          <div className="flex flex-wrap items-center gap-3 rounded-[9px] border border-sol/40 bg-sol-tint px-3.5 py-2.5">
            <span className="text-[13.5px] text-ink">
              Enviar para <strong>{assinantes ?? 0}</strong> assinante(s)?
            </span>
            <button
              onClick={enviar}
              disabled={rodando !== null}
              className="rounded-[9px] bg-mata px-4 py-2 text-[13px] font-bold text-white hover:bg-mata-deep disabled:opacity-60"
            >
              {rodando === "envio" ? "Enviando…" : "Confirmar envio"}
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="mono-caps text-[11px] text-ink-soft hover:underline"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            disabled={selec.size === 0 || (assinantes ?? 0) === 0}
            className="w-full rounded-[9px] bg-mata px-5 py-2.5 text-[14px] font-bold text-white hover:bg-mata-deep disabled:opacity-50 sm:w-auto"
          >
            Enviar newsletter →
          </button>
        )}
      </div>

      {/* Envios recentes */}
      <div>
        <p className="mono-caps mb-3 text-[11px] text-ink-faint">Envios recentes</p>
        <div className="grid gap-2">
          {(envios ?? []).length === 0 && (
            <p className="text-[13px] text-ink-soft">Nenhum envio ainda.</p>
          )}
          {(envios ?? []).map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-3.5 py-2"
            >
              <span className="text-[13.5px] text-ink">{e.assunto}</span>
              <span className="mono-caps text-[11.5px] text-ink-soft">
                {e.total_destinatarios ?? 0} envios · {e.status_envio} · {desde(e.data_envio)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
