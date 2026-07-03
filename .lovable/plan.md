# Plano — Fundação do BIO (Observatório de Oportunidades Ambientais)

Entrega apenas a fundação visual e estrutural. Sem dados, sem schema, sem lógica de negócio. Ao final, paro e aguardo a migração SQL.

## 1. Backend (Lovable Cloud / Supabase)

- Não Habilitar Lovable Cloud, será integrado uma conta propria do supabase. O cliente já vem configurado usando apenas a publishable/anon key (`src/integrations/supabase/client.ts`) — nenhuma service_role no front.
- **Não** criar tabelas, RPCs, policies ou views. O schema virá da sua migração.
- Nenhuma chamada ao banco nesta etapa (as telas ainda não têm dados).

## 2. Tipografia (Google Fonts)

Adicionar `<link>` no `head()` do `src/routes/__root.tsx` (nunca `@import` remoto no CSS):

- Bricolage Grotesque 500/700/800
- Atkinson Hyperlegible 400/700
- Spline Sans Mono 500/600

## 3. Design tokens em `src/styles.css`

- Definir todas as variáveis do brief em `:root` (--paper, --surface, --surface-dim, --line, --line-strong, --ink, --ink-soft, --ink-faint, --mata, --mata-deep, --mata-tint, --mata-line, --sol, --sol-tint, --barro, --barro-tint, --ceu, --ceu-tint, --whatsapp, --radius, --radius-sm, --radius-pill).
- Mapear em `@theme inline` para gerar utilitários Tailwind semânticos (`bg-paper`, `text-ink`, `bg-mata`, `border-line` etc.) e famílias `font-display`, `font-body`, `font-mono`.
- `body`: `background: var(--paper)`, `font-family: Atkinson Hyperlegible`, cor `--ink`, `line-height: 1.55`, tamanho base 16px.
- Utilitário `.mono-caps` para metadados (mono, uppercase, letter-spacing).
- Anel de foco verde (`--mata`) global; respeitar `prefers-reduced-motion`.
- Padrão topográfico: SVG inline como `background-image` em `data:` URL aplicado ao `body`, traço `--ink` a ~4,5% de opacidade, sutil.

## 4. Estrutura de rotas (TanStack Router)

```
src/routes/
  __root.tsx          → head com fontes + meta pt-BR; shell HTML lang="pt-BR"
  index.tsx           → "/" portal público (SiteLayout: header + main + footer)
  admin.tsx           → "/admin" login placeholder (layout próprio, sem header/footer do portal)
```

- Atualizar `head()` do root: `<html lang="pt-BR">`, title "BIO — Observatório de Oportunidades Ambientais", description institucional pt-BR, og/twitter equivalentes. Remover placeholders "Lovable App".

## 5. Componentes de layout (`src/components/layout/`)

- `**SiteHeader.tsx**` — fixo no topo, fundo `--surface` com borda `--line`; wordmark "BIO" em Bricolage 800 + ponto final em `--mata`; sublinha mono caps "OBSERVATÓRIO DE OPORTUNIDADES AMBIENTAIS" em `--ink-soft`. Alvos ≥44px.
- `**SiteFooter.tsx**` — institucional. Disclaimer oficial (minuta F0-03, sujeita a aprovação da coordenação):
  > O BIO é operado pela Coordenação do Curso Técnico em Meio Ambiente do IFCE Campus Fortaleza. As oportunidades são divulgadas como serviço de informação — o IFCE não conduz, não endossa e não se responsabiliza pelos processos seletivos, pelas condições dos vínculos nem pela idoneidade dos anunciantes.
  Três links: "Como se candidatar", "Divulgue uma oportunidade", "Política de privacidade" (placeholders `#`); rótulos em mono caps.
- `**SiteLayout.tsx**` — wrapper: `min-h-screen bg-paper` + padrão topográfico, `<main>` com `max-w-[680px] mx-auto px-4`.

## 6. Página "/" (sem dados)

- Header + Footer.
- Faixa de contexto (hero editorial):
  - Rótulo mono caps ("EDIÇÃO ATUAL · CEARÁ").
  - h1 display: "Oportunidades ambientais no Ceará, selecionadas para você" (`clamp(26px, 6vw, 34px)`, Bricolage 700).
  - Subtítulo corpo: explica curadoria para estudantes e egressos do Técnico em Meio Ambiente do IFCE Fortaleza.
- Sem cards, filtros ou placeholders "em breve" — hero limpo aguardando os próximos prompts.

## 7. Página "/admin" (placeholder de login)

- Layout próprio, centralizado, cartão `--surface` com borda `--line`.
- Título "Painel da coordenação" (display), subtítulo mono caps "ACESSO RESTRITO".
- Formulário visual (e-mail + senha + botão primário verde-mata "Entrar") **sem lógica** — `onSubmit` apenas previne default. Nota discreta: "Autenticação será configurada na próxima etapa."

## 8. Restrições respeitadas

- Zero lógica de negócio, zero consulta ao banco, zero schema.
- Nenhum modal, pop-up, banner de cookies.
- Somente anon key; nenhum segredo no código.
- Nada de Inter/Roboto/Arial.

## Detalhes técnicos

- Fontes via `links` em `Route.head()` do `__root.tsx` (preconnect + stylesheet). Em `src/styles.css`, apenas nomes das famílias em `--font-display/--font-body/--font-mono` sob `@theme`.
- Tokens em `@theme inline` para permitir `bg-paper`, `text-mata`, `border-line-strong` etc., mantendo os hex exatos do brief.
- Padrão topográfico: SVG com curvas leves, `stroke="#1B2A21"` `stroke-opacity="0.045"`, tile ~400×400, como `background-image` do `body`.
- `prefers-reduced-motion`: sem animações nesta etapa; regra global preparada para o futuro.

Depois desta entrega eu paro e aguardo (a) sua migração SQL e (b) os próximos prompts de UI.