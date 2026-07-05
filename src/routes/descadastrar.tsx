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
      <section className="mx-auto max-w-[520px] py-16 text-center">
        <p className="mono-caps text-[11px] text-ink-faint">Newsletter BIO</p>
        <h1 className="mt-3 font-display text-[26px] font-bold text-ink">
          Descadastramento
        </h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">
          {estado === "processando" ? "Processando seu pedido…" : msg}
        </p>
        {estado === "ok" && (
          <p className="mt-6 text-[13px] text-ink-soft">
            Mudou de ideia? Você pode se inscrever de novo a qualquer momento na{" "}
            <a href="/" className="text-mata-deep underline">página inicial</a>.
          </p>
        )}
      </section>
    </SiteLayout>
  );
}
