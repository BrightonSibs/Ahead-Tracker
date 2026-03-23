# AHEAD Research Output Tracker

**Production-ready research publication and citation tracking system for Saint Louis University - AHEAD & HCOR departments.**

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
