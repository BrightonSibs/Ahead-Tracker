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

Copy `.env.example` to `.env.local` and set at least:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="replace-with-a-random-secret"
NEXTAUTH_URL="http://localhost:3000"
```

Optional:

```env
CROSSREF_EMAIL="research@slu.edu"
NCBI_API_KEY="..."
ORCID_CLIENT_ID="..."
ORCID_CLIENT_SECRET="..."
OPENALEX_EMAIL="research@slu.edu"
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

### Account settings

Signed-in users can change their password from the sidebar footer or by visiting `/account/password`.

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
npm run smoke
npm run audit:final

npm run db:setup
npm run db:push
npm run db:seed
npm run db:studio
npm run db:migrate

npm run db:clean-name-matches:check
npm run db:clean-name-matches
npm run db:dedupe-publications:check
npm run db:dedupe-publications
npm run db:exclude-questionable-scholar-matches:check
npm run db:exclude-questionable-scholar-matches
npm run db:repair-journal-names:check
npm run db:repair-journal-names
npm run db:recompute-publication-statuses:check
npm run db:recompute-publication-statuses
```

## Project Structure

```text
src/
  app/
    admin/               Admin pages
    account/             Logged-in account settings
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
  clean-name-matches.js
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
- strict researcher-publication matching using canonical names, approved aliases, ORCID, and verified profile identifiers
- Google Scholar imports only persist when author evidence is clean or the record is enriching an already trusted publication link
- manual correction tools for wrong matches
- exclusion of pre-tenure output
- admin edit/delete workflow for bad imports
- duplicate prevention across sources using DOI, PubMed ID, source-record IDs, and title/year/journal/author overlap checks

### Citations

- timestamped citation snapshots
- current captured-citation rollups based on the latest stored snapshot per publication
- observed citation growth charts based on stored snapshots
- missing citation snapshots render as blank or `-` instead of being treated as zero

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

### Authentication and navigation

- NextAuth credentials-based sign-in
- in-app password change flow for authenticated users
- admin-only password reset flow from the Administration page
- cleaner sign-out handling and session-aware redirects
- shared top-bar action layout across key app screens
- lazy-loaded chart bundles for faster route transitions

## Backend Notes

The backend lives in `src/app/api`.

Important routes include:

- `src/app/api/admin/users/reset-password/route.ts`
- `src/app/api/analytics/route.ts`
- `src/app/api/account/password/route.ts`
- `src/app/api/collaborations/route.ts`
- `src/app/api/export/route.ts`
- `src/app/api/journals/route.ts`
- `src/app/api/publications/route.ts`
- `src/app/api/researchers/route.ts`
- `src/app/api/admin/sync/route.ts`
- `src/app/api/health/route.ts`

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
- Europe PMC
- ORCID
- OpenAlex
- Google Scholar via SerpAPI
- ResearchGate noted as supplemental/manual only

The admin Data Sources screen uses local copies of official brand assets stored in `public/source-logos`.

Sync and matching logic is implemented in `src/lib/services/sync.ts`.

## Verification Status

Publications use a simple governance status model:

- `VERIFIED`
- `UNVERIFIED`
- `NEEDS_REVIEW`

Automatic sync now upgrades status conservatively:

- ORCID-backed and strongly corroborated records can be marked `VERIFIED`
- Google Scholar-only records are not auto-trusted just because they appear in a Scholar profile
- ambiguous records stay `UNVERIFIED` or move to `NEEDS_REVIEW`

## Operations Notes

- `GET /api/health` provides a simple application and database health check for deployments.
- `npm run smoke` performs a lightweight smoke test against `/login` and `/api/health`.
- `npm run audit:final` performs an authenticated end-to-end audit of key pages, detail views, APIs, and exports.
- Demo login shortcuts are hidden automatically when `NODE_ENV=production`.
- The root app layout is forced dynamic so protected, session-aware routes build and start cleanly in production.

## Data Quality and Maintenance

### Deduplication

The project includes a cleanup script for publication deduplication:

```bash
npm run db:dedupe-publications:check
npm run db:dedupe-publications
```

### Strict name enforcement

The platform includes a separate cleanup path for enforcing approved researcher names and aliases:

```bash
npm run db:clean-name-matches:check
npm run db:clean-name-matches
```

This removes researcher-publication links that do not match the configured canonical name, approved alias list, ORCID, or verified source identifier rules.

### Google Scholar cleanup

Questionable Scholar-linked records can be reviewed and excluded with:

```bash
npm run db:exclude-questionable-scholar-matches:check
npm run db:exclude-questionable-scholar-matches
```

This is intended for Scholar results that were imported earlier under looser rules and should no longer count as trusted matched output.

### Journal name repair

The project includes a journal cleanup script for malformed or noisy journal values:

```bash
npm run db:repair-journal-names:check
npm run db:repair-journal-names
```

This is especially useful for Scholar-derived publication strings that include host fragments, trailing volume/page text, or other non-journal noise.

### Verification status recomputation

If sync rules change, publication governance status can be recomputed in bulk:

```bash
npm run db:recompute-publication-statuses:check
npm run db:recompute-publication-statuses
```

This applies the current automatic verification policy to existing data without changing manually curated publication content.

### Citation trend interpretation

The dashboard's citation trend charts use observed growth from stored snapshots. They should be read as growth recorded by the system over time, not as a guaranteed full historical citation timeline when earlier snapshots do not exist.

Aggregate citation figures throughout the UI are best read as captured citations, meaning totals based only on publications that currently have at least one stored citation snapshot.

## Deployment

```bash
npm run build
npm run start
```

For production, set:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `OPENALEX_EMAIL` if OpenAlex sync should run in the polite pool
- `SERPAPI_KEY` if Google Scholar sync is needed
- `NCBI_API_KEY` if you want higher PubMed throughput

SQLite works for local development. Prisma makes it possible to move to PostgreSQL later if needed.

Recommended release checks:

```bash
npm run lint
npm run build
npm run audit:final
```
