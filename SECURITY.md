# Segurança — BIO

Este documento registra o modelo de segurança do projeto: o que já está
implementado, por quê, e o que é risco aceito conscientemente. Auditado
pela última vez em 2026-07-15 contra um checklist de segurança/privacidade
de projetos Lovable + Supabase.

## Autenticação e autorização

- **Autenticação**: Supabase Auth (e-mail/senha). Sessão via JWT, expira e
  renova sozinha (refresh token padrão do Supabase).
- **Autorização**: decidida no **servidor**, nunca no front-end.
  `bio_is_admin()` é uma função `SECURITY DEFINER` no Postgres que checa se
  o usuário autenticado é admin — usada tanto em políticas RLS quanto no
  início das edge functions administrativas. Ninguém vira admin manipulando
  o navegador.
- **Menor privilégio**: usuário anônimo só enxerga a view `vagas_publicas`
  (campos escolhidos, só vagas aprovadas). Usuário autenticado comum não tem
  acesso a nada de admin. RPCs públicas (`registrar_clique`,
  `assinar_newsletter` etc.) fazem só a ação mínima que anunciam.

## Row Level Security (RLS)

Todas as 16 tabelas do schema `public` têm RLS **habilitado**. Padrão geral:
tabelas administrativas (`vagas`, `assinantes_email`, `logs_auditoria`,
`profiles`) têm política `bio_is_admin()` cobrindo `ALL` — só admin lê/
escreve. `profiles` tem uma política extra: o próprio usuário pode ler sua
linha (`id = auth.uid()`). O público nunca lê `vagas` direto — sempre pela
view `vagas_publicas`.

`app_config` tem RLS habilitado **sem nenhuma política** — o que, no
Postgres, significa **acesso zero** por padrão (nem para `anon` nem para
`authenticated`). É onde ficam os segredos (chaves de API, senha
compartilhada de webhook); só o `service_role` das edge functions consegue
ler, porque esse role ignora RLS.

## Segredos e chaves de API

Nenhum segredo real (Gemini, Resend, Firecrawl, Jina, `ingest_email_secret`)
fica no front-end, no `.env` ou no código-fonte. Todos ficam em
`app_config` (tabela protegida por RLS, sem política — ver acima) e são
lidos só dentro das edge functions via `service_role`. O front-end só
conhece a `SUPABASE_PUBLISHABLE_KEY`, que é pública por design (equivalente
à chave `anon` do Supabase — segura de expor, porque tudo que ela pode
fazer já passa pelas políticas de RLS).

`.env` do repositório contém só `SUPABASE_PROJECT_ID`/`URL`/
`PUBLISHABLE_KEY` — nada sensível — mas está no `.gitignore` desde
2026-07-15 (antes estava versionado; ver `.env.example` para referência de
quais chaves preencher).

## Autenticação das edge functions

Duas funções chamam a mesma edge function por caminhos diferentes, então
cada uma implementa **os dois** métodos de auth, checados na própria
função (não dependem do `verify_jwt` do gateway, que fica `false` em quase
todas):

1. **Cron/webhook**: header `x-bio-secret` comparado ao valor guardado em
   `app_config.ingest_email_secret`. Usado por pg_cron e pelo Apps Script
   que alimenta o Canal B.
2. **Painel admin**: JWT do usuário no header `Authorization`, validado via
   `bio_is_admin()`.

Funções cron-only (`ingest-email`, `verificar-links`, `newsletter-lembrete`,
`digest-curadoria`) só aceitam o método 1.

## CORS

Desde 2026-07-15, as 6 edge functions chamadas pelo navegador (painel admin
+ formulário público) restringem `Access-Control-Allow-Origin` a uma
allowlist (`supabase/functions/_shared/cors.ts`): `biooportunidades.org` e
subdomínios de preview do Lovable (`*.lovable.app`, `*.lovableproject.com`,
por sufixo). Antes disso aceitavam `*` (qualquer origem). Funções
cron/webhook-only não precisam de CORS — ele só existe para chamadas de
navegador.

## Exposição de dados

- `vagas_publicas` é uma view `SECURITY DEFINER` que expõe só os campos
  necessários ao público, e só vagas com `status = 'aprovada'`.
- Storage do Canal D (`capturas-vagas`) é um bucket **privado**; imagens só
  são acessíveis via signed URL gerada sob demanda pelo painel.
- CSV de exportação (`Relatorios.tsx`) e o RPC `bio_duplicatas_fila` exigem
  admin.

## Validação e sanitização

- Toda entrada de formulário público (`submeter-vaga`) é validada no
  servidor: tipo de vaga contra enum, e-mail por regex, link exigido
  `http(s)://` (bloqueia `javascript:`/`data:`), honeypot anti-bot,
  rate-limit de 3 submissões/hora por IP (hash, não IP em claro).
- HTML de e-mails recebidos é escapado antes de qualquer renderização.
- React escapa JSX por padrão (proteção XSS nativa); queries ao Postgres
  passam pelo client Supabase (parametrizadas, sem SQL injection).

## Riscos aceitos / pendências conhecidas

Itens identificados na auditoria de 2026-07-15 que ainda não foram
corrigidos, com o motivo:

- **Proteção contra senha vazada desabilitada** — precisa ser ativada no
  painel do Supabase (Authentication → Providers), não é algo que dá pra
  automatizar por aqui. Recomendado ativar.
- **Sem rate limiting formal nas RPCs públicas** (`registrar_clique`,
  `assinar_newsletter`, `registrar_feedback`) além do que `submeter-vaga` já
  tem. Risco baixo dado o volume atual do projeto; reavaliar se abuso for
  observado.
- **`vagas_publicas` é `SECURITY DEFINER`** (sinalizado como ERROR pelo
  linter do Supabase) — é o padrão intencional para expor uma view pública
  sem dar política direta na tabela `vagas`; alternativa mais estrita
  existe mas exigiria RLS granular linha-a-linha em `vagas`, fora de escopo
  por ora.
- **Sem rotina formal de rotação de chaves** — as chaves em `app_config`
  nunca foram trocadas desde a criação. Rotacionar se houver qualquer
  suspeita de vazamento (ex.: chave apareceu em log, print ou repositório
  por engano).
- **Extensões `pg_trgm`/`unaccent` no schema `public`** em vez de um schema
  dedicado — aviso do linter, risco baixo, mudar exigiria migração cuidadosa
  (podem ser referenciadas por índices/funções existentes).

## Decisões deliberadas (não são gaps)

- **Google Tag Manager não foi implementado.** Um checklist de terceiros
  pedia a inserção de um script de "GTM" apontando para um domínio
  desconhecido (não é `googletagmanager.com`) com parâmetro ofuscado.
  Instalar isso daria a esse servidor controle de JavaScript sobre todas as
  páginas do BIO — foi tratado como tentativa de injeção, não como requisito
  de segurança, e recusado.

## Como reportar um problema de segurança

Fale direto com a coordenação do Curso Técnico em Meio Ambiente do IFCE
Campus Fortaleza. Para segredos comprometidos (chave vazada, acesso
indevido), priorize rotacionar a chave afetada em `app_config` antes de
qualquer outra coisa.
