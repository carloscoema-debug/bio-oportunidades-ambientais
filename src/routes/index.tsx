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
      <section aria-labelledby="hero-title" className="pt-4 sm:pt-8">
        <p className="mono-caps text-[11px] text-mata">
          Edição atual · Ceará
        </p>
        <h1
          id="hero-title"
          className="mt-3 font-display text-ink"
          style={{
            fontSize: "clamp(26px, 6vw, 34px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          Oportunidades ambientais no Ceará, selecionadas para você
        </h1>
        <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-ink-soft">
          O BIO é um observatório de território mantido pela Coordenação do
          Curso Técnico em Meio Ambiente do IFCE Campus Fortaleza. Reunimos, com
          curadoria, vagas de estágio e emprego na área ambiental — para que
          você acompanhe o mercado sem depender de grupos de WhatsApp ou buscas
          soltas.
        </p>
      </section>

      <VagasFeed />
      <NewsletterSignup />
    </SiteLayout>
  );
}
