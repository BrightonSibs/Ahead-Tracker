# AHEAD Research Output Tracker

**Production-ready research publication and citation tracking system for Saint Louis University - AHEAD & HCOR departments.**

---

## Project Overview

This project is a faculty research tracking platform built for Saint Louis University's AHEAD and HCOR departments. It brings researcher profiles, publications, citation history, collaboration insights, and exports into one system so faculty output can be reviewed in a consistent and auditable way.

### Problem

- Faculty publications are spread across multiple academic sources such as CrossRef, PubMed, ORCID, and Google Scholar.
- Researcher names often appear in different formats, which makes author matching unreliable.
- Citation tracking, SLU-only reporting, and department-level analytics are time-consuming when done manually.
- Administrative review is harder when changes and overrides are not stored in a single system.

### Solution

- A centralized dashboard for researchers, publications, analytics, collaborations, and reports
- Identity matching that supports aliases, ORCID, and confidence scores
- Citation snapshots over time so trends can be visualized instead of stored as a single count
- Role-based access for admins, analysts, and viewers
- Export and audit features to support reporting and governance

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js App Router, React, Tailwind CSS | UI, navigation, dashboards, tables |
| Backend | Next.js Route Handlers | Server-side API endpoints |
| Database | SQLite + Prisma | Local structured storage and ORM |
| Authentication | NextAuth + Prisma Adapter | Login, sessions, role-based access |
| Charts | Recharts | Analytics and visualization |
| Validation / Utilities | Zod, custom utility functions | Safer input handling and metrics |

### Backend Summary

- There is no separate Express, NestJS, or Supabase backend in this project.
- The backend is built into the Next.js app through files in `src/app/api/`.
- Local development currently stores data in `prisma/dev.db`.

---

## How It Works

1. Faculty researchers are stored with canonical names, aliases, identifiers, and department data.
2. Publication data can be seeded or synced from external research sources.
3. Prisma stores normalized data for researchers, publications, matches, citations, journals, and audit logs.
4. Next.js API routes fetch and update data for the frontend.
5. The UI displays dashboards, researcher profiles, publication details, collaboration views, and exports.

### Typical Data Flow

1. A researcher is created or seeded into the system.
2. Publications are matched using ORCID, exact names, aliases, or fuzzy logic.
3. Citation counts are stored as timestamped snapshots.
4. Admins review questionable matches or overrides.
5. Users analyze results through filters, charts, and reports.

---

## Demo Walkthrough

If you are presenting this project in class, a simple live demo flow is:

1. Log in as an `Admin` user.
2. Open the dashboard and explain the high-level metrics.
3. Show the researchers page and open one researcher profile.
4. Show a publication detail page and point out citation history and match data.
5. Open analytics or collaborations to show visual insights.
6. End on reports or admin sync to explain the practical administrative use case.

### Suggested 2-Minute Pitch

"This project is a research output tracker designed for Saint Louis University's AHEAD and HCOR departments. The goal is to solve a real data management problem: faculty publications and citations are spread across several academic platforms, and manual tracking is slow and error-prone. I built a full-stack web app with Next.js, Prisma, SQLite, and NextAuth that centralizes researcher records, publication metadata, citation history, and department analytics. One of the main challenges this project addresses is identity matching, because the same faculty member may appear under different names across sources. The app stores aliases, confidence scores, and audit information so the data is more transparent and easier to review. From a user perspective, admins can manage researchers and sync jobs, analysts can explore trends, and viewers can safely browse the results. Overall, the project demonstrates full-stack development, database design, authentication, data integration, and reporting in one system."

---

## Quick Start

### Prerequisites
- Node.js 18+
- SQLite (bundled through Prisma in local development)
- npm or yarn

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local and set DATABASE_URL and NEXTAUTH_SECRET
```

### 3. Set up the database
```bash
# Generate the Prisma client, create the local SQLite schema, and seed demo data
npm run db:setup
```

Or run the steps separately:

```bash
# Push schema to the local SQLite database in prisma/dev.db
npm run db:push

