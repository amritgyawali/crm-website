# Recruitment Office CRM

Internal system for a recruitment agency that collects fees from candidates, works with overseas
partner agencies, and follows each candidate from first call to arrival in the destination country.

Everything hangs off two records — the **candidate** and the **job order** — so one candidate screen
shows their calls, fee ledger, payments, refunds, documents and visa progress together.

## What is in it

| Area | Highlights |
|---|---|
| **Candidate fees** | Fee packages per job order / country, installment plans (by date or linked to a stage, e.g. "after visa approval"), payments with automatic receipt numbers, printable receipt, WhatsApp share with a private receipt link, balance and next due date, refunds with management approval. Only Finance/Management can edit or delete a payment; every change is logged with a reason. Fee limits per origin and destination country are enforced. |
| **Payment follow-up** | Due today / this week / overdue lists, reminders before due dates for the assigned staff member, follow-up outcomes (promised / paid / no answer) logged from the call box. Daily cash and bank collection sheet to match with the bank. |
| **Partners** | Profile, contacts, partner type, agreements with expiry and reminder, agreed terms, job orders received, candidates supplied / submitted, selected and deployed counts, money owed both ways, communication notes and next follow-up, ranking by deployments and income. |
| **Visa & deployment** | Nine stages with date, staff member and note (appointment date & place, flight details, refusal reason). Stage time limits with alerts, passport expiry alerts (12 months or before contract end), refusal or withdrawal closes the case and opens a refund record. Overview per stage, job order and country. |
| **Call logging** | One-tap Call / WhatsApp, outcome buttons, next-call date picked automatically — two taps to log. Daily call list per staff member (new leads, call-backs, payment follow-ups), alert for leads not contacted in N days, daily and monthly counts. |
| **Campaigns** | Campaign records with spend; compulsory lead source on every candidate; report of leads, enrolled (paid first installment), deployed, cost per enrolment and money collected. `/api/leads` endpoint for Facebook/Instagram lead forms. |
| **Office expenses** | Recurring bills (rent, DEWA, internet, phones, software, licences) — paying one creates the next. One-time expenses with photo/PDF receipt and approval. Bills due in 7 / 30 days and overdue. Monthly income minus costs. |
| **Office** | Attendance with self check-in, payroll calculated from attendance and approved before payment, monthly targets with live progress, staff performance record, management dashboard, reminders page, WhatsApp templates, role-based logins, activity log, Excel/CSV exports, printable PDFs, daily backup. |
| **Tools** | Ctrl+K search across candidates, partners, job orders, campaigns and receipts. Office calendar (fees due, call-backs, embassy appointments, flights, check-ins, bills, expiries). Insights: conversion funnel by source and staff, speed to first call, fees owed by age, 8-week collection forecast. WhatsApp sending queue with a per-candidate message log. Passport fill from the machine-readable lines (check digits verified) or a photo. Duplicate finder with merge. Facebook/Instagram Lead Ads webhook. Installable on phones. |
| **Working faster** | Quick views on the candidate list (fees overdue, due this week, call-backs, not contacted, no staff, passport expiring), sortable columns, bulk assign, one-tap WhatsApp payment reminders with the amount and date filled in, Excel/CSV import, visa board view, keyboard shortcuts, sign-in attempt limit, change-your-own-password. |

## Run it locally

Requires Node.js 20+.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env   — then set SESSION_SECRET to a long random string
npm run setup             # creates the database and loads demo data
npm run dev               # http://localhost:3000
```

Demo logins (password `office123` for all):

| Email | Role |
|---|---|
| admin@office.test | Admin |
| manager@office.test | Management |
| finance@office.test | Finance |
| ops@office.test | Operations (visa & documents) |
| sunita@office.test, imran@office.test, grace@office.test | Sales |

### Start with your own data (no demo records)

```bash
npm run setup:empty -- --email you@company.com --name "Your Name" --password "a-long-password"
```

This creates an empty database and one admin login. Then: set the company details under **Settings**,
add staff under **Settings → Users & roles**, add partners, job orders and fee packages, and bring in an
existing candidate list with **Candidates → Import** (Excel or CSV; a template is provided on that page).

Forgot the admin password? `npm run create-admin -- --email you@company.com --password "new-password"`.

### Keyboard shortcuts

`Ctrl K` search everything · `/` search candidates · `n` new candidate · `c` call list ·
in lists `j` / `k` move, `Enter` open, `x` tick, `Esc` let go.

### Look and feel

Day and Night themes (or Auto, following the device), switched at the bottom of the sidebar and remembered per
person. Confirmations appear as short notes in the corner; a thin bar at the top shows a page is loading. Long
candidate records keep a slim bar at the top with the balance, Call / WhatsApp and section jumps. Lists can be
saved as named views, and on phones the candidate list shows cards with filters folded away.

## Roles

- **Admin / Management** — everything; approve refunds, expenses and payroll; manage users.
- **Finance** — fee plans, payments (including edits and deletes), refund payouts, expenses, payroll, reports.
- **Sales** — their own candidates and call list, record payments, see campaigns.
- **Operations** — visa stages, documents, job orders, partners.

## Production

```bash
npm run build
npm start
```

- Set `SESSION_SECRET`, `DATABASE_URL` and `LEADS_API_KEY` in the environment.
- Uploaded files are stored in `./uploads` and served only to signed-in staff — keep this folder on persistent disk.
- SQLite suits a single office server. For hosted/multi-server setups change `provider` in
  `prisma/schema.prisma` to `postgresql` and point `DATABASE_URL` at the database.
- Set the server time zone to the office's (e.g. `TZ=Asia/Dubai`) so "today" lists match the office day.

### Using it from other office computers and phones

Run `npm run build` then `npm start -- -H 0.0.0.0` on the office server and open `http://<server-ip>:3000` from
any device on the same network. Sign-in works over plain http on the office network; put it behind https
(e.g. a reverse proxy with a certificate) before opening it to the internet. On a phone, use the browser's
"Add to Home screen" to install it like an app.

### Passport photo reading (optional)

Set `ANTHROPIC_API_KEY` to show an "Upload photo" button on the candidate form. The photo is sent to
Anthropic's API (model `claude-opus-5-5`), read, and the form is filled for staff to check; the CRM does not
store the photo. Without a key, staff can still paste the two lines from the bottom of the passport page —
those are read and checked locally.

### Daily backup

```bash
# crontab -e
30 23 * * * cd /srv/crm && npm run backup
```

Keeps the latest 30 copies in `./backups`. Management can also download a copy from **Settings**.

### Lead forms (Facebook / Instagram)

Send leads from Zapier, Make or a Meta webhook relay:

```
POST /api/leads
x-api-key: <LEADS_API_KEY>
{ "name": "…", "phone": "+971…", "nationality": "Nepal", "adId": "<id saved on the campaign>" }
```

The lead is created as a new candidate with the matching campaign as its source. Duplicates (same phone) are ignored.

**Direct from Meta (no Zapier):** in your Meta app add a Webhooks subscription for the Page's `leadgen` field with
callback URL `https://<your-domain>/api/leads/meta` and verify token = `META_VERIFY_TOKEN`. Set `META_APP_SECRET`
(used to check each delivery's signature) and a Page access token with `leads_retrieval` as `META_PAGE_TOKEN`.
Put the ad ID or lead form ID on the campaign so leads are credited to it.

## Tech

Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · SQLite · ExcelJS.
