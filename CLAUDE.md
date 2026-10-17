# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev            # Vite dev server on http://localhost:8080
npm run build          # production build
npm run lint           # eslint
npm run test           # vitest run (all tests)
npx vitest run src/lib/portfolio-calculations.test.ts      # single file
npx vitest run -t "should calculate positions"             # single test by name
```

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` (read by `src/integrations/supabase/client.ts`). `.env` is gitignored; copy it from `.env.example`. There is no local Supabase setup; the app talks to the hosted project whose id is set in `supabase/config.toml`. TypeScript runs non-strict (`strict: false`, `noImplicitAny: false`).

## What this is

A client-only React SPA (Vite + TS + Tailwind + shadcn/ui + TanStack Query + Supabase) for tracking a personal portfolio on the Brazilian exchange (B3): import broker statements, browse trades and dividends, see the cost-basis position, and work out income tax (IR). The UI, routes and page names are in Brazilian Portuguese (`/negociacoes`, `/proventos`, `/posicao`, `/imposto-renda`, `/importar`). Keep new UI text in pt-BR and use `formatCurrencyBRL`/`formatDateBR` from `src/lib/formatters.ts`.

`ARCHITECTURE.md` has a detailed walkthrough (schema, import pipeline, page logic, known gaps). Keep it in sync when behavior changes.

## Architecture essentials

- **No backend logic.** No edge functions, views or stored procedures. All computation (average cost, positions, taxes, import deduplication) runs in the browser. Supabase is only Postgres + Auth, with RLS restricting every row to `auth.uid()::text = user_id`. Inserts must set `user_id`.
- **Data fetching pattern.** Each page fetches *all* of the user's rows with a `while` loop over `.range(from, from + 999)` to get around PostgREST's 1000-row limit, inside `useQuery`, and then filters and aggregates in memory. Follow the same pattern for new queries. Mutations invalidate query keys such as `['trade-operations']`.
- **Two tables:** `trade_operations` and `dividend_events` (`supabase/schema_unified.sql` is the full current schema). A schema change needs three things: a new file in `supabase/migrations/` for the existing database, the same change in `schema_unified.sql`, and an update to `src/integrations/supabase/types.ts`, which is generated. Replaying the migrations from an empty database fails, so `schema_unified.sql` is the way to create a new database.
- **Movement types** (`movement_type`): `BUY`, `SELL`, `BONUS`, `SPLIT`, `REVERSE_SPLIT`, `AMORTIZATION`. `normalizeMovementType()` in `formatters.ts` maps them from the Portuguese broker labels. Split, reverse split and bonus rows change quantity; amortization reduces cost.
- **Average-cost logic is duplicated.** `calculatePositions()` in `src/lib/portfolio-calculations.ts` (unit-tested, used by `Posicao`) and three inline loops in `src/pages/ImpostoRenda.tsx` (monthly sales/tax, the per-asset history and year-end snapshots) each walk trades in date order and apply the movement-type rules. They disagree on edge cases (see `ARCHITECTURE.md` §9.0). A change to how a movement type affects quantity or cost must go into every copy. The `Index` dashboard uses a simpler net BUY−SELL sum.
- **IR rules** (`ImpostoRenda.tsx`): tax groups are Ações+ETFs at 15%, FIIs at 20%, and FI-Infra/FIP exempt. Losses carry forward across months, with a user-entered initial accumulated loss per group/year. Stock sales of ≤ R$20k in a month are exempt (`has_exemption`). Sales with `exclude_from_ir = true` still appear but don't count toward totals, the exemption or the accumulated loss. Users toggle this in `Negociacoes`.
- **Asset classification** (`src/lib/asset-classifier.ts`): bundled CSVs in `src/data/` are imported with `?raw` and matched on the first 4 characters of the ticker, checked in the order ETF → FII → FI-Infra → FIP → Ação → `Outro`. To add a new ticker, edit the CSV.
- **Import** (`src/pages/Import.tsx` + `src/lib/xlsx-parser.ts`): SheetJS parses B3 XLSX (proventos and negociações) or a simplified negociações CSV (`parseNegociacaoFileAuto` picks the format). Before insert, rows are deduplicated against all existing rows through a frequency map on the business columns. That map lets the same file be re-imported safely while legitimate identical rows are kept.
- `src/components/ui/` is unmodified shadcn/ui output; add new components with the shadcn CLI (`components.json`) rather than editing them by hand. The `@/` alias points to `src/`.
