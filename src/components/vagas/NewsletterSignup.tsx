import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

const TERMO_VERSAO = "v1.0";
const FINALIDADE =
  "Envio de no máximo 1 e-mail por semana com uma seleção de oportunidades de estágio e emprego na área ambiental.";

type Estado = "idle" | "enviando" | "ok" | "erro";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [aceite, setAceite] = useState(false);
  const [estado, setEstado] = useState<Estado>("idle");
  const [msg, setMsg] = useState("");
  // honeypot anti-bot (campo invisível; humano nunca preenche)
  const [website, setWebsite] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!aceite || website) return;
    setEstado("enviando");
    setMsg("");
    const { data, error } = await supabase.rpc("assinar_newsletter", {
      p_email: email.trim(),
      p_termo_versao: TERMO_VERSAO,
      p_finalidade: FINALIDADE,
    });
    const r = data as { ok?: boolean; status?: string; motivo?: string } | null;
    if (error || !r?.ok) {
      setEstado("erro");
      setMsg(
        r?.motivo === "email_invalido"
          ? "Confira o e-mail digitado."
          : "Não foi possível cadastrar agora. Tente novamente.",
      );
      return;
    }
    setEstado("ok");
    setMsg(
      r.status === "ja_inscrito"
        ? "Você já está inscrito — tudo certo!"
        : "Pronto! Você vai receber as próximas oportunidades por e-mail.",
    );
  }

  return (
    <section
      aria-labelledby="news-title"
      className="mt-14 scroll-mt-24 overflow-hidden rounded-[20px] border border-mata-line bg-mata-tint p-6 shadow-[var(--shadow-card)] sm:p-9"
    >
      {estado === "ok" ? (
        <div>
          <p className="mono-caps text-[11px] text-mata-deep">Inscrição confirmada</p>
          <p className="mt-2 text-[16px] font-semibold text-ink">{msg}</p>
          <p className="mt-2 text-[13px] text-ink-soft">
            Você pode se descadastrar a qualquer momento pelo link em todos os e-mails.
          </p>
        </div>
      ) : (
        <>
          <p className="mono-caps text-[11px] text-mata-deep">A curadoria vai até você</p>
          <h2
            id="news-title"
            className="mt-1.5 font-display text-[24px] font-bold leading-tight text-ink"
            style={{ letterSpacing: "-0.02em" }}
          >
            Receba as vagas por e-mail
          </h2>
          <p className="mt-2 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-soft">
            No máximo <strong className="text-ink">um e-mail por semana</strong>, com a
            seleção da coordenação. Nada de spam — e você sai quando quiser, em um clique.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="min-h-[48px] flex-1 rounded-[9px] border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-faint focus:border-mata focus:outline-none"
              />
              <button
                type="submit"
                disabled={estado === "enviando" || !aceite}
                className="min-h-[48px] shrink-0 rounded-[9px] bg-mata px-6 text-[15px] font-bold text-white transition-colors hover:bg-mata-deep disabled:opacity-50"
              >
                {estado === "enviando" ? "Enviando…" : "Quero receber"}
              </button>
            </div>

            {/* honeypot */}
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px", width: 1, height: 1 }}
            />

            <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink-soft">
              <input
                type="checkbox"
                checked={aceite}
                onChange={(e) => setAceite(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0D6B44]"
              />
              <span>
                Autorizo o Curso Técnico em Meio Ambiente do IFCE a me enviar a newsletter de
                oportunidades. Meus dados são tratados conforme a LGPD (Lei nº 13.709/2018), com
                base no meu consentimento, e posso me descadastrar a qualquer momento. Ver a{" "}
                <a href="/politica-de-privacidade" className="text-mata-deep underline">
                  política de privacidade
                </a>
                .
              </span>
            </label>

            {estado === "erro" && (
              <p className="text-[13px] text-barro">{msg}</p>
            )}
          </form>
        </>
      )}
    </section>
  );
}
