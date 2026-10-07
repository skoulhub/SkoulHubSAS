# SkoulHub — Smart School. Better Future.

A multi-tenant School Management SaaS dashboard (front-end prototype) for Ugandan schools.
SkoulHub lets each school (tenant) manage students, teachers, parents, attendance, timetables,
results, report cards, finance, ID cards and notifications — while the platform owner (SaaS
Admin) oversees all schools, billing, onboarding and feature requests.

> ⚠️ **Demo prototype.** There is no backend yet: data lives in an in-memory mock store
> (`src/lib/tenantStore.js`) that mirrors how a production Supabase/Postgres + Row-Level-Security
> implementation would behave. A demo banner is shown in-app, real payments are disabled, and
> data resets on refresh (enrollment-form customisations persist in `localStorage`).

---

## ✨ Features

### Roles (RBAC)
| Role | Scope |
|---|---|
| **SaaS Admin** | Global: all schools, billing (UGX 15,000/student/term), onboarding, feature requests |
| **School Admin** | Full control within their school |
| **Head Teacher** | Academic oversight + **approves finance requests** |
| **Teacher** | Only their assigned classes/subjects (attendance, marks, reports) |
| **Parent** | Only their own children (attendance, results, report cards, fee balance) |
| **Bursar / Accountant** | Records payments, expenses, payroll — submits for head-teacher approval |

Permissions are defined in **one matrix** (`src/lib/permissions.js`), with the sidebar
configuration kept alongside it in `src/lib/navigation.js`. Enforcement is default-deny:
an unknown permission, an unmapped nav id or an unrecognised role is refused rather than
falling back to a broader role.

Row-level scoping ("which students/parents may this user see?") is centralised in
`scopedStudents()` / `scopedParents()` in `src/lib/tenantStore.js`, so pages cannot
accidentally show a teacher or parent the whole school.

`src/lib/rbac.invariants.test.js` locks the pieces together: every role has metadata and
navigation, every nav entry offered to a role is permitted for it, no permission is left
unenforced, every role can reach **My Profile**, and the read-only guarantees hold — **a parent
holds zero write permissions**, and a teacher may only mark attendance, enter marks, comment on
report cards and contact parents.

