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

## DONE — Security Hardening (2026-09-02)

- [x] `express.json` limit 100kb, security headers (nosniff/DENY/XSS/Referrer/Permissions-Policy)
- [x] Rate limiter `POST /jwt` 20/min/IP (429) — commit `0acbbfe`

## DONE — Modular Architecture (2026-09-02, commit 7af9ab4)

- [x] `index.js` 1558-line monolith -> layered architecture: `src/app.js` + `src/server.js` + `shim index.js` + `api/index.js` (Vercel)
- [x] `src/config/{env.js,db.js}`: env validation + lazy Mongo singleton + 9 indexes (isolated from app)
- [x] `src/middleware/*`: verifyToken, loadAuthUser, authorize (6 guards), security, rateLimit, errorHandler
- [x] `src/utils/*`: asyncHandler, objectId, pagination
- [x] `src/services/*`: review.service (recalcRating), scholarship.service (filter/sort/normalize)
- [x] `src/controllers/*`: 7 controllers (auth, user 12 handlers, scholarship 5, saved 4, inquiry 2, review 9, apply 6) with asyncHandler
- [x] `src/routes/*`: 7 routers mounted in app.js — preserves all typo aliases + pagination, no API break
- [x] `src/app.js`: lazy ensureDb middleware (health / no DB), 404 + errorHandler, CORS 3 origins
- [x] `vercel.json`: legacy builds -> rewrites to /api/index.js; `package.json`: main src/server.js + scripts dev/start/lint/check
- [x] `api/index.js` + `.env.example`; verified GET / 200 without DB, GET /allScholership 200 with DB

---

## BACKLOG / KNOWN GAPS

- [ ] Add automated tests (vitest + supertest for src/controllers).
- [ ] Add zod schema validation for scholarship/review/application payloads.
- [ ] Consider TypeScript migration (keep JS for now to minimize Vercel risk).

