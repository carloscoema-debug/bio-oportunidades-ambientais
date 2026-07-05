import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "../components/layout/SiteLayout";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de privacidade — BIO" },
      {
        name: "description",
        content:
          "Como o BIO — Observatório Institucional de Oportunidades Ambientais do IFCE Campus Fortaleza trata dados, em conformidade com a LGPD.",
      },
    ],
  }),
  component: Privacidade,
});

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-9 flex items-center gap-2.5 font-display text-[20px] font-bold tracking-[-0.01em] text-ink">
      <span aria-hidden className="h-4 w-[3px] shrink-0 rounded-full bg-mata" />
      {children}
    </h2>
  );
}

function Privacidade() {
  return (
    <SiteLayout>
      <article className="py-4 sm:py-6">
        <p className="mono-caps inline-flex items-center gap-2 text-[11px] text-mata-deep">
          <span aria-hidden className="inline-block h-[6px] w-[6px] rounded-full bg-mata" />
          Transparência
        </p>
        <h1
          className="mt-3 font-display text-ink"
          style={{
            fontSize: "clamp(24px, 5.5vw, 32px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          Política de privacidade
        </h1>
        <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-ink-soft">
          O BIO é operado pela Coordenação do Curso Técnico em Meio Ambiente do IFCE
          Campus Fortaleza. Levamos a sério a proteção de dados e seguimos a Lei Geral
          de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
        </p>

        <H2>Navegar no portal não exige cadastro</H2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          O portal público é aberto: você consulta e filtra vagas sem login, sem
          informar nome, e-mail ou qualquer dado pessoal. Não rastreamos sua
          identidade nem criamos perfis de navegação.
        </p>

        <H2>O que coletamos</H2>
        <ul className="mt-3 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Sinalizações de problema (anônimas).</strong>{" "}
            Ao usar "Informar problema" (link inválido, vaga encerrada, vaga
            suspeita), registramos apenas o tipo de sinalização, a vaga e a data.
            Para evitar envios repetidos, seu navegador guarda um{" "}
            <em>código aleatório</em> (não identifica você) no armazenamento local do
            próprio aparelho.
          </li>
          <li>
            <strong className="text-ink">Contagem de cliques (agregada).</strong>{" "}
            Contamos quantas vezes o botão de candidatura de uma vaga foi acionado,
            sem associar isso a qualquer pessoa.
          </li>
        </ul>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Base legal:</strong> interesse legítimo (art.
          7º, IX, da LGPD) — melhorar a curadoria e a qualidade das oportunidades
          divulgadas.
        </p>

        <H2>Por quanto tempo guardamos</H2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Os registros de sinalização são mantidos de forma agregada para fins
          estatísticos e de qualidade. Não há dados pessoais associados a eles.
        </p>

        <H2>Cadastro voluntário na newsletter</H2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Se você optar por receber as oportunidades por e-mail, guardamos apenas o{" "}
          <strong className="text-ink">seu endereço de e-mail</strong> e o registro do
          consentimento (data e finalidade). O envio é de no máximo um e-mail por semana.
        </p>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          <strong className="text-ink">Base legal:</strong> consentimento (art. 7º, I,
          da LGPD). Você pode <strong className="text-ink">se descadastrar a qualquer
          momento</strong> pelo link presente em todos os e-mails — sem burocracia.
        </p>

        <H2>Envio de vagas por empresas</H2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Empresas e órgãos que divulgam uma vaga informam dados de contato (nome e
          e-mail). Usamos essas informações apenas para{" "}
          <strong className="text-ink">validar a oportunidade</strong> junto ao
          anunciante antes da publicação — nunca para outra finalidade.
        </p>

        <H2>Seus direitos</H2>
        <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Você pode solicitar informações sobre o tratamento de dados, correção ou
          eliminação, conforme a LGPD, pelos canais oficiais da coordenação do curso.
        </p>

        <H2>Aviso institucional</H2>
        <p className="mt-3 max-w-[68ch] text-[14px] leading-relaxed text-ink-faint">
          O IFCE Campus Fortaleza divulga as oportunidades como serviço de informação
          aos estudantes e egressos do Curso Técnico em Meio Ambiente. O IFCE não
          conduz, não endossa e não se responsabiliza pelos processos seletivos, pelas
          condições dos vínculos nem pela idoneidade das empresas ou órgãos
          anunciantes.
        </p>

        <p className="mt-8 max-w-[62ch] text-[13px] leading-relaxed text-ink-faint">
          Documento em caráter informativo, sujeito a revisão pela instância
          institucional competente. Última atualização: julho de 2026.
        </p>

        <div className="mt-8 border-t border-line pt-6">
          <Link
            to="/"
            className="mono-caps text-[12px] text-mata-deep underline underline-offset-2 hover:text-mata"
          >
            ← Voltar às vagas
          </Link>
        </div>
      </article>
    </SiteLayout>
  );
}
