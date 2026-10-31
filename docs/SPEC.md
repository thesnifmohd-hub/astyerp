# Build "Asty ERP" — Construction ERP + Accounting Software (combined)

You are building a production-grade web application for **Asty Constructions**, a construction company in Kerala, India (residential, commercial, resort and PMC projects). The software combines **site/project management (ERP)** and **full double-entry accounting** in one system, so that every site activity, purchase, wage and bill flows straight into the books without retyping.

Read this whole document before writing code. Then:
1. Produce an **implementation plan** (architecture, Supabase database schema with RLS policies, folder structure, phase breakdown) and wait for my approval.
2. Build **phase by phase** (Phase 1 → 2 → 3). After each phase: run it, seed demo data, test the main flows in the browser, and show me screenshots/walkthrough before moving on.
3. Never skip validation, permissions or audit logging to save time.

---

## 1. Main goal

**Stop site delays.** Every site is planned before it starts, every site reports daily against that plan, every rupee is approved before it is spent, and the accounts are always up to date per site.

Current problem: supervisors send 2–3 WhatsApp photos a day and only say what work is "ongoing". Nobody reports what was completed, how much material was used, labour count, problems, or tomorrow's plan. Sites get delayed because there is no proper plan and no tracking.

---

## 2. Tech stack (fixed — do not change)

- **Frontend:** React 18 + Vite + TypeScript, React Router, TanStack Query, React Hook Form + Zod
- **UI:** Tailwind CSS + shadcn/ui, Recharts for charts, a Gantt component (e.g. frappe-gantt or gantt-task-react)
- **Backend:** **Supabase** only — no separate server
  - PostgreSQL database; schema changes as SQL migrations in `supabase/migrations`
  - Supabase Auth (email/phone OTP login)
  - **Row Level Security on every table**; permissions enforced in the database, not only in the UI
  - Business rules that touch money (approval limits, anti-splitting, stock, voucher debit = credit, auto-posting) as **Postgres functions / triggers**, called via RPC
  - **Supabase Edge Functions** for PDF generation, notifications and Excel imports
  - **pg_cron** for scheduled jobs (missed check-in alerts, escalations, 8 pm daily summary, plan alerts, Tuesday meeting pack)
  - Supabase Storage for site photos, bills and drawings (private buckets, signed URLs)
  - Supabase Realtime for live dashboard and approval updates
- **Hosting:** **Vercel** for the React app (SPA rewrites configured in `vercel.json`); environment variables in Vercel
- **Supervisor app:** the same React app as an installable **PWA** (vite-plugin-pwa), mobile-first screens, live camera capture and GPS through browser APIs, offline queue in IndexedDB
- **PDF:** @react-pdf/renderer or an Edge Function, for bills, quotations, vouchers and reports
- **Excel:** import/export with SheetJS (xlsx)
- **Types:** generate TypeScript types from the Supabase schema (`supabase gen types`)
- **Notifications:** in-app + web push; design a provider interface so WhatsApp (WhatsApp Business API) can be plugged in later
- **Languages:** English and Malayalam (i18n from day one; supervisor screens must be fully translated)
- **Currency/format:** INR (₹), Indian number format (1,00,000), dates DD-MM-YYYY, timezone Asia/Kolkata
- **Financial year:** April–March

---

## 3. Users, positions and permissions (configurable — no names in code)

Do **not** hard-code any person's name or any role name in the code, RLS policies or approval logic. People are just users assigned to a **position**. Positions and what they can do are **data**, managed by the Admin from a settings screen, so new positions can be added as the company grows without changing code.

### 3.1 Starting positions (seed data)

