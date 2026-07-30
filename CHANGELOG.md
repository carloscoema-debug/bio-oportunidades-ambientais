# Changelog — BIO

Registro das mudanças relevantes do projeto, mais recentes primeiro. Cada
entrada tem a data, o que mudou e por quê (quando não é óbvio). Commits
automáticos do Lovable sem descrição própria ("Changes", "Work in progress")
não aparecem aqui — só mudanças com intenção registrada.

## 2026-07-30 — Química Industrial na fila, e um limite honesto no LinkedIn

Vaga "Químico Industrial" (PLD Soluções/Interlândia LTDA) entrou na fila como
"IA: revisar · 85" com dois problemas — formação errada e vaga já encerrada.

- **Formação errada — corrigido.** A IA aprovou citando "compatível com Eng.
  Química/Ambiental", mas Engenharia Química NÃO é um dos 5 cursos do BIO. A
  vaga menciona "legislação ambiental" como uma responsabilidade entre várias
  de controle de qualidade industrial (CRQ, BPF, ISO) — a IA confundiu "cita
  meio ambiente" com "é aderente". Nova entrada em ARMADILHAS DE ÁREA
  ADJACENTE (`classificar-vagas`), no mesmo padrão de SST/energia solar/
  qualidade pura já existentes.
- **Vaga encerrada — limitação documentada, não um bug corrigível por regex.**
  Investigado a fundo: o endpoint público do LinkedIn que usamos (guest job
  posting, sem login) ÀS VEZES expõe "No longer accepting applications" e
  outras vezes não — inclusive para a MESMA vaga que a coordenação viu fechada
  numa tela autenticada do LinkedIn ("Não aceita mais candidaturas"), que o
  endpoint público não carrega. Testado fetch direto e `Accept:
  application/json` — nenhum expõe esse dado de forma confiável. Não é um
  problema de truncamento nem de prompt; é um limite de acesso a dado que só
  existe pra quem está logado. Documentado em `_shared/pagina.ts` pra não ser
  redescoberto como "bug" numa sessão futura. A rede de segurança real pra
  vaga de LinkedIn continua sendo o "Marcar como encerrada" manual.

## 2026-07-30 — Município errado: LinkedIn mostrava a região, não a cidade

- **Vaga da Eneva marcada como Fortaleza, sendo em Caucaia.** A página do
  LinkedIn tem dois sinais de local: "Empresa Fortaleza, Ceará, Brazil" logo no
  topo (a REGIÃO METROPOLITANA — o LinkedIn agrupa cidade-satélite sob o nome
  da capital) e, mais abaixo, o campo específico "Local de Trabalho: Caucaia -
  CE" (o dado real). A IA leu o sinal mais chamativo em vez do mais confiável.
- **Causa agravante:** o texto da página era cortado em 3500 caracteres antes
  de chegar à IA; nesta vaga, "Local de Trabalho" só aparecia no caractere
  ~5862 — o campo nunca era lido, em qualquer hipótese. Teto de leitura subiu
  para 12000 (`_shared/pagina.ts`), mantendo os 3500 só no que é *enviado à
  IA* (custo do LLM) — a extração de campos estruturados agora roda na página
  inteira.
- **Correção:** `_shared/pagina.ts` ganhou `extrairLocalTrabalho()` — extrai
  "Cidade - UF" por regex quando a página tem esse rótulo (padrão de template,
  não texto livre). Em `classificar-vagas`, esse campo é injetado no prompt
  como `local_trabalho_extraido` (a IA é instruída a tratá-lo como fonte da
  verdade) e, mais importante, **sobrepõe deterministicamente** a leitura livre
  da IA na hora de gravar `municipio` — não depende da IA obedecer a regra.
  Vale só quando ancorado por um sufixo de UF (evita capturar frase inteira por
  engano); sem UF, cai no comportamento normal.
- Os dois registros da vaga afetada corrigidos no banco (`Caucaia`), incluindo
  o que já estava **publicado ao vivo** no site.

Ao abrir um PR ou fazer push direto, adicione uma linha nesta seção
correspondente à data (crie uma nova se for um dia novo).

## 2026-07-30 — E-mails de notificação: novo destino e menos ruído

- **Destino trocado** de `ctma@fortaleza.ifce.edu.br` para `bioctmaifce@gmail.com`
  (`app_config.coordenacao_email`) — afeta os dois avisos automáticos que usam essa
  chave: o resumo diário da fila (`digest-curadoria`) e o lembrete semanal da
  newsletter (`newsletter-lembrete`, mantido sem mudança de comportamento).
