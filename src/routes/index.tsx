import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "../components/layout/SiteLayout";
import { VagasFeed } from "@/components/vagas/VagasFeed";
import { NewsletterSignup } from "@/components/vagas/NewsletterSignup";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "BIO — Oportunidades ambientais no Ceará, selecionadas para você",
      },
      {
        name: "description",
        content:
          "Curadoria de vagas de estágio e emprego em meio ambiente no Ceará, para estudantes e egressos do Curso Técnico em Meio Ambiente do IFCE Campus Fortaleza.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      <section aria-labelledby="hero-title" className="pt-3 sm:pt-6">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          Curadoria da coordenação · Ceará
        </p>
        <h1
          id="hero-title"
          className="mt-4 font-display text-ink"
          style={{
            fontSize: "clamp(30px, 7.5vw, 46px)",
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: "-0.028em",
          }}
        >
          Oportunidades ambientais no Ceará,{" "}
          <span className="text-mata">selecionadas para você.</span>
        </h1>
        <p className="mt-5 max-w-[54ch] text-[16.5px] leading-relaxed text-ink-soft">
          Estágios, empregos e seleções públicas na área ambiental — reunidos e
          checados pela coordenação do <span className="text-ink">Curso Técnico em
          Meio Ambiente do IFCE Campus Fortaleza</span>. Você acompanha o mercado sem
          depender de grupos de WhatsApp ou de buscas soltas.
        </p>
      </section>

      <VagasFeed />
      <NewsletterSignup />
    </SiteLayout>
  );
}