| Position | Login type | Device | Main responsibilities |
|---|---|---|---|
| **System Admin** | Admin | Computer | Creates users, positions and permissions; company settings, approval rules, number series, letterhead; full access; cannot be deleted |
| **Management (Director)** | Management | Mobile + computer | Sees everything; final approval above ₹3,000; approves site plans, plan changes and client bills; only position that sees costs, margins, profit and partner profit split |
| **Operations Executive** | Office | Computer | Approves requests up to ₹3,000; reviews requests above ₹3,000 before Management; manages sites, purchases, vendors, labour; follows up delays. Not a civil engineer, so screens must be simple and give clear guidance |
| **Project Coordinator** | Office + field | Mobile | Technical check of every request before approval (cannot approve spending); builds site plans with Management; oversees all Site Supervisors; quality check on task completion; approves site-to-site material transfers; may also supervise sites directly |
| **Site Supervisor** | Field | Mobile | Daily check-ins and reports for assigned sites only; raises requests |
| **Accounts Head** | Office | Computer | Full accounting: reviews and posts vouchers, bank reconciliation, GST/TDS, client bills, payments, financial reports; approves Junior Accountant entries; can lock periods |
| **Junior Accountant** | Office | Computer | Enters vouchers, purchase bills, petty cash settlements, receipts and wage payments as **drafts**; drafts need Accounts Head approval to post; cannot edit posted or locked entries; no access to profit, partner split or management reports |
| **Client** (Phase 3, optional) | External | Mobile | Sees only their own site: progress photos, approved bills; approves extra work |

Several users can hold the same position (e.g. 2 Management users, many Site Supervisors). One user can hold more than one position.

### 3.2 How it must be built (for future growth)

- **Tables:** `positions` (name, login type, description, active), `permissions` (fixed list of codes per module and action, e.g. `site.view`, `site.edit`, `approval.material.approve`, `voucher.post`, `report.profit.view`), `position_permissions`, `user_positions`, and `user_site_access` (which sites a user can see, or "all sites").
- **Reporting line:** each position has a "reports to" position (Site Supervisor → Project Coordinator → Operations Executive → Management). Escalations and default approval routing follow this line.
- **Admin screens:** create/rename/deactivate positions, tick permissions per position in a matrix (module × view/create/edit/approve/delete/export), assign users to positions and sites, reset logins, deactivate users (never delete — history must stay).
- **RLS and code check permissions, not position names:** use a Postgres function such as `has_permission(auth.uid(), 'voucher.post')` and `can_access_site(auth.uid(), site_id)` in every policy. The React app hides menus and buttons using the same permission list.
- **Approval rules are configurable:** for each request type, an ordered list of steps; each step = a position + optional amount range (e.g. step 1 Project Coordinator: technical check; step 2 Operations Executive: approve if ≤ ₹3,000; step 3 Management: approve if > ₹3,000). Admin can add a new step or a new position into any chain from settings.
- **Notifications and reports** are addressed to positions (e.g. "missed check-in → Project Coordinator + Operations Executive"), so whoever holds the position gets them.
- **Examples of positions that may be added later** without code changes: Site Engineer, Store Keeper, Purchase Officer, Quantity Surveyor, HR Executive, Safety Officer, Interior Project Manager, Regional Manager.

### 3.3 General rules
- Site Supervisors see only their assigned sites.
- Costs, margins, profit and partner profit split need the `report.profit.view` permission (Management only by default).
- Every create/edit/approve/delete is written to an **audit log** (user, position, time, old value, new value). Financial records are never hard-deleted, only cancelled or reversed.

---

## 4. Modules

### 4.1 Site Master
Per site: code, name, client (name, phone, GSTIN, address), site address, **GPS coordinates + allowed radius (default 150 m)**, contract type (Lump sum / Item rate / Labour only / PMC % / Cost plus), contract value, PMC % if any, start date, target end date, assigned Site Supervisor(s), Project Coordinator, project type (Residential / Commercial), status, documents (drawings, agreement), and a profit-sharing rule (default 50/50 between the two Management partners; some sites use a modified split when a referral partner sourced the project — make the split configurable per site).

Example active sites for seed data: Hadi Bedroom, Talikulam Resort, Wayanad Resort (PMC at 12% of actual project cost), TKM Building (industrial work).