# Seed with all 14 faculty + demo publications
npm run db:seed
```

### 4. Start the development server
```bash
npm run dev
# Open http://localhost:3000
```

---

## Demo Credentials

| Role     | Email               | Password    | Access |
|----------|---------------------|-------------|--------|
| Admin    | admin@slu.edu       | admin123    | Full access - manage researchers, sync, admin panel |
| Analyst  | analyst@slu.edu     | analyst123  | Read + sync jobs - no user management |
| Viewer   | viewer@slu.edu      | viewer123   | Read-only - all pages, no edits |

---

## Faculty Seeded (from authoritative roster)

| ID | Name | Dept | ORCID | Aliases |
|----|------|------|-------|---------|
| 1  | Divya Subramaniam | HCOR | -- | 2 |
| 2  | Irene Ryan | AHEAD | Yes | 0 |
| 3  | Matthew C. Simpson | AHEAD | -- | 3 |
| 4  | Zidong Zhang | AHEAD | -- | 0 |
| 5  | Tong Si | HCOR | -- | 0 |
| 6  | Noor Al-Hammadi | HCOR | -- | 5 |
| 7  | Paula Buchanan | HCOR | Yes | 5 (includes prior name Stirnemann before marriage) |
| 8  | Dipti Subramaniam | HCOR | -- | 2 |
| 9  | Bahareh Rahmani | HCOR | -- | 1 |
| 10 | Jason M Doherty | AHEAD | -- | 2 |
| 11 | Joanne Salas | AHEAD | -- | 0 |
| 12 | Eric Armbrecht | AHEAD | -- | 2 |
| 14 | Tim Chrusciel | AHEAD | -- | 5 (includes abbreviated forms such as T Chrusciel and TP Chrusciel) |
| 15 | Paul Hitz | AHEAD | -- | 3 |

---

## Architecture

```text
src/
|-- app/                     # Next.js App Router pages
|   |-- dashboard/           # KPIs, dept trends, leaderboard
|   |-- researchers/         # Faculty table + profile pages
|   |   `-- [id]/            # Individual researcher profile
|   |-- publications/        # Filterable publications table
|   |   `-- [id]/            # Publication detail + citation history
|   |-- analytics/           # Charts: citations, h-index, specialties
|   |-- collaborations/      # Force-directed co-authorship network
|   |-- reports/             # CSV/PDF export
|   |-- admin/               # Admin panel
|   |   |-- researchers/     # Roster management
|   |   |-- sources/         # API credentials
|   |   |-- sync/            # Job history + manual triggers
|   |   `-- journals/        # Impact factor management
|   |-- login/               # Auth page
|   `-- api/                 # REST API routes
|-- components/
|   |-- ui/                  # Reusable components (Button, Card, KpiCard...)
|   |-- layout/              # Sidebar, TopBar, PageLayout
|   |-- charts/              # Recharts wrappers
|   `-- filters/             # URL-state filter system
|-- lib/
|   |-- prisma.ts            # DB client singleton
|   |-- auth.ts              # NextAuth config
|   |-- utils.ts             # h-index, i10, name similarity, tenure logic
|   `-- services/
|       |-- researchers.ts   # Researcher queries + collaboration graph
|       `-- publications.ts  # Publication queries + analytics aggregation
|-- types/                   # TypeScript interfaces
prisma/
|-- schema.prisma            # Full normalized schema (20+ tables)
`-- seed.ts                  # Faculty roster + demo publications
```

---

## Key Features

### Researcher Identity Matching
- `researcher_aliases` table stores all known name variants per faculty member
- Match types: ORCID (highest confidence) -> Exact -> Alias -> Fuzzy
- Confidence scores on every match - low-confidence matches trigger alerts
- Manual review queue in admin panel

### SLU Tenure Filtering
- Every publication match has `includedInSluOutput` boolean
- Computed at seed/ingest time: `pub.publicationDate >= researcher.sluStartDate`
- Toggle in UI switches between "all-time" and "SLU only" modes
- Transparent UI indicator on every filtered result

### Citation Tracking
- `citations` table stores snapshots with timestamps
- Multiple snapshots per publication enable trend visualization
- Latest snapshot used for current counts; full history for charts

### Impact Factor
- Historical IF stored per journal per year in `journal_metrics`
- Filtering uses publication year's IF, not current IF
- Upload via CSV or manual entry in admin

---

## Why This Project Is Interesting

- It solves a real organizational workflow instead of being only a demo app.
- It combines frontend, backend, authentication, database design, and analytics in one system.
- It includes data quality concerns such as identity matching, audit logs, and confidence scoring.
- It shows how software can turn scattered academic records into a usable dashboard for decision-making.

## Challenges And Lessons Learned

- Matching authors reliably is difficult because names are inconsistent across sources.
- Citation counts are not static, so storing historical snapshots is more useful than storing one number.
- Access control matters because admins, analysts, and viewers should not all have the same permissions.
- A normalized database design makes reporting and future expansion easier than storing everything in flat files.

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `researchers` | Canonical faculty records |
| `researcher_aliases` | All known name variants per researcher |
| `researcher_identifiers` | ORCID, Scholar ID, etc. |
| `publications` | Canonical publication records |
| `publication_authors` | Raw author strings per publication |
| `publication_researcher_matches` | Author->researcher links with confidence scores |
| `citations` | Time-series citation count snapshots |
| `journal_metrics` | Journal IF by year |
| `specialties` | Research specialty taxonomy |
| `publication_specialties` | Many-to-many publication<->specialty |
| `sync_jobs` | Ingestion job history and status |
| `manual_overrides` | Audit trail of admin overrides |
| `audit_logs` | Full entity change log |
| `alerts` | Data quality and system alerts |

---

## Data Sources

| Source | Role | API |
|--------|------|-----|
| CrossRef | Primary metadata (DOI, authors, journal); automatic sync supported | Free REST API |
| PubMed | Biomedical discovery; automatic sync supported | Free (API key for bulk) |
| ORCID | Identity resolution and publication harvesting for researchers with ORCIDs; automatic sync supported | Public API |
| Google Scholar | Citation counts; automatic sync supported when `SERPAPI_KEY` is configured | SerpAPI |
| ResearchGate | Supplemental | No public API |

### Sync Accuracy Notes
- CrossRef, PubMed, and ORCID syncs are fully automatic and rely on author-name, alias, DOI, PubMed ID, and ORCID matching.
- Google Scholar sync is most accurate when a researcher has a Scholar author/profile ID stored in `researcher_identifiers` using `GOOGLE_SCHOLAR_AUTHOR_ID`, `SCHOLAR_AUTHOR_ID`, or `SCHOLAR_PROFILE_ID`.
- Without a stored Scholar author/profile ID, the app falls back to author-name search and excludes citation-only results, but manual review is still recommended for ambiguous names.

---

## Production Deployment

```bash
# Build
npm run build

