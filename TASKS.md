# TASKS.md — Schole-hive-server (Express + MongoDB API)

Live project status. Keep this file current every session:
- START -> **IN PROGRESS**. FINISH -> **DONE** (archive to `docs/TASK_HISTORY.md` at milestone). New work -> **BACKLOG**.

History: `docs/TASK_HISTORY.md` · Narrative: `docs/HANDOFF_LOG.md` · Deploy: `docs/DEPLOY.md`.

---

## IN PROGRESS

- Login / role system (feature/login-roles) — SERVER DONE, waiting on client branch

## DONE — Login / Role System (2026-09-02, feature/login-roles)

- [x] New `institution` role + `status` (`active|pending|approved|rejected`); org fields (`orgName/orgType/orgCountry/orgWebsite/orgDescription`)
- [x] `POST /users` derives role from `accountType` (`student|institution`) — no longer trusts client `role` (also closes privilege-escalation hole); institution signup → `pending`; `ADMIN_EMAILS` → superadmin
- [x] Guards: `verifyInstitution`, `verifyScholarshipEditor` (superadmin or approved institution), `verifyScholarshipOwner` (superadmin or `createdBy`-owning institution); scholarship create/edit/delete now exclude admin/mod entirely
- [x] `createdBy`/`createdByRole` stamped on scholarship create
- [x] Approval API: `GET /institutions`, `GET /institutions/pending`, `PATCH /users/institution/:id` (`{status, reason}`), `GET /users/institution/:email`
- [x] Application access control: `GET /apply` own-or-staff, `GET /allapply` staff / institution-owned (createdBy) / self, `GET /singleApply/:id` + cancel + accepted now `verifyToken` + ownership-guarded (institutions can accept own applicants); `/reviews/removed` + `/reviews/history/:id` unchanged
- [x] `GET /users/public/:email` + `GET /users/me` + `PATCH /users/me` support org fields + status

## TODO — Scholarship Transformation

- [ ] `GET /allScholership` (+ alias `/scholarships`, `/allScholarships`) — `q/category/subject/degree/country/city/maxFees/deadlineAfter/sort/page/limit`, indexes, `{data,total}` pagination, text search
- [ ] Secure `POST/PATCH/DELETE /allScholership` (`verifyToken+verifyModaretor`) + alias routes
- [ ] Saved collection: `POST /saved` toggle, `GET /saved`, `DELETE /saved/:id` (unique `userEmail+scholarshipId`), `verifyToken`
- [ ] `GET /scholarships/stats` (and `/allScholership/stats`) real counts + sums
- [ ] Extend scholarship schema optional `eligibility/benefits/duration/tags/currency` (backward compat)

---

## BACKLOG / KNOWN GAPS

- [ ] Add automated tests (no test framework; `npm test` placeholder).
- [ ] Split `index.js` into route controllers / middleware modules (single 674-line file).
- [ ] Add schema validation for scholarship/review/application payloads.
- [ ] Centralize role guard helpers (`verifyAdmin` etc. inline).

