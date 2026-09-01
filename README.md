# Principal Academic Report Portal

A multi-school web portal for the **Monthly Principal Academic Report**. Principals log in and fill/submit their school's report each month; the Chairman logs in as an **Admin** to review every school's reports and track KPIs on a dashboard.

Built to match the *AKB School of Excellence* specimen (all 13 sections), and designed to work for **multiple schools**.

- **Chairman (Admin)** — sees all schools, a KPI dashboard, reviews and returns reports, and manages schools & principal accounts.
- **Principals** — each tied to one school; create, save, and submit that school's monthly 13-section report.

No external dependencies. Runs on Node.js (built-in modules only) and stores data in a local JSON file.

---

## Quick start

```bash
node server.js
```

Then open **http://localhost:3000**.

On the very first run the database is seeded with these accounts (change the passwords after signing in):

| Role | Username | Password | School |
|------|----------|----------|--------|
| Chairman (Admin) | `chairman` | `Chairman@123` | — (all schools) |
| Principal | `principal.akb` | `Principal@123` | AKB School of Excellence |
| Principal | `principal.school2` | `Principal@123` | Second School (rename in the app) |

> The second school is a placeholder — sign in as the Chairman, open **Schools**, and rename it. You can also add more schools and principals from the **Users** page.

Change the port with `PORT=8080 node server.js`.

---

## What each role can do

### Principal
- **Dashboard** — their school's latest average, attendance, students below 40%, syllabus completion, and a trend chart.
- **New Report** — fills the full 13-section monthly report. Headline figures (school average, best/weakest grade & subject, students below 40%, teacher ranks) are **calculated automatically** as they type.
- **Save draft** — keep working across sessions.
- **Submit to Chairman** — locks the report into the Chairman's review queue. If the Chairman *returns* it, the principal can edit and resubmit.

### Chairman (Admin)
- **Dashboard** — two rows of KPI tiles (schools, average across schools, students below 40%, awaiting review, **Abacus classes**, **Abacus doing well**, **Olympiad exams scheduled**, **schools at board risk**), a **per-school card** for each school (with Abacus / Olympiad / board-readiness chips), an **overall-average trend chart**, a **students-below-40% comparison chart**, a **submission tracker** (who submitted which month), and a recent-reports list.
- **Month record & comparison** — every submitted month is kept. A month picker with ◀ / ▶ buttons steps through history, and a **month-on-month comparison table** shows each school's key metrics for the selected month versus the previous month with ▲ / ▼ change indicators.
- **Excel download** — one click exports to real `.xlsx`: the dashboard/comparison for a month, an individual report (multi-sheet: summary, grade-wise, teachers, best teacher, abacus, external exams), or the full user list.
- **Users & credentials** — add a principal and **auto-generate a username and secure password** in one step; the created login is shown on a copyable card to hand to the principal (who is prompted to change it at first login). Rename users, reset passwords, enable/disable, or delete.
- **Reports** — view any school's report (read-only), **print / save as PDF**, add **review remarks**, and **Mark as Reviewed** or **Return for changes**.
- **Schools** — add and rename schools.
- **Users** — add principals, reset passwords, enable/disable or delete accounts.

---

## The report — 15 sections

1. Executive Summary · 2. Grade-Wise Performance (1–8) · 3. Subject-Wise Analysis (6–8) · 4. Primary Section (1–5) · 5. Nursery Section · 6. Periodic Test · 7. Syllabus Completion · 8. Slow Learner Monitoring · 9. **Special Monitoring (Grade 9 – 11)** · 10. Teacher Accountability · 11. Best Teacher of the Month · 12. Discipline & Engagement · 13. **External / Competitive Exams (Olympiads)** · 14. **Abacus Programme** · 15. Action Plan — plus a signature block with **Location/Place** and Principal/Chairman.

- Grade lists run up to **Grade 12**: the Grade-Wise Summary (Section 2), Slow Learner Monitoring (Section 8), Syllabus Completion (Section 7) and Abacus (Section 14) all include grades through 12. Grades a school doesn't run are simply left blank and are ignored in every average/total.
- **Section 9 – Special Monitoring** covers Grade 9, 10, 11 and 12, each with its own board/exam-readiness status and a "Not Applicable" toggle for grades that haven't started.
- **Section 13 – External Exams** comes pre-loaded with the major olympiads (SOF's IMO/NSO/IEO/IGKO/NCO, Indian Talent Olympiad, Unified Council's NSTSE/UCO/UIEO, HBCSE), each with a registration status and scheduled/exam date. Add or remove exams as needed.
- **Section 14 – Abacus Programme** records, grade by grade, classes conducted, students enrolled, and how many are performing well (with totals).

