# AHEAD Research Output Tracker

Research publication, citation, and researcher management system for Saint Louis University's AHEAD and HCOR departments.

## Overview

This is a Next.js full-stack application for managing:

- researcher profiles and aliases
- matched publications and author links
- citation snapshots over time
- journal impact factors by year
- collaboration analytics and reporting
- sync jobs from external academic sources

The app uses a single Next.js codebase for both frontend and backend. There is no separate Express/Nest/Supabase service in this project.

## Stack

- Next.js App Router
- React
- Tailwind CSS
- NextAuth
- Prisma
- SQLite for local development
- Recharts
- jsPDF for PDF export

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Install

```bash
npm install
```

### Configure environment

Create `.env.local` and set at least:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Optional:

```env
SERPAPI_KEY="..."
```

With the default `DATABASE_URL`, Prisma resolves the SQLite database to `prisma/dev.db`.

### Database setup

```bash
npm run db:setup
```

That will:

- generate the Prisma client
- push the schema
- seed demo data

You can also run the steps separately:

```bash
npm run prisma:generate
npm run db:push
npm run db:seed
```

### Start the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@slu.edu` | `admin123` |
| Analyst | `analyst@slu.edu` | `analyst123` |
| Viewer | `viewer@slu.edu` | `viewer123` |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint

npm run db:setup
npm run db:push
npm run db:seed
npm run db:studio
npm run db:migrate

npm run db:dedupe-publications:check
npm run db:dedupe-publications
```

## Project Structure

```text
src/
  app/
    admin/               Admin pages
    analytics/           Analytics dashboard
    collaborations/      Co-authorship network
    dashboard/           Main KPI dashboard
    login/               Auth page
    publications/        Publication list + detail
    reports/             CSV/PDF export UI
    researchers/         Researcher list + profile
    api/                 Route handlers
  components/
    branding/
    charts/
    layout/
    ui/
  lib/
    auth.ts
    citation-metrics.ts
    prisma.ts
    services/
      publications.ts
      researchers.ts
      sync.ts
    utils.ts
  types/
prisma/
  schema.prisma
  seed.ts
scripts/
  dedupe-publications.js
```

## Key Features

### Researcher management

- canonical researcher records
- aliases and alternate names
- ORCID and other identifiers
- SLU start dates
- specialty tagging

### Publication management

- publication metadata from multiple sources
- researcher-publication matching with confidence values
- manual correction tools for wrong matches
- exclusion of pre-tenure output
- admin edit/delete workflow for bad imports

### Citations

- timestamped citation snapshots
- current total citation rollups
- observed citation growth charts based on stored snapshots

### Journal metrics

- year-specific impact factors
- admin CRUD for journal metrics
- CSV import for journal metric records
- filtering by publication-year impact factor

### Reporting and analytics

- dashboard KPIs
- department comparison charts
- specialty analytics
- co-authorship network
- CSV export
- PDF export

## Backend Notes

The backend lives in `src/app/api`.

Important routes include:

- `src/app/api/analytics/route.ts`
- `src/app/api/collaborations/route.ts`
- `src/app/api/export/route.ts`
- `src/app/api/journals/route.ts`
- `src/app/api/publications/route.ts`
- `src/app/api/researchers/route.ts`
- `src/app/api/admin/sync/route.ts`

Core query/service logic lives in:

- `src/lib/services/publications.ts`
- `src/lib/services/researchers.ts`
- `src/lib/services/sync.ts`

## Database Model

Main tables include:

- `researchers`
- `researcher_aliases`
- `researcher_identifiers`
- `publications`
- `publication_authors`
- `publication_researcher_matches`
- `citations`
- `journal_metrics`
- `specialties`
- `publication_specialties`
- `sync_jobs`
- `alerts`
- `audit_logs`
- `manual_overrides`

The Prisma schema is defined in `prisma/schema.prisma`.

## Data Sources

Supported or partially supported sources:

- CrossRef
- PubMed
- ORCID
- Google Scholar via SerpAPI
- ResearchGate noted as supplemental/manual only

Sync and matching logic is implemented in `src/lib/services/sync.ts`.

## Data Quality and Maintenance

### Deduplication

The project includes a cleanup script for publication deduplication:

```bash
npm run db:dedupe-publications:check
npm run db:dedupe-publications
```

### Citation trend interpretation

The dashboard's citation trend charts use observed growth from stored snapshots. They should be read as growth recorded by the system over time, not as a guaranteed full historical citation timeline when earlier snapshots do not exist.

## Deployment

```bash
npm run build
npm run start
```

For production, set:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `SERPAPI_KEY` if Google Scholar sync is needed

SQLite works for local development. Prisma makes it possible to move to PostgreSQL later if needed.
