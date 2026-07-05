import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteLayout } from "../components/layout/SiteLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/descadastrar")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  head: () => ({
    meta: [
      { title: "Descadastrar — BIO" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Descadastrar,
});

type Estado = "processando" | "ok" | "erro";

function Descadastrar() {
  const { token } = Route.useSearch();
  const [estado, setEstado] = useState<Estado>("processando");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("erro");
      setMsg("Link inválido — sem token de descadastramento.");
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("descadastrar_newsletter", {
        p_token: token,
      });
      const r = data as { ok?: boolean; status?: string } | null;
      if (error || !r?.ok) {
        setEstado("erro");
        setMsg("Não foi possível processar. O link pode estar incorreto ou expirado.");
      } else {
        setEstado("ok");
        setMsg(
          r.status === "ja_inativo"
            ? "Você já estava descadastrado — nada mais a fazer."
            : "Pronto. Você não receberá mais e-mails do BIO.",
        );
      }
    })();
  }, [token]);

  return (
    <SiteLayout>
      <section className="mx-auto max-w-[500px] py-16">
        <div className="overflow-hidden rounded-[20px] border border-line bg-surface p-8 text-center shadow-[var(--shadow-card)] sm:p-10">
          <span
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-[22px] ${
              estado === "processando"
                ? "bg-surface-dim text-ink-faint"
                : estado === "ok"
                  ? "bg-mata text-white shadow-[0_6px_16px_-6px_rgba(10,79,51,0.5)]"
                  : "bg-barro/10 text-barro"
            }`}
            aria-hidden
          >
            {estado === "processando" ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-faint border-t-transparent" />
            ) : estado === "ok" ? "✓" : "!"}
          </span>
          <p className="mono-caps mt-4 text-[11px] text-ink-faint">Newsletter BIO</p>
          <h1 className="mt-1.5 font-display text-[24px] font-bold text-ink" style={{ letterSpacing: "-0.02em" }}>
            Descadastramento
          </h1>
          <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">
            {estado === "processando" ? "Processando seu pedido…" : msg}
          </p>
          {estado === "ok" && (
            <p className="mt-6 text-[13px] text-ink-soft">
              Mudou de ideia? Você pode se inscrever de novo a qualquer momento na{" "}
              <a href="/" className="text-mata-deep underline underline-offset-2">página inicial</a>.
            </p>
          )}
        </div>
      </section>
    </SiteLayout>
  );
}
