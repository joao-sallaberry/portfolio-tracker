# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install            # needs npm >= 11 (npm 9/10 crash on this dependency tree; use `npx npm@11 install`)
npm run dev            # Vite dev server on http://localhost:8080
npm run build          # production build
npm run lint           # eslint
npm run test           # vitest run (all tests)
npx vitest run src/lib/portfolio-calculations.test.ts      # single file
npx vitest run -t "should calculate positions"             # single test by name
npm run test:e2e                                           # Playwright against the production build
npx playwright test -g "IR taxes"                          # single e2e test by name
```

E2E tests (`e2e/*.e2e.ts`, config in `playwright.config.ts`) build the app, serve it with `vite preview` on port 4173 and log in as the dedicated test account from `.env.test.local` (`TEST_USER_EMAIL` / `TEST_USER_PASSWORD`). They run against the hosted Supabase project and **wipe that account's data first**, so they run serially and build on each other's data (`e2e/support/fixtures.ts`, dated relative to the current year). Never point them at a real account. They use a system Chromium when one is installed (`/snap/bin/chromium`); Snap Chromium can't read the host `/tmp`, so pass uploads as `{ name, mimeType, buffer }`. Currency strings contain a non-breaking space after `R$`: plain-string `toContainText` handles it, regexes need `\s`.

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env` (read by `src/integrations/supabase/client.ts`). `.env` is gitignored; copy it from `.env.example`. There is no local Supabase setup; the app talks to the hosted project whose id is set in `supabase/config.toml`. TypeScript runs non-strict (`strict: false`, `noImplicitAny: false`).

## Deploy

The frontend is hosted on Vercel (https://portfolio-tracker-blue-six.vercel.app), which builds and deploys every push to `main` through its GitHub integration; there is no deploy script. `vercel.json` rewrites every path to `index.html` so deep links (`/auth`, `/redefinir-senha` from emails) work. The build reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from Vercel's environment variables and fails if they are missing (`vite.config.ts`), so a misconfigured deploy leaves the previous version live. Database changes are applied to Supabase separately (migrations), not by the deploy.

## What this is

A client-only React SPA (Vite + TS + Tailwind + shadcn/ui + TanStack Query + Supabase) for tracking a personal portfolio on the Brazilian exchange (B3): import broker statements, browse trades and dividends, see the cost-basis position, and work out income tax (IR). The UI, routes and page names are in Brazilian Portuguese (`/negociacoes`, `/proventos`, `/posicao`, `/imposto-renda`, `/importar`). Keep new UI text in pt-BR and use `formatCurrencyBRL`/`formatDateBR` from `src/lib/formatters.ts`.

`ARCHITECTURE.md` has a detailed walkthrough (schema, import pipeline, page logic, known gaps). Keep it in sync when behavior changes.

## Architecture essentials

- **No backend logic.** No edge functions, views or stored procedures. All computation (average cost, positions, taxes, import deduplication) runs in the browser. Supabase is only Postgres + Auth, with RLS restricting every row to `auth.uid()::text = user_id`. Inserts must set `user_id`.
- **Dates** from the database are `YYYY-MM-DD` strings. Parse them with `parseISODateLocal()`, never `new Date(str)`, which reads them as UTC midnight and shifts them to the previous day in Brazil.
- **Data fetching.** Read trades and dividends with `useTradeOperations()` / `useDividendEvents()` from `src/hooks/use-portfolio-data.ts` (all of the user's rows, oldest first, shared cache), then filter and aggregate in memory. Anything that writes these tables must invalidate `TRADE_OPERATIONS_KEY` / `DIVIDEND_EVENTS_KEY`. A plain `select()` stops at 1000 rows; use `fetchAllPages()` with an order that ends in `id` for any other full-table read.
- **Tables:** `trade_operations`, `dividend_events` and `ir_initial_losses` (the IR page's initial accumulated loss); `supabase/schema_unified.sql` is the full current schema. A schema change needs three things: a new file in `supabase/migrations/` whose version matches the one registered in production's migration history, the same change in `schema_unified.sql`, and regenerated `src/integrations/supabase/types.ts`. Replaying the migrations and running `schema_unified.sql` produce the same schema.
- **Movement types** (`movement_type`): `BUY`, `SELL`, `BONUS`, `SPLIT`, `REVERSE_SPLIT`, `AMORTIZATION`. `normalizeMovementType()` in `formatters.ts` maps them from the Portuguese broker labels. Split, reverse split and bonus rows change quantity; amortization reduces cost.
- **Average cost has a single implementation.** `applyTradeToCostBasis()` in `src/lib/portfolio-calculations.ts` holds the weighted-average rule for each movement type. A SELL or REVERSE_SPLIT that takes the quantity to zero or below resets the position. `calculatePositions` (Posição and the dashboard), `calculateCostBasis`, `sortTradesByDate` and the IR calculations build on it, so change the rules there and cover the change in `portfolio-calculations.test.ts`.
- **IR rules** live in `src/lib/ir-calculations.ts` (tested in `ir-calculations.test.ts`); `ImpostoRenda.tsx` only fetches and renders. Tax groups are Ações+ETFs at 15%, FIIs at 20%, and FI-Infra/FIP exempt. Tax is charged on each month's consolidated result (all gains and losses of the month net out, in any order). Losses carry forward: each month's result is offset against the accumulated loss (starting from a user-entered initial loss per group/year) before tax. Stock sales of ≤ R$20k in a month are exempt (`has_exemption`). Sales with `exclude_from_ir = true` still appear but don't count toward totals, the exemption or the accumulated loss. Users toggle this in `Negociacoes`.
- **Asset classification** (`src/lib/asset-classifier.ts`): bundled CSVs in `src/data/` are imported with `?raw` and matched on the first 4 characters of the ticker, checked in the order ETF → FII → FI-Infra → FIP → Ação → `Outro`. To add a new ticker, edit the CSV.
- **Tickers** are always stored normalized by `normalizeTicker()` (`formatters.ts`): uppercase, without the fractional-market `F` suffix (`PETR4F` → `PETR4`). Apply it wherever a ticker enters the database.
- **Import** (`src/pages/Import.tsx` + `src/lib/xlsx-parser.ts`): SheetJS parses B3 XLSX (proventos and negociações) or a simplified negociações CSV (`parseNegociacaoFileAuto` picks the format). The B3 movements statement (`src/lib/b3-movimentacao.ts`) only contributes dividends and corporate events (splits, whole-share bonuses at zero cost, amortizations, redemptions); never take buys/sells from it, since "Transferência - Liquidação" also covers securities lending. Before insert, rows are deduplicated against all existing rows through a frequency map on the business columns (`src/lib/import-dedupe.ts`). That map lets the same file be re-imported safely while legitimate identical rows are kept.
- `src/components/ui/` is unmodified shadcn/ui output; add new components with the shadcn CLI (`components.json`) rather than editing them by hand. Exception: `chart.tsx` comes from the `new-york-v4` registry (the only one built for Recharts 3) with its Tailwind 4 classes mapped to Tailwind 3, as noted at the top of the file; the shadcn CLI targets Tailwind 4, so refresh it the same way. The `@/` alias points to `src/`.