**Auto-calculated fields** (you never type these): the School summary row, executive-summary figures, Section 6's students-below-40% count, Section 8 totals, each teacher's total/rank in Section 11, and the Abacus totals in Section 14.

### Faster data entry

- **Prefill from last month** — on the *New Report* screen, one click copies the previous month's report (teacher names, subjects, sections, action plans, remarks, etc.) so you only update the changed figures and set the new month.
- **Pick-lists** — repetitive text fields offer type-or-choose suggestions instead of retyping: action-plan phrases (Sections 3 & 4), teacher **Subject / Section / Correction status** (Section 10), Grade-9 risk, question-paper moderation, and the Yes/No fields in Discipline & Engagement. You can always type a custom value.

---

## Data & KPIs

Each report stores its raw entries plus a compact **KPI** summary (overall average, attendance, students below 40%, syllabus %, slow-learner improvement, best/weakest grade & subject, best teacher). The dashboard aggregates these across schools and months.

All data lives in **`data/db.json`** (created on first run, ignored by git). Passwords are hashed with `scrypt`; sessions are HTTP-only cookies.

**Back up** by copying the `data/` folder. To reset everything, stop the server and delete `data/`.

---

## Project structure

```
server.js            HTTP server + REST API + role checks
lib/
  db.js              JSON-file store (atomic writes)
  auth.js            scrypt password hashing + cookie sessions
  kpi.js             derives KPIs from report data
  seed.js            first-run schools + accounts
public/
  index.html         SPA shell
  app.css            all styling (screen + A4 print)
  app.js             SPA: login, routing, dashboard, reports, admin
  report-form.js     the reusable 13-section report form
  charts.js          dependency-free SVG line/bar charts
```

---

## Deploying on Railway.com with MySQL Database

This application uses **MySQL** as its database storage engine with automatic versioned schema migrations and default account seeding.

### Step 1: Deploy to Railway
1. Push your repository to GitHub.
2. Log into [Railway.com](https://railway.com) and create a **New Project**.
3. Choose **Deploy from GitHub repo** and select this repository.

### Step 2: Configure MySQL Database
You can connect to a MySQL database on Railway in two ways:

#### Option A: Using Railway MySQL Service (Recommended)
1. In your Railway project canvas, click **+ New** → **Database** → **MySQL**.
2. Railway will automatically link the MySQL service and inject the `MYSQL_URL` variable into your app service.
3. Your app will automatically connect, execute migrations, and seed initial accounts!

#### Option B: Using Custom Remote MySQL Database
In your Railway App Service → **Variables**, set the following environment variables:
- `MYSQLHOST` = `your-database-host`
- `MYSQLPORT` = `3306`
- `MYSQLUSER` = `your-database-username`
- `MYSQLPASSWORD` = `your-database-password`
- `MYSQLDATABASE` = `your-database-name`

*(Alternatively, set `MYSQL_URL` or `DATABASE_URL` = `mysql://user:pass@host:3306/dbname`)*

### Environment Variables Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port provided by Railway | `3022` |
| `MYSQL_URL` / `DATABASE_URL` | Full MySQL Connection String | — |
| `MYSQLHOST` / `MYSQL_HOST` / `DB_HOST` | MySQL Server Hostname | `localhost` |
| `MYSQLPORT` / `MYSQL_PORT` / `DB_PORT` | MySQL Server Port | `3306` |
| `MYSQLUSER` / `MYSQL_USER` / `DB_USER` | MySQL Username | `root` |
| `MYSQLPASSWORD` / `MYSQL_PASSWORD` / `DB_PASSWORD` | MySQL Password | `""` |
| `MYSQLDATABASE` / `MYSQL_DATABASE` / `DB_NAME` | MySQL Database Name | `akbgroups_principal_report` |

---

### First-Run Default Accounts

Upon initial database migration and deployment, the following default accounts are automatically created:

| Role | Username | Default Password | Initial Scope |
|------|----------|------------------|---------------|
| Chairman (Admin) | `chairman` | `Chairman@123` | All Schools |
| Principal | `principal.akb` | `Principal@123` | AKB School of Excellence |
| Principal | `principal.school2` | `Principal@123` | Second School |

> **Note**: Change default passwords after your first login.

