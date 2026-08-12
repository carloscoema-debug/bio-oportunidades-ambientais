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
          "Curadoria de vagas de estágio e emprego em meio ambiente no Ceará, para quem estuda ou já se formou na área ambiental.",
      },
      { property: "og:url", content: "https://biooportunidades.org/" },
      {
        property: "og:image",
        content: "https://biooportunidades.org/og-image.jpg",
      },
      {
        property: "og:image:secure_url",
        content: "https://biooportunidades.org/og-image.jpg",
      },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "BIO — Oportunidades ambientais no Ceará",
      },
      {
        name: "twitter:image",
        content: "https://biooportunidades.org/og-image.jpg",
      },
    ],
    links: [{ rel: "canonical", href: "https://biooportunidades.org/" }],
  }),
  component: Home,
});

const PASSOS = [
  {
    titulo: "Selecionamos",
    texto:
      "Acompanhamos editais, empresas e plataformas e separamos o que faz sentido para quem atua com meio ambiente no Ceará.",
  },
  {
    titulo: "Verificamos",
    texto:
      "Conferimos prazo, link e aderência ao perfil técnico. Nenhuma vaga vai ao ar sem revisão humana.",
  },
  {
    titulo: "Você se candidata na fonte",
    texto:
      "Cada vaga leva ao site oficial do anunciante. O BIO não recebe inscrições nem conduz processos seletivos.",
  },
];

function ComoFunciona() {
  return (
    <section
      aria-labelledby="como-funciona-title"
      className="mt-9 overflow-hidden rounded-[18px] border border-line bg-surface/70 shadow-[var(--shadow-card)]"
    >
      <p
        id="como-funciona-title"
        className="mono-caps border-b border-line px-5 py-3 text-[11px] text-ink-faint"
      >
        Como o BIO funciona
      </p>
      <ol className="divide-y divide-line">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="flex gap-4 px-5 py-4">
            <span
              aria-hidden
              className="mono-caps mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mata-tint text-[12px] text-mata-deep"
            >
              {i + 1}
            </span>
            <div>
              <p className="text-[15px] font-bold text-ink">{p.titulo}</p>
              <p className="mt-0.5 text-[14px] leading-relaxed text-ink-soft">
                {p.texto}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Home() {
  return (
    <SiteLayout>
      <section aria-labelledby="hero-title" className="pt-3 sm:pt-6">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          Curadoria independente · Meio ambiente
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
        <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-ink-soft">
          <strong className="font-bold text-ink">BIO</strong> é o Banco Institucional de
          Oportunidades. Reunimos e conferimos vagas de estágio, emprego e seleções públicas
          já abertas no mercado, na área ambiental. A curadoria é de uma equipe que trabalha
          só com meio ambiente. A candidatura sempre acontece no site oficial de cada vaga.
        </p>
      </section>

      <ComoFunciona />
      <VagasFeed />
      <NewsletterSignup />
    </SiteLayout>
  );
}