### 4.2 BOQ, Estimation and Quotation
Copy the structure of our existing Excel BOQ system:
1. **Rate sheet** (per project, copied from a company master): material prices (cement per bag, M-sand per cft, 20 mm / 40 mm aggregate per cft, steel per kg, binding wire, RMC per m³ by grade M25/M30/M35), wages (mason ₹1,500/day, helper ₹1,200/day, carpenter, bar bender), hire rates (shuttering rent, staging, mixer, vibrator), wastage %, profit %.
2. **Project type selector** Residential / Commercial → sets defaults (concrete grade, floor height: residential 3.0–3.6 m, commercial 4.0–5.3 m; labour output per day by work type; staging rates). Every default can be overridden.
3. **Item list**: one row per stage — work type (footing, neck column, column, plinth beam, beam, slab, stair, wall, retaining wall, water tank; residential also masonry per laterite stone, lintel, sunshade, parapet, window fixing, PCC flooring, sloped roof), grade, concrete m³, formwork m², steel kg, staging area, pour days.
4. **BOQ (automatic)**: material, labour, formwork, rent and steel cost per item.
5. **Material purchase list (automatic)**: total cement bags, sand cft, aggregate cft, steel kg, RMC m³.
6. **Quotation (automatic)**: two print styles — (a) item-wise 11-column format in work-progress order for commercial, (b) full-house BOQ or rate per sq.ft for residential. Rounded total, terms and conditions, Excel + PDF on Asty letterhead.
- Import a BOQ from Excel. Version every BOQ (v1, v2…) and keep the approved one locked.

### 4.3 Site Planning and Schedule (the most important module)
- A plan is built from the approved BOQ: each BOQ item → one or more **activities**.
- Each activity: name, linked BOQ item(s), quantity + unit, predecessor activities (finish-to-start), duration (auto-suggest = quantity ÷ labour output per day, editable), planned start/end, crew (own concrete crew / own brick crew / a subcontractor), materials needed with "needed-on-site-by" date, drawings needed with "due" date.
- **Gantt chart** view with dependencies, and a simple list view for the Operations Executive.
- Plan is created by Management + the Project Coordinator, then **approved by Management**. The approved plan becomes the **baseline**. Any later change needs a reason + Management approval; keep baseline vs current for comparison.
- **Automatic alerts** (daily job):
  - Material: "Steel for first-floor slab needed in 5 days — not yet ordered"
  - Drawing: "Staircase structural drawing due in 7 days — not received" (we depend on outside architects/engineers who are often late, so track who owes which drawing)
  - Crew clash: same own crew planned on two sites on the same day
  - Delay: activity progress behind plan → mark site "At risk" / "Delayed" with days behind
- 14-day **look-ahead** report: materials, drawings, crews needed.

### 4.4 Daily Site Reporting (supervisor PWA)
Three GPS check-ins a day. Check-in is **blocked outside the site radius**. Photos must be **taken live in the app** (no gallery upload), and are stamped with date, time, GPS and site name.

| Check-in | Default window | Supervisor enters |
|---|---|---|
| Morning | 8:00–10:00 | GPS check-in; labour count by trade (own workers by name for attendance, subcontractor head count by trade); today's activities picked from the plan; materials received (qty + photo of bill/challan) |
| Afternoon | 12:30–2:30 | GPS check-in; minimum 3 progress photos |
| Evening | 4:30–7:00 | GPS check-in; quantity completed per activity (m³ / m² / nos / %); materials used; problems/hold-ups (with "urgent" flag); tomorrow's plan; minimum 3 photos |

Rules:
- Time windows configurable per site.
- The day cannot be closed without the evening report.
- Missed check-in → alert the Project Coordinator + Operations Executive 30 minutes after the window closes.
- "Urgent" problem → instant alert to Management.
- Evening quantities update activity progress and compare with plan.
- Materials used are deducted from site stock automatically.
- Daily combined summary of all sites to Management + Operations Executive at 8:00 pm.
- Big buttons, minimal typing, Malayalam/English toggle, must work on low-end Android phones. If the network drops, queue the report locally and sync when back online.

### 4.5 Approvals Workflow
Request types: Material request, Purchase order, Petty cash, Subcontractor bill, Task completion, Extra work, Plan change, Client bill.

Flow:
1. Supervisor raises request (with required attachments).
2. **Project Coordinator does a technical check** (is it needed, right quantity, matches the plan?) → can forward or send back. Cannot approve spending.
3. Amount **≤ ₹3,000 → Operations Executive approves**. Amount **> ₹3,000 → Operations Executive reviews, then Management approves**. The limit and the chain are configurable in settings (section 3.2).
4. Approved items go to Accounts (Junior Accountant prepares, Accounts Head posts and pays) and are posted to the books.