- **`digest-curadoria` só avisa quando há algo para um humano decidir.** Antes,
  disparava sempre que havia QUALQUER vaga pendente — inclusive dias em que a fila
  inteira já tinha sido classificada como "IA: descartar" pela `classificar-vagas`,
  gerando e-mail todo dia mesmo sem nada de fato acionável. Agora usa os MESMOS
  baldes do painel (`FilaVagas.tsx`: prontas para aprovar / precisam de atenção /
  IA sugere descartar) — só conta e lista prontas+atenção; se a fila só tiver
  "IA: descartar", pula o dia. O e-mail que ainda chega separa as duas categorias em
  blocos e menciona (sem listar) quantas foram descartadas pela IA, para a
  coordenação saber que a fila "de verdade" é maior sem inflar a mensagem.

## 2026-07-30 — Encerrar vaga (1 a 1 e em massa) sem perder o histórico

- **"Marcar como encerrada"** nas abas "Link inativo" e "Publicadas", com versão
  **em massa** na aba "Link inativo" (seleção + um clique) — é ali que as vagas
  mortas se acumulam, e limpar card a card não escala. A ação 1 a 1 continua.
- **Encerrada NÃO é rejeitada.** A ação grava `status='expirada'`, não
  `rejeitada`. A vaga foi real, passou pela curadoria e ficou no ar; só acabou.
  `expirada` está em `STATUS_VALIDADO`, então continua contando nos Relatórios
  como vaga validada; `rejeitada` fica fora da análise de mercado. Colocar
  "expirada" no dropdown de rejeição teria apagado justamente o histórico
  estratégico que a coordenação quer preservar. Sai do portal público na hora (a
  view pública exige `status='aprovada'`).
- **Filtro de período dos Relatórios ganhou faixas longas** (12 meses e 6 meses,
  além de 90/30 dias e todo o período). Com teto de 90 dias não dava para
  comparar semestres nem ver sazonalidade — e a leitura de mercado melhora
  conforme as vagas se acumulam.

## 2026-07-29 — Vaga encerrada sai do ar; setor público/privado

- **Vaga encerrada na fonte continuava publicada.** O `verificar-links` só
  olhava o status HTTP, mas agregador não devolve erro quando a vaga fecha: o
  Indeed mantém a URL viva e escreve "Essa vaga expirou no Indeed" no corpo; o
  LinkedIn escreve "No longer accepting applications". Cabeçalho HTTP não
  enxerga texto. Pior: o Indeed responde 403 a qualquer IP de datacenter, e 403
  conta (corretamente) como inconclusivo — 19 das 30 publicadas nunca tinham
  sido verificadas de fato. A leitura de página já existia, mas só na
  `classificar-vagas` e só na ENTRADA da vaga; foi extraída para
  `_shared/pagina.ts` (cascata fetch → Jina → Firecrawl; só o Firecrawl vence o
  Cloudflare do Indeed) e agora roda também na verificação diária, com detector
  de frases de encerramento. Detectou → `status_link='inacessivel'`: sai da view
  pública na hora e cai na aba "LINK INATIVO", que já tem o "Republicar" para
  falso positivo; a mensagem guarda o trecho que provou. **Primeira execução
  encontrou 8 vagas mortas entre as 30 publicadas.**
- **Empresa privada registrada como setor público.** `EditarVaga` usava
  `setor: vaga.setor ?? "publico"`. Como nenhum canal de entrada preenche
  `setor` (fica NULL) e o formulário grava todos os campos ao salvar, editar uma
  vaga por QUALQUER motivo carimbava empresa privada como pública — o ato de
  corrigir é que introduzia o erro. Defaults agora deduzem do tipo, a IA passa a
  preencher `setor` reaproveitando a decisão de empregador público × privado que
  já toma para o `tipo`, e 9 vagas foram corrigidas no banco.

## 2026-07-17 — Aderência: IA mais precisa e selos honestos

- **IA de curadoria mais precisa na indicação** (`classificar-vagas` v37). A
  medição de 247 classificações mostrou 93% de concordância com a curadoria,
  mas só **57% de precisão no "aprovar"** (vs. 99,5% no "descartar") — e o
  `ai_score` não discriminava (falsos positivos tinham score 80-100, igual aos
  acertos). Quatro correções: few-shot das aprovadas agora leva nível/cursos/
  área (ensina a fronteira do que entra); few-shot das rejeitadas injeta cota
  de motivos específicos (o "fora do perfil", 90% dos casos, afogava as lições);
  regras explícitas para 3 armadilhas de área adjacente (Segurança do Trabalho,
  energia solar/eletrotécnica, qualidade pura); e piso de confiança que rebaixa
  "aprovar" com score < 90 para "revisar".
- **Selo da fila parava de mentir "Alta aderência"**. Apesar do nome,
  `score_aderencia` não mede aderência: `bio_score_aderencia` soma nível (30) +
  região (20) + confiabilidade da fonte (15) + completude (15) + ausência de
  flags (20), e **nunca olha o assunto da vaga**. Um aprendiz de telecom em
  Fortaleza somava 78 e ganhava selo verde ao lado de "IA: descartar · 0". O
  selo agora nomeia só o que mede — pré-triagem de cadastro, em cinza neutro.
