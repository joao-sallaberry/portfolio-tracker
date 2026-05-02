# Portfolio Tracker

Portfolio Tracker is a single-page web application (SPA) for managing personal investment portfolios on the Brazilian stock market (**B3**). 

It provides an intuitive interface to import brokerage account statements, browse trade operations and dividend events, view aggregated positions, and analyze income tax obligations.

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)

## ✨ Core Features

- **Data Import**: Supports importing B3/brokerage account statements in XLSX and CSV formats for both Trade Operations (Negociações) and Dividend Events (Proventos).
- **Position Tracking**: Calculates and aggregates your current position (quantity × average cost) per asset, sorted by asset class (Ações, FIIs, ETFs, FI-Infra, FIP).
- **Income Tax Calculator**: Computes capital gains, losses, and accumulated taxes per month/year following Brazilian tax rules.
- **Rich Dashboard**: Visualizes your portfolio distribution, dividend history, and total net invested value through interactive charts.
- **Secure Data**: Multi-tenant architecture with Row-Level Security (RLS) via Supabase Auth. Data is completely isolated per user.

## 🛠 Tech Stack

- **Frontend Framework**: React 18
- **Build Tool**: Vite 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Routing**: React Router v6
- **Data Fetching**: TanStack React Query v5
- **Backend/Auth**: Supabase (PostgreSQL)
- **Charts**: Recharts
- **File Parsing**: SheetJS (XLSX)

## 🚀 Getting Started

### Prerequisites

Ensure you have Node.js and npm installed on your machine.

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd portfolio-tracker
```

2. Install dependencies:
```bash
npm install
```

3. Configure Environment Variables:
Create a `.env` file in the root directory and add your Supabase credentials:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:8080`).

## 🧪 Running Tests

The application includes unit tests for the core business logic (e.g., portfolio and average cost calculations).

To run the tests, execute:
```bash
npm run test
```

## 📐 Architecture & Logic

All business logic (average price calculations, tax computation, deduplication) runs **client-side** in React. 
- The deduplication logic acts on a per-user basis before insertion, utilizing a frequency map and unique database indices.
- Asset classification (Ações, FIIs, ETFs, etc.) is handled via static CSV lookups bundled at build time.

For a deeper dive into the database schema, data flows, and project structure, please refer to the [ARCHITECTURE.md](ARCHITECTURE.md) file.
