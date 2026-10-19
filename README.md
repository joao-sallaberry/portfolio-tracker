# Portfolio Tracker

Portfolio Tracker is a single-page web application (SPA) for managing personal investment portfolios on the Brazilian stock market (**B3**).

It imports the statements B3 provides to every investor, keeps the trade and dividend history, shows the cost-basis position of each asset and works out the monthly income tax (IR) on sales.

Live app: https://portfolio-tracker-blue-six.vercel.app

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

## ✨ Core Features

- **Data Import**: Imports the B3 statements (XLSX) for trades (Negociações), dividends (Proventos) and custody movements (Movimentação), plus a simplified trades CSV. Re-importing a file or importing overlapping statements doesn't duplicate rows.
- **Position Tracking**: Calculates and aggregates your current position (quantity × average cost) per asset, sorted by asset class (Ações, FIIs, ETFs, FI-Infra, FIP).
- **Income Tax Calculator**: Computes capital gains, losses, and accumulated taxes per month/year following Brazilian tax rules.
- **Rich Dashboard**: Visualizes your portfolio distribution, dividend history, and total net invested value through interactive charts.
- **Accounts**: Email and password sign-up with password recovery. Row-Level Security (RLS) in Supabase isolates each user's data.

## 📥 Which statements to import

Download them from B3's [Área do Investidor](https://www.investidor.b3.com.br) → Extratos, as Excel files:

- **Negociação**: buys and sells. This is the only source of trades.
- **Movimentação**: dividends and corporate events (splits, bonus shares, amortizations). Buys and sells in it are ignored, since it mixes them with securities lending.
- **Proventos Recebidos**: dividends only. It overlaps with Movimentação; importing both is safe.

The import page previews every file and lists what will be skipped or needs a manual fix (e.g. the cost of bonus shares) before anything is saved.

## 🛠 Tech Stack

- **Frontend Framework**: React 19
- **Build Tool**: Vite 8
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router v8
- **Data Fetching**: TanStack React Query v5
- **Backend/Auth**: Supabase (PostgreSQL)
- **Charts**: Recharts 3
- **File Parsing**: SheetJS (XLSX)
- **Tests**: Vitest + Playwright
- **Hosting**: Vercel

## 🚀 Getting Started

### Prerequisites

Node.js 22 or newer and **npm 11** or newer. Older npm releases (such as the npm 9 packaged by Ubuntu) crash with `Cannot read properties of null (reading 'edgesOut')` while resolving this project's dependencies; run `npx npm@11 install` if you can't upgrade.

### Installation

1. Clone the repository:
```bash
git clone https://github.com/joao-sallaberry/portfolio-tracker.git
cd portfolio-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Configure Environment Variables:
Copy `.env.example` to `.env` and fill in your Supabase credentials (Project Settings → API):
```bash
cp .env.example .env
```
```env
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="https://your_project_id.supabase.co"
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:8080`).

## 🧪 Running Tests

Unit tests cover the business logic (average cost, income tax, statement parsing, import deduplication, ticker normalization, pagination):
```bash
npm run test
```

End-to-end tests drive the production build in Chromium with Playwright: they import sample statements and check the dashboard, positions, income tax and dividend pages, plus login and password reset.
```bash
npm run test:e2e
```

They need:
- A **dedicated test account** in your Supabase project. The tests **delete all of its data** before running, and refuse to run if its email doesn't contain "test". Put its credentials in `.env.test.local` (gitignored):
  ```env
  TEST_USER_EMAIL=you+test@example.com
  TEST_USER_PASSWORD=...
  ```
- **Chromium**: a system install is used when found (`/snap/bin/chromium`, `/usr/bin/chromium`, or `PLAYWRIGHT_CHROMIUM_PATH`); otherwise run `npx playwright install chromium`.

## 🚢 Deploy

Every push to `main` is built and deployed by Vercel. The build needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in Vercel's environment variables and fails without them. Database changes are applied to Supabase separately, as migrations in `supabase/migrations/`.

## 📐 Architecture

There is no backend code: parsing, deduplication, average cost and taxes all run in the browser, and Supabase only stores the data and handles auth. See [ARCHITECTURE.md](ARCHITECTURE.md) for the schema, the import pipeline and the business rules.
