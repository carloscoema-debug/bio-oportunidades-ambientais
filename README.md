# BIO — Observatório Institucional de Oportunidades Ambientais

Portal de divulgação curada de vagas de estágio e emprego na área ambiental
para estudantes e egressos do Curso Técnico em Meio Ambiente do IFCE Campus Fortaleza.

## Stack
- **Front-end:** TanStack Start + TanStack Router, React 19, Tailwind v4, shadcn/Radix (Bun)
- **Back-end:** Supabase (PostgreSQL, RLS, Edge Functions, pg_cron) — projeto próprio conectado
- **Editor:** Lovable (sincronização bidirecional com este repositório, branch `main`)

## Arquitetura (regras invioláveis)
- O front-end é só interface. Nenhuma lógica de negócio, chave secreta ou parsing no cliente.
- O portal público lê **somente** a view `vagas_publicas` e as tabelas de referência.
- Escrita anônima apenas via RPC (`registrar_feedback`, `registrar_clique`).
- Publicação de vaga é sempre decisão humana (bloqueios duros no banco).

## Rodar localmente
```bash
bun install
bun run dev
```

## Padrão visual
"Guia de Campo Contemporâneo" — ver `PADRAO_VISUAL.md` (documentação do projeto).
