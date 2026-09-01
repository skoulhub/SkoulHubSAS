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

Permissions are defined in `src/lib/permissions.js` (one matrix, enforced in the UI via
`PermissionGate` + per-role navigation).

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
- **Settings** — tenant profile
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
│   ├── Login.jsx         # school + email sign-in, demo accounts
│   ├── MFAFlow.jsx       # OTP / authenticator / passkey (simulated)
│   ├── Onboarding.jsx    # self-service tenant provisioning
│   ├── EnrollmentForm.jsx# public admission application form
│   └── Dashboard.jsx     # the role-based dashboard (all modules)
└── lib/
    ├── tenantStore.js    # mock multi-tenant data layer (mirrors RLS behaviour)
    ├── permissions.js    # role × permission matrix
    └── TenantContext.jsx # session context + permission helpers
```

## 🔒 Security model (target)

The mock store is shaped so a real backend can drop in without UI changes:

- Every record carries `school_id`; every query helper filters by it.
- Tenant provisioning auto-generates a UUID-based `school_id`.
- In production these become Postgres **Row-Level Security** policies, e.g.
  `USING (school_id = auth.jwt() ->> 'school_id')`, with the backend — never the frontend —
  as the authority. The demo banner disclaims that tenant isolation is currently simulated.