Rules:
- One-tap approve/reject with a comment, from mobile.
- Pending > 24 hours → escalate to the next level (configurable).
- Anti-splitting: requests for the same site + same item within 7 days are added together for the limit check.
- Plan changes and client bills always need Management.
- Extra work needs the client's written approval recorded (upload/OTP) before the work starts.

Required attachments:
| Request | Must include |
|---|---|
| Material request | Item, qty, needed-by date, linked plan activity |
| Purchase order | Vendor, rate, qty, delivery date (show last 3 purchase rates for that item) |
| Petty cash | Purpose, amount; bill photo after spending (mandatory to settle) |
| Subcontractor bill | Work order, measured qty, photos |
| Task completion | Final qty, photos; Project Coordinator quality check |
| Extra work | Description, estimate, client approval |

### 4.6 Materials and Inventory
- Item master with units; vendor master with rates and GSTIN.
- Flow: Material request → PO → Goods receipt at site (supervisor confirms qty + photo) → Purchase bill (Accounts) → Usage (from evening report).
- Site-wise stock = received − used − transferred out.
- Site-to-site transfer (Project Coordinator approves; receiving Site Supervisor confirms).
- **Usage vs BOQ** report: flag overuse above the wastage %.

### 4.7 Labour (own workers)
- Our own crews are **concrete workers and brick workers**; all other trades are subcontracted.
- Worker master: name, phone, trade, daily wage, joining date, advance balance.
- Attendance from the morning check-in (present / half day / absent, per site).
- Weekly wage sheet auto-generated per worker and per site; advances and deductions; payment posts to accounts.
- Crew calendar across sites.

### 4.8 Subcontractors
- Subcontractor master (trade, rates, PAN, GSTIN, bank).
- Work order per job: scope, BOQ items, rate, qty, dates, retention %.
- Measured bills checked against the work order and daily reports; approval as 4.5.
- Ledger per subcontractor: work order value, billed, paid, retention held, **TDS (194C)** deducted.

### 4.9 Client Billing
Bill types:
- **Running bill (RA bill)**: quantities completed since last bill at BOQ rates; previous / this bill / cumulative; retention; mobilisation advance recovery.
- **Final bill**: settles all quantities, retention and balance.
- **Labour bill**: labour-only contracts (days or measured work).
- **Extra work bill**: approved extra items only.
- **PMC fee bill**: % of actual project cost (e.g. Wayanad Resort 12%).
- GST tax invoice format (CGST+SGST or IGST), HSN/SAC codes, Asty letterhead, PDF.
- Operations Executive checks, Management approves, then the bill posts to accounts as a sales voucher.
- Receipts against bills, outstanding ageing, payment reminders.

### 4.10 Accounting (full double-entry — replaces our current software "Smart Build")
- **Chart of accounts** (Indian standard groups: Capital, Loans, Current Liabilities, Fixed Assets, Current Assets, Sundry Debtors, Sundry Creditors, Bank, Cash, Direct/Indirect Income, Direct/Indirect Expenses, Duties & Taxes). Fully editable.
- **Cost centre = Site**: every voucher line can carry a site, so site-wise P&L is always available. "Head Office" cost centre for overheads.
- **Vouchers**: Payment, Receipt, Contra, Journal, Purchase, Sales, Debit Note, Credit Note. Auto-numbered per financial year.
- **Auto-posting**: approved purchases, wage sheets, subcontractor bills, petty cash settlements and client bills create vouchers automatically (Junior Accountant or Accounts Head reviews, Accounts Head posts, with a "pending posting" queue).
- **Petty cash** per site/supervisor: issue, spend with bill photos, settle, balance.
- **Bank**: multiple accounts, cheque/UPI/NEFT details, **bank reconciliation** (import bank statement Excel/CSV, match entries).
- **GST**: input and output GST, ITC tracking, reverse charge, GSTR-1 and GSTR-3B summary reports (export to Excel/JSON).
- **TDS**: 194C on subcontractors, 194J on professionals; TDS payable report.
- **Fixed assets** register with depreciation (WDV, Income Tax rates — e.g. goods vehicle 40%) — company owns vehicles and equipment.
- **Loans** (e.g. vehicle loan EMI schedule).
- **Reports**: Day book, Ledger, Trial balance, Profit & Loss, Balance sheet, Cash flow, Receivables/Payables ageing, **Site-wise P&L**, Partner profit-share statement (Management only).
- **Opening balances import** from Smart Build via Excel (ledger-wise opening balances, open bills).
- Year-end closing with carry-forward; locked periods cannot be edited without Management permission.