> These checks are UI-level only — see [Security model](#-security-model-target).

### Modules
- **Overview** — stats, fee chart, attendance donut, activity feed, teacher/head daily schedule
- **Students** — search/filter table, add / edit / view profiles
- **Parents** — directory, contact via SMS/Email/Call-log, fee balances
- **Teachers** — directory, add, per-day schedule editor, class & subject assignment
- **Attendance** — class tabs, present/absent toggles, live progress
- **Timetables** — school / teacher / prep / meals views + in-app editing
- **Results** — per-subject mark entry with live average & UCE-style grading, CSV import
- **Report Cards** — rankings, grade distribution, per-subject view, head-teacher comments
- **Finance** — fee payments (+ receipts), expenses, payroll (+ payslips), approvals queue
- **ID Cards** — editable ID numbers with generated QR codes and card preview
- **Notifications** — feed + broadcast composer (SMS/Email/Push)
- **Settings** — tenant (school) profile
- **Subscription** — the school's plan, a live cost estimator, a three-tier comparison with the
  published prices, and the billing FAQ (school admin only)
- **My Profile** — personal info, **change email / phone** (6-digit verification), **password change**
  with a strength meter, **two-factor authentication** (OTP / authenticator app / passkey + recovery
  codes), active sessions, and **preferences**: appearance, notifications and locale

### Subscription plans
Pricing is modelled on the published price list at
[skoulhub.com/pricing](https://skoulhub.com/pricing) (retrieved 2026-10-07) and lives in
`src/lib/plans.js` as the single source of truth:

| Plan | Rate | Positioned for | Badge |
|---|---|---|---|
| **Basic** | UGX 10,000 / student / term | small schools | — |
| **Standard** | UGX 15,000 / student / term | growing secondary schools | Most Popular |
| **Premium** | UGX 20,000 / student / term | large multi-campus schools | Full Suite |

**Billing is per student, per term** — the site's own example (400 students on Standard =
400 × UGX 15,000 = UGX 6,000,000) is asserted in `plans.test.js`, so a price change has to be a
deliberate edit. Each tenant stores a plan id; `calcBilling()` prices it at that plan's rate and
`quoteForPlan()` prices an alternative without mutating the tenant. Legacy prototype plan names
(`Starter` / `Growth` / `Enterprise`) normalise onto `Basic` / `Standard` / `Premium`.

The twelve core capabilities are included on every tier (as the live page lists them); multi-campus
management and on-site setup in the Kampala region are Premium-only, taken from the tier copy and
the pricing FAQ. Plans can be switched at the start of a term from **Subscription** — with a
confirmation step that shows the new term cost.

### User profile & preferences
Every role gets a **My Profile** screen (sidebar → *My Profile*, or click the avatar).
- **Profile** — name, email change, phone change; each change is confirmed with a 6-digit code
  (demo: any 6 digits). Account details (user ID, role, tenant) are read-only.
- **Security** — password change with live requirement checklist, "email me a reset link",
  MFA method picker, recovery-code regeneration and a session list.
- **Preferences** — light / dark / **system** theme, email/SMS/push toggles, digest frequency,
  language, time zone and date format.
- **Forgot password?** on the sign-in screen starts a reset-link request.

Preferences persist per user in `localStorage` (`src/lib/userPrefs.js`); profile fields are patched
into the mock user registry (`updateUserProfile`) so a changed email can sign in.

### Appearance (dark mode)
The theme toggle re-themes the entire app without a reload. `src/lib/userPrefs.js` sets `.dark` on
`<html>`; components read semantic CSS variables (`--surface`, `--text`, `--border`, `--tint-*`, …)
declared in `src/index.css`, and a handful of bridges cover Tailwind utilities. `System` follows the
OS preference and reacts to OS changes live.

The dark palette is a **soft slate rather than near-black** — the page sits at `#1b202a` with cards a
step lighter at `#282e3d` so elevation reads. Accent *text* colours (`--accent`, `--ok`, `--warn`,
`--danger`, `--violet`, `--info`) are lightened in dark mode, while solid fills keep the saturated
brand value for white text. Every text/surface pairing clears **WCAG AA** (primary 11.6:1, muted
6.9:1, secondary 4.5:1, accents 4.9–8.4:1).
- **Enrollment** — public multi-step application form (generic or per-school via `?enroll=skh-xxx`)
  with a **Form Builder** to customise fields, fees and the shareable enrollment link

### Public flows
- **Login** — school picker or tenant ID + email → passwordless MFA (OTP / authenticator app /
  passkey — simulated)
- **Onboarding** — self-service "Create your school account" (auto-generates a unique
  `school_id` and links the admin account)
- **Enrollment** — students/parents apply online; schools review

---

## 🧪 Demo accounts

Open the login page → **"Sandbox — Try a demo account"** for one-click access:

| Account | Email | Role |
|---|---|---|
| School Admin | `admin@smck.ug` | Full school access |
| Head Teacher | `head@smck.ug` | Academic + approvals |
| Teacher | `teacher@smck.ug` | Assigned classes only (S.3/S.4 Maths) |
| Bursar | `bursar@smck.ug` | Finance recording |
| Parent | `parent@smck.ug` | Children: Aisha Nakato, Grace Akello |
| SaaS Admin | `saas@skoulhub.com` | All tenants / billing |

---

## 🚀 Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # production build → dist/
npm run preview    # preview the production build
npm run lint       # ESLint (react-hooks + react-refresh rules)
npm test           # Vitest unit tests (lib layer)
```

## 🏗️ Project structure

```
src/
├── App.jsx               # view router: login / dashboard / enrollment / onboarding
├── pages/
│   ├── Login.jsx         # school + email sign-in, demo accounts, forgot password
│   ├── MFAFlow.jsx       # OTP / authenticator / passkey (simulated)
│   ├── Onboarding.jsx    # self-service tenant provisioning
│   ├── EnrollmentForm.jsx# public admission application form
│   ├── Profile.jsx       # user profile, security (password/MFA), preferences, sessions
│   └── Dashboard.jsx     # the role-based dashboard (all modules)
└── lib/
    ├── tenantStore.js    # mock multi-tenant data layer + role-scoped queries
    ├── permissions.js    # role × permission matrix + nav gating
    ├── navigation.js     # per-role sidebar config (invariant-tested)
    ├── userPrefs.js      # theme, MFA / notification / locale preferences
    └── validation.js     # email, phone, password-strength validators
```

## 🔒 Security model (target)

The mock store is shaped so a real backend can drop in without UI changes:

- Every record carries `school_id`; every query helper filters by it.
- Tenant provisioning auto-generates a UUID-based `school_id`.
- In production these become Postgres **Row-Level Security** policies, e.g.
  `USING (school_id = auth.jwt() ->> 'school_id')`, with the backend — never the frontend —
  as the authority. The demo banner disclaims that tenant isolation is currently simulated.
