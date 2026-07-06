import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "../components/layout/SiteLayout";
import { VoltarPortal } from "../components/layout/VoltarPortal";

export const Route = createFileRoute("/como-se-candidatar")({
  head: () => ({
    meta: [
      { title: "Como se candidatar — BIO" },
      {
        name: "description",
        content:
          "Orientações para estudantes e egressos do Curso Técnico em Meio Ambiente do IFCE sobre como se candidatar a estágios e empregos divulgados no BIO.",
      },
    ],
  }),
  component: ComoSeCandidatar,
});

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 flex items-center gap-2.5 font-display text-[22px] font-bold tracking-[-0.01em] text-ink">
      <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-mata" />
      {children}
    </h2>
  );
}

function ComoSeCandidatar() {
  return (
    <SiteLayout>
      <article className="py-4 sm:py-6">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          Guia do estudante
        </p>
        <h1
          className="mt-3 font-display text-ink"
          style={{
            fontSize: "clamp(26px, 6vw, 34px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          Como se candidatar
        </h1>
        <p className="mt-4 max-w-[60ch] text-[16px] leading-relaxed text-ink-soft">
          O BIO reúne oportunidades já revisadas pela coordenação. A candidatura,
          porém, acontece sempre no site do anunciante — aqui vai um passo a passo
          para você não se perder, especialmente se for a sua primeira vez.
        </p>

        <H2>Primeiros passos para o primeiro estágio</H2>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Monte um currículo simples.</strong> Uma
            página basta: dados de contato, o curso (Técnico em Meio Ambiente —
            IFCE), experiências, cursos e habilidades. Sem experiência ainda? Liste
            projetos do curso, trabalhos voluntários e cursos livres.
          </li>
          <li>
            <strong className="text-ink">Tenha um e-mail profissional.</strong>{" "}
            Prefira algo com seu nome. Confira a caixa de entrada (e o spam) com
            frequência durante uma seleção.
          </li>
          <li>
            <strong className="text-ink">Leia a vaga inteira antes de aplicar.</strong>{" "}
            Confira o prazo, o local, a forma de candidatura e os requisitos. No BIO,
            o selo verde <em>"Recomendado para Técnico em MA"</em> indica vagas com
            boa aderência ao seu perfil.
          </li>
          <li>
            <strong className="text-ink">Candidate-se cedo.</strong> Vagas com o
            badge <em>"Urgente"</em> ou <em>"Vence em breve"</em> têm prazo curto —
            não deixe para a última hora.
          </li>
        </ul>

        <H2>Como usar o BIO</H2>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Filtre.</strong> Use a busca e os filtros
            (Estágio, Emprego, Fortaleza + RMF, Interior, "Recomendadas p/ mim") para
            achar o que combina com você.
          </li>
          <li>
            <strong className="text-ink">Candidate-se.</strong> O botão{" "}
            <em>"Candidatar-se"</em> leva você ao site oficial da vaga. Siga as
            instruções de lá — o BIO não recebe inscrições.
          </li>
          <li>
            <strong className="text-ink">Compartilhe.</strong> Achou uma vaga boa
            para um colega? Use o botão do WhatsApp no card.
          </li>
          <li>
            <strong className="text-ink">Ajude a manter a qualidade.</strong> Se um
            link não abrir, a vaga já tiver encerrado ou parecer suspeita, use o{" "}
            <em>"Informar problema"</em> no rodapé do card. Sua sinalização é anônima
            e ajuda toda a turma.
          </li>
        </ul>

        <H2>Estágio obrigatório e o TCE</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          O estágio curricular <strong className="text-ink">obrigatório</strong> faz
          parte da sua formação e precisa ser formalizado. Antes de começar a
          estagiar, é necessário assinar o{" "}
          <strong className="text-ink">Termo de Compromisso de Estágio (TCE)</strong>{" "}
          entre você, a empresa/órgão e o IFCE, com um plano de atividades e um
          professor orientador. <strong className="text-ink">Não inicie um estágio
          sem o TCE assinado</strong> — sem ele, o estágio pode não ser reconhecido
          pelo curso.
        </p>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Cada card indica se a vaga é de{" "}
          <em>estágio curricular obrigatório</em>, <em>não obrigatório</em> ou{" "}
          <em>emprego</em>. Em caso de dúvida sobre o enquadramento, fale com a
          coordenação antes de assinar qualquer documento.
        </p>

        <H2>Ficou com dúvida?</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          A coordenação do Curso Técnico em Meio Ambiente pode orientar você sobre
          estágio, TCE e documentação. Procure os canais oficiais do curso no
          Campus Fortaleza.
        </p>

        <VoltarPortal />
      </article>
    </SiteLayout>
  );
}
