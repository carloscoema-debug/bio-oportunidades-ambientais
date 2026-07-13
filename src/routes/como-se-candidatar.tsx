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
          "Guia completo para estudantes e egressos do Curso Técnico em Meio Ambiente do IFCE: currículo que passa pela triagem por IA, LinkedIn, portfólio, entrevistas e como usar IA a seu favor sem exagerar.",
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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 font-display text-[16.5px] font-bold text-ink">{children}</h3>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 max-w-[62ch] rounded-[10px] border border-mata-line bg-mata-tint px-4 py-3 text-[14px] leading-relaxed text-mata-deep">
      {children}
    </div>
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
          porém, acontece sempre no site do anunciante — este guia existe para você
          chegar lá preparado, principalmente se for a sua primeira candidatura.
        </p>

        <H2>Seu currículo também é lido por um robô</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Antes de qualquer pessoa ler seu currículo, a maioria das empresas usa um
          sistema automático de triagem (chamado de ATS) para filtrar candidatos.
          No Brasil, a maior parte dos currículos enviados passa primeiro por esse
          filtro — só os que "passam" chegam a um recrutador humano. Isso muda como
          você deve escrever.
        </p>

        <H3>O que o sistema automático precisa encontrar</H3>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Use os termos exatos da vaga.</strong> Se o
            anúncio pede "técnico em meio ambiente", "licenciamento ambiental" ou
            "PGRS", use essas mesmas palavras — não troque por sinônimos. O sistema
            busca correspondência literal, não interpretação.
          </li>
          <li>
            <strong className="text-ink">Estrutura simples, sem enfeite.</strong>{" "}
            Tabelas, colunas lado a lado, caixas de texto e ícones podem confundir o
            sistema de leitura e fazer parte do seu currículo simplesmente
            desaparecer da análise. Um documento direto, de cima para baixo, é mais
            seguro.
          </li>
          <li>
            <strong className="text-ink">Nomeie seções do jeito esperado.</strong>{" "}
            "Experiência profissional", "Formação" e "Habilidades" funcionam melhor
            que títulos criativos como "Minha jornada" ou "O que eu trago".
          </li>
          <li>
            <strong className="text-ink">Envie em PDF gerado por texto</strong>{" "}
            (do Word, Google Docs ou Canva), nunca uma foto ou scan do currículo
            impresso — texto escaneado não é lido pelo sistema.
          </li>
          <li>
            <strong className="text-ink">Nomeie o arquivo com seu nome</strong>{" "}
            — "joao-silva-curriculo.pdf", não "curriculo_final_v3.pdf".
          </li>
        </ul>

        <H3>O que fazer o conteúdo dizer</H3>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Resultado, não só tarefa.</strong> Troque{" "}
            <em>"Fiz laudos ambientais no estágio"</em> por{" "}
            <em>
              "Elaborei 12 laudos de monitoramento ambiental durante o estágio,
              apoiando a regularização de licenças de 3 empresas"
            </em>
            . Números e contexto tornam a experiência concreta, mesmo em atividades
            de estágio ou projeto de curso.
          </li>
          <li>
            <strong className="text-ink">Sem experiência formal ainda?</strong> Liste
            projetos do curso técnico, trabalhos de campo, visitas técnicas,
            participação em coleta seletiva ou educação ambiental, e cursos livres
            (NR, gestão de resíduos, SIG). Isso conta como experiência real.
          </li>
          <li>
            <strong className="text-ink">Uma página basta</strong> para quem está
            começando — o objetivo é ser lido rápido, não ser extenso.
          </li>
        </ul>

        <Callout>
          <strong>Contratação por competências</strong> vem ganhando espaço: empresas
          valorizam cada vez mais habilidades comprovadas (organização, comunicação,
          trabalho em campo, uso de ferramentas específicas) e não só o tempo de
          experiência formal. Para quem está no primeiro emprego, isso é uma
          vantagem — mostre o que você sabe fazer, não só há quanto tempo trabalha.
        </Callout>

        <H2>LinkedIn: seu currículo que nunca para de trabalhar</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Muitos recrutadores buscam o nome do candidato no LinkedIn antes mesmo de
          abrir o currículo enviado. Um perfil incompleto ou desatualizado pode pesar
          contra você — mesmo sem ninguém falar isso diretamente.
        </p>
        <a
          href="https://www.linkedin.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="mono-caps mt-4 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-mata-line bg-mata-tint px-4 py-2 text-[11px] text-mata-deep transition-colors hover:border-mata hover:bg-mata hover:text-white"
        >
          Criar ou atualizar meu perfil no LinkedIn
          <span aria-hidden>↗</span>
        </a>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Foto e título claros.</strong> Uma foto de
            rosto com boa luz, e um título como "Técnico em Meio Ambiente — IFCE" em
            vez de deixar em branco ou repetir "Estudante".
          </li>
          <li>
            <strong className="text-ink">Descreva a formação de verdade.</strong> Na
            seção do curso técnico, escreva 2-3 linhas sobre o que você estudou e
            projetos concretos — não deixe só o nome da instituição.
          </li>
          <li>
            <strong className="text-ink">Siga empresas e órgãos da área</strong>{" "}
            ambiental no Ceará — muitas publicam vaga primeiro por lá, antes de
            qualquer outro canal.
          </li>
          <li>
            <strong className="text-ink">Peça uma recomendação</strong> a um
            professor, orientador de estágio ou coordenador — poucas linhas de
            alguém que te conhece profissionalmente valem mais do que parecem.
          </li>
          <li>
            <strong className="text-ink">Publique sobre o que você faz.</strong> Um
            post simples sobre um projeto do curso ou uma visita técnica mostra
            interesse ativo na área — e aparece para quem segue o mesmo assunto.
          </li>
        </ul>

        <H2>Portfólio: mostre, não só conte</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Quem estuda meio ambiente produz evidência concreta o tempo todo:
          relatórios de estágio, projetos de gerenciamento de resíduos (PGRS),
          laudos de monitoramento, TCC. Guardar isso organizado em um único lugar
          — uma pasta do Google Drive compartilhável, por exemplo — dá ao
          recrutador algo que nenhum currículo sozinho mostra: prova do que você
          sabe fazer.
        </p>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            Selecione 3 a 5 trabalhos que você tem mais orgulho — não precisa (nem
            deve) colocar tudo.
          </li>
          <li>
            Remova dados sigilosos ou de empresas específicas antes de
            compartilhar, se for o caso.
          </li>
          <li>
            Coloque o link do portfólio no currículo e no perfil do LinkedIn.
          </li>
        </ul>

        <H2>Entrevistas: o que mudou</H2>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Entrevista por vídeo virou padrão</strong>{" "}
            mesmo para vagas técnicas e de campo. Teste câmera e áudio antes, escolha
            um fundo neutro e garanta conexão estável — problemas técnicos custam
            tempo (e primeira impressão).
          </li>
          <li>
            <strong className="text-ink">Perguntas comportamentais</strong> ("me
            conte uma situação em que...") são comuns mesmo em vagas técnicas.
            Prepare 2-3 exemplos reais do curso ou estágio, estruturados em situação
            → ação → resultado.
          </li>
          <li>
            <strong className="text-ink">Espere perguntas técnicas específicas</strong>{" "}
            da área — legislação ambiental básica, tipos de licença, classificação
            de resíduos. Revisar o conteúdo do curso antes da entrevista faz
            diferença real.
          </li>
        </ul>

        <H2>Usando IA a seu favor, sem exagerar</H2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink-soft">
          Ferramentas de IA já fazem parte dos dois lados do processo seletivo —
          inclusive filtrando currículos antes que um recrutador veja. Usá-las para
          se preparar é legítimo e recomendado, mas existe uma linha clara entre
          ajudar e enganar.
        </p>
        <ul className="mt-4 max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-soft">
          <li>
            <strong className="text-ink">Pode:</strong> pedir para revisar clareza e
            gramática do currículo, adaptar a mesma experiência para os termos de
            uma vaga específica, treinar respostas de entrevista simulando perguntas
            comuns.
          </li>
          <li>
            <strong className="text-ink">Não pode:</strong> inventar experiência ou
            competência que você não tem, ou colar uma resposta gerada por IA numa
            entrevista sem entender o que está dizendo — o recrutador costuma
            perceber, e uma pergunta de acompanhamento simples expõe isso na hora.
          </li>
          <li>
            A regra prática: a IA deve ajudar você a comunicar melhor a sua
            experiência real, nunca substituir a experiência em si.
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

        <VoltarPortal />
      </article>
    </SiteLayout>
  );
}