# Start
npm start

# Database migrations
npm run db:migrate
```

### Environment Requirements
- `DATABASE_URL` - SQLite or PostgreSQL connection string. Local development currently uses `file:./dev.db` relative to `prisma/schema.prisma`, which resolves to `prisma/dev.db`.
- `NEXTAUTH_SECRET` - Random 32-byte secret
- `NEXTAUTH_URL` - Public URL of the deployment
- `SERPAPI_KEY` - Optional, enables Google Scholar sync

---

## Pending Data Quality Items

1. **SLU start dates** - currently set to estimated dates; admin should verify and update
2. **ORCID iDs** - only 2 of 14 researchers have ORCIDs; obtaining them improves match quality
3. **Journal Impact Factors** - confirm institutional JCR access via SLU library for automated IF sync
4. **Google Scholar API coverage** - depends on a configured `SERPAPI_KEY` and Scholar query quality; review matches after sync

---

## Presentation Tips

- Focus first on the problem, then the workflow, then the tech stack.
- If your class is less technical, emphasize the user value and the data-quality challenge more than the folder structure.
- If your class is more technical, highlight the full-stack architecture, Prisma schema design, and role-based authorization.
- Mention that the local backend uses SQLite now, but Prisma allows the same app to move to PostgreSQL later with minimal application changes.
