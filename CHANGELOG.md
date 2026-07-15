# Changelog — BIO

Registro das mudanças relevantes do projeto, mais recentes primeiro. Cada
entrada tem a data, o que mudou e por quê (quando não é óbvio). Commits
automáticos do Lovable sem descrição própria ("Changes", "Work in progress")
não aparecem aqui — só mudanças com intenção registrada.

Ao abrir um PR ou fazer push direto, adicione uma linha nesta seção
correspondente à data (crie uma nova se for um dia novo).

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