### 4.11 Dashboards and Reports
**Management dashboard (first screen):** which sites are behind plan today and why; then cash position, pending approvals, receivables, payables.

| Report | For | Frequency |
|---|---|---|
| All-sites status (on track / at risk / delayed, days behind) | Management, Operations Executive | Live + 8 pm summary |
| Site DPR with photos | Management, Operations Executive, Project Coordinator | Daily |
| Plan vs actual (Gantt overlay) | Management, Project Coordinator | Live |
| 14-day look-ahead (materials, drawings, crews) | Operations Executive, Project Coordinator | Daily |
| Pending approvals with waiting time | Operations Executive, Management | Live |
| Material used vs BOQ | Management, Project Coordinator | Weekly |
| Labour cost & attendance by site | Operations Executive, Accounts Head | Weekly |
| Site cost vs contract value & profit | Management | Weekly |
| Client bills, receipts, outstanding | Management, Accounts Head | Weekly |
| Supervisor performance (on-time check-ins, complete reports, delays) | Management | Monthly |
| **Tuesday meeting pack** (every site's status, issues, decisions needed) | All departments | Every Tuesday morning (we hold a weekly 2-hour Tuesday coordination meeting) |

All reports export to Excel and PDF.

---

## 5. Build phases

**Phase 1 — Control and visibility**
Auth + configurable positions and permissions, Site master, Supervisor PWA with 3 GPS check-ins + live photos + DPR, Approvals workflow, basic Materials (request → PO → receipt), Management dashboard, Admin settings (positions, permissions, users), audit log, English/Malayalam.

**Phase 2 — Planning and site costs**
BOQ/estimation/quotation, Site planning + Gantt + baseline + alerts, Inventory + usage vs BOQ, Labour attendance + wages, Subcontractor work orders + bills.

**Phase 3 — Accounting and billing**
Full double-entry accounting, auto-posting, GST, TDS, bank reconciliation, client billing (RA/final/labour/extra/PMC), fixed assets, financial reports, site-wise P&L, Smart Build opening balance import, client portal (optional).

---

## 6. Design and quality

- Brand: **Asty Constructions** — Deep Charcoal `#1D2527` (primary), Muted Blue-Grey `#8DA1B1`, Black `#0B0B0B`, White. Headings: Neue Haas Grotesk (fallback Inter), body: Manrope. Clean, minimal, professional.
- Supervisor screens: mobile-first, large touch targets, works on cheap Android phones, minimum typing.
- Office screens: dense tables with filters, search, bulk actions, keyboard friendly.
- Validation on every form; friendly error messages (also in Malayalam for supervisors).
- GPS anti-spoof: reject mock locations where detectable; store accuracy value; flag low-accuracy check-ins.
- Daily database backup; all money stored as integers in paise (no floating point).
- Write automated tests for: approval limits and escalation, anti-splitting rule, stock calculation, voucher balancing (debit = credit), GST calculation, RA bill cumulative maths, site P&L.
- Seed realistic demo data: 4 sites above, one demo user per starting position (named by position, e.g. "Demo Site Supervisor 1"), 10 own workers, 5 subcontractors, 10 vendors, one BOQ per site, 30 days of daily reports.

---

## 7. Deliverables
1. Implementation plan + database schema (ER diagram) — wait for approval.
2. Working app per phase with seed data.
3. README: local setup (Supabase CLI), environment variables, running migrations, deploying Edge Functions, deploying to Vercel, how to add users and sites.
4. A short user guide per position (Admin, Management, Operations Executive, Project Coordinator, Site Supervisor, Accounts Head, Junior Accountant) — supervisor guide also in Malayalam.

Ask me before making any assumption that changes money, approvals or accounting rules.