- **Selo do site público passa a sair do veredito da IA** (view
  `vagas_publicas`), não do mesmo score cego. "Recomendado" só quando a IA
  aprovou com score >= 90; "Relevante · área ambiental" é o padrão seguro para
  o resto — incluindo vagas sem IA e as que a coordenação aprovou contrariando
  a IA (o selo nunca contradiz a curadoria humana). "Área correlata" deixa de
  ser emitido: toda vaga aprovada tem ao menos um curso_alvo, e o rótulo já era
  inalcançável na prática.

## 2026-07-15 — Auditoria de segurança

- **Corrige 4 vulnerabilidades de dependências** (`bun audit`): brace-expansion,
  esbuild, js-yaml, @babel/core — todas em ferramentas de build/lint, não no
  bundle de produção. Fixado via `overrides` no `package.json`.
- **Restringe CORS das edge functions** ao domínio do site
  (`biooportunidades.org` + previews do Lovable), em vez de aceitar qualquer
  origem (`*`). Helper compartilhado em `supabase/functions/_shared/cors.ts`.
- **Remove `.env` do versionamento** (só tinha chaves públicas do Supabase,
  mas é má prática manter isso no git) e adiciona `.env.example`.
- **`SECURITY.md`**: documenta o modelo de segurança do projeto (RLS, auth,
  segredos, CORS) contra o checklist de segurança/privacidade usado.

## 2026-07-14 — Relatórios e visão de mercado

- **Corrige contagem de status nos relatórios**: seções "Por tipo/região/
  setor/nível" contavam TODAS as vagas do período (incluindo rejeitadas),
  inflando os números ~10x. Corrigido para contar só vagas validadas.
- **Preserva histórico de mercado**: relatórios agora incluem vagas
  `suspensa`/`expirada` além de `aprovada` (tudo que passou pela curadoria),
  pra não perder dado histórico conforme vagas saem do ar com o tempo.
- **Remuneração**: média, mediana, mínima/máxima (com nome do empregador),
  quebra por tipo e por curso, comparativo técnico × superior e Gestão
  Ambiental × Engenharia Sanitária e Ambiental, tabela de detalhamento
  completo — parser de texto livre em R$ com tolerância a formatos variados.

## 2026-07-13 — PWA, paginação e conteúdo

- **BIO vira PWA instalável**: ícones PNG, manifest com screenshots, service
  worker (rede-primeiro), botão de instalação com fallback manual pra iOS,
  aviso de nova versão disponível, e página dedicada `/instalar-app` com link
  permanente no rodapé.
- **Paginação do feed público de vagas** (10 por página, estilo Google) — a
  lista crescia sem limite e ficava difícil chegar ao rodapé.
- **Guia "Como se candidatar" reescrito**: currículo compatível com triagem
  automática (ATS), LinkedIn, portfólio, entrevistas modernas, uso ético de
  IA — substitui o conteúdo genérico anterior.
- **Newsletter**: corrige contagem falsa no e-mail de aviso (usava `.limit()`
  antes de contar) e adiciona header `List-Unsubscribe`.

## 2026-07-12 — Curadoria

- Republicação manual de vagas com falso positivo de "link inativo" (sites
  com proteção anti-bot podem bloquear o verificador automático mesmo com a
  vaga no ar).

## 2026-07-10 — Canal D e correções de classificação

- **Canal D**: captura de vaga por print/PDF, extraída e classificada pela
  IA (Gemini multimodal) numa única chamada.
- Corrige classificação de tipo público×privado, busca funcional e filtros
  da home.

## 2026-07-06 a 2026-07-09 — Curadoria assistida por IA

- Classificação de vagas com Gemini (score de aderência, recomendação,
  justificativa), com aprendizado contínuo via few-shot das decisões reais
  da coordenação.
- IA lê a página da vaga (não só título/e-mail) via fetch direto, fallback
  Jina Reader e Firecrawl (anti-bot).
- Detecção de vaga encerrada, extração de curso/nível/tipo/remuneração,
  filtros de ruído nacional e boilerplate de digest (InfoJobs/Catho/LinkedIn).
- Relatórios de perfil de mercado por curso e área temática.

## 2026-07-03 a 2026-07-05 — Fundação do projeto

- Projeto criado; feed público de vagas com busca e filtros; painel da
  coordenação (login, fila de curadoria, dashboard); Canal A (RSS/Google
  Alerts) e Canal B (e-mail, via `ingest-email`); páginas institucionais
  ("Como se candidatar", política de privacidade); feedback da comunidade
  (botões "Já me candidatei"/"Informar problema").
