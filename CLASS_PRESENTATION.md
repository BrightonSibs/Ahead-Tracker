# AHEAD Tracker Class Presentation

## Slide 1: Title

**AHEAD Research Output Tracker**

Subtitle:
Faculty publication and citation tracking platform for Saint Louis University's AHEAD and HCOR departments

What to say:
This project is a full-stack web application designed to help academic departments track researcher profiles, publications, citations, and reporting in one place. The goal is to reduce manual tracking and make research data easier to review and analyze.

---

## Slide 2: Problem

### The problem this project solves

- Faculty publications are spread across multiple external sources
- Researcher names appear in different formats across systems
- Citation counts change over time and are hard to track manually
- Reporting for departments can become slow, inconsistent, and error-prone

What to say:
The core issue is that academic research data is fragmented. A faculty member might appear with different names in CrossRef, PubMed, ORCID, or Google Scholar, which makes matching and reporting difficult. This project centralizes that information and adds structure around it.

---

## Slide 3: Solution

### What the app does

- Stores researcher records, aliases, identifiers, and department info
- Tracks publications and links them to the correct researchers
- Stores citation history over time
- Provides dashboards, analytics, collaborations, and reports
- Supports different user roles such as admin, analyst, and viewer

What to say:
Instead of treating this like a simple list of publications, I designed it as a research management system. It handles identity matching, role-based access, data review, and analytics so the information is useful to both administrators and faculty stakeholders.

---

## Slide 4: Tech Stack

### Main technologies

- Frontend: Next.js, React, Tailwind CSS
- Backend: Next.js API route handlers
- Database: SQLite with Prisma ORM
- Authentication: NextAuth
- Charts and analytics: Recharts

What to say:
This project does not use Supabase or a separate backend server. The backend is built into the Next.js application through API routes, and the current local database is a SQLite file managed by Prisma. That made it easier to build and test the full stack in one project.

---

## Slide 5: How It Works

### Basic workflow

1. Researchers are stored with names, aliases, and identifiers
2. Publication data is seeded or synced from external sources
3. Matches are created between publications and researchers
4. Citation snapshots are saved over time
5. Users explore dashboards, analytics, and reports

What to say:
The most interesting part technically is the matching layer. Because names are inconsistent across academic platforms, the app uses aliases, identifiers like ORCID, and confidence-based logic to connect publications to the right faculty members.

---

## Slide 6: Database And Backend

### Backend structure

- API routes live in `src/app/api/`
- Prisma client lives in `src/lib/prisma.ts`
- Auth configuration lives in `src/lib/auth.ts`
- Local database file is `prisma/dev.db`

What to say:
All of the backend data is stored locally in `prisma/dev.db` right now. That includes users, researchers, publications, citations, audit logs, and related records. Prisma defines the schema and makes it easy to query and update the data from the app.

---

## Slide 7: Key Features

### Standout features

- Researcher identity matching with aliases and confidence scores
- Citation history instead of only current citation counts
- SLU-specific publication filtering
- Collaboration and analytics views
- Export and audit support for reporting

What to say:
I wanted the app to solve real data-quality issues, not just display sample records. That is why features like audit logs, confidence scoring, and historical citation snapshots are important. They make the system more realistic and more useful.

---

## Slide 8: Challenges And Lessons Learned

### Challenges

- Matching authors correctly across inconsistent data sources
- Designing a database that supports both reporting and future expansion
- Separating user permissions clearly
- Organizing a full-stack app so frontend and backend stay maintainable

What to say:
The biggest lesson was that data modeling matters a lot. If the database structure is weak, the analytics, filters, and reporting become much harder later. Prisma helped a lot because it made the relationships and schema easier to manage.

---

## Slide 9: Conclusion

### Final takeaway

- This project demonstrates full-stack development in a real academic use case
- It combines UI, backend APIs, authentication, database design, and analytics
- It shows how software can make scattered research data more useful and reliable

What to say:
Overall, this project is a good example of building software around a real workflow. It is not just about displaying data. It is about improving accuracy, organization, and reporting for academic research output.

---

## Short Presentation Script

This project is called the AHEAD Research Output Tracker. It is a full-stack web app built for Saint Louis University's AHEAD and HCOR departments to track faculty publications, citations, and analytics in one place. The problem it solves is that research data is usually spread across multiple external sources, and faculty names often appear in inconsistent formats. That makes manual reporting difficult and unreliable.

To solve that, I built an application with Next.js, Prisma, SQLite, and NextAuth. The app stores researcher profiles, aliases, publications, citation history, and reports. It also includes role-based access for admins, analysts, and viewers. One of the most important technical features is identity matching, because the same person may appear under different names across research sources. The app handles that by storing aliases and related identifiers.

On the backend, there is no separate Supabase or Express server. The backend is built directly into the Next.js app through API routes, and the local database is stored in `prisma/dev.db`. Overall, this project demonstrates full-stack development, database design, authentication, data integration, and analytics in a practical academic setting.

---

## Likely Questions And Good Answers

### Why did you use SQLite?

For local development, SQLite is simple and easy to manage because it stores everything in one file. Prisma also makes it easier to switch to PostgreSQL later if the project needs a larger production database.

### Is the backend separate from the frontend?

No. The backend is built into the same Next.js project using API route handlers. That means the frontend and backend live in one codebase.

### Where is the data stored?

The current local database is stored in `prisma/dev.db`, and Prisma manages the schema and queries.

### What was the hardest part?

The hardest part was handling data quality, especially matching faculty names consistently across multiple research sources.

### What makes this more than a CRUD app?

It includes identity matching, role-based access, citation history over time, analytics, and reporting. Those features make it closer to a real workflow application than a simple records app.
