# HANDOFF_LOG.md — Schole-hive-server

Session-by-session handoff log. **Newest entry at the top.**
Every session that does meaningful work appends a dated entry here before finishing
(or before hitting a token/budget limit) and commits + pushes it.
This is the MIRROR of the client repo's log (`../School-Hive/docs/HANDOFF_LOG.md`),
which is the master narrative — keep the two consistent.

---

## 2026-09-02 — Modular architecture refactor (commit 7af9ab4)

**What was done**
- **Monolith 1558 lines -> layered architecture**: `src/app.js` (Express factory + lazy DB middleware), `src/server.js` (listen + export), `index.js` shim, `api/index.js` Vercel entry, 7 route modules + 7 controllers + 6 middleware + 2 services + 3 utils.
- **Config**: `src/config/env.js` (validated PORT/NODE_ENV/MONGO_URI/ACCESS_TOKEN_SECRET/ADMIN_EMAILS), `src/config/db.js` (singleton MongoClient, getCollections, ensureIndexes 9 indexes, handle text-index apiStrict error).
- **Middleware**: `verifyToken`, `loadAuthUser`, `authorize` (verifyAdmin/Modaretor/SuperAdmin/Institution/ScholarshipEditor/Owner/OwnerModifiable), `security` (5 headers), `rateLimit` (auth 20/min), `errorHandler` + `asyncHandler`.
- **Verification**: `node --check` all files, `GET /` 200 without DB, `GET /allScholership` 200 with real DB (live data returned), no API break — all original aliases preserved.

**Decisions**
- Keep CommonJS (`require`) not ESM/TS to minimize Vercel `@vercel/node` risk; TS/zod deferred to next backlog.
- Lazy DB via `ensureDb` middleware — health check bypasses DB, all other routes await `connect()` on first request (works for both local `npm run dev` and Vercel serverless cold start).
- `vercel.json` migrated `builds` -> `rewrites` to modern format; shim `index.js` kept for backward compat.

**Left / next**
- Add vitest+supertest, zod validation, update `AGENTS.md` layout section.

---

## 2026-09-02 — Role portals, institution role + approvals + scholarship ownership (branch `feature/login-roles`, committed `295e71e`)

**What was done**
- **Role derived from `accountType`, not trusted client `role`** — `POST /users` sets `role: "student"|"institution"` from the submitted `accountType`; `role` from the body is ignored (closes privilege-escalation vector). `ADMIN_EMAILS` still force `superadmin` + `active`. Legacy backfill sync keeps old rows consistent.
- **Institution signup** — `role:"institution", status:"pending"` with org fields (`orgName, orgType, orgCountry, orgWebsite, orgDescription`) + `statusNote/reviewedAt/reviewedBy`; `PATCH /users/me` whitelist extended with org fields; `GET /users/public/:email` returns `status` + org fields.
- **New middlewares** — `verifyInstitution`, `verifyScholarshipEditor` (superadmin OR approved institution), `verifyScholarshipOwner` (superadmin OR `createdBy`-owning institution, with `ObjectId` validation).
- **Approvals API** — `GET /users/institution/:email`, `GET /institutions?status=`, `GET /institutions/pending`, `PATCH /users/institution/:id` (`{status, reason}`) superadmin-only, sets `approvedAt/rejectedAt`; resolved-institution scholarship access requires `status:"approved"`.
- **Scholarship guardrails** — create stamps `createdBy`/`createdByRole` from `req.authUser`; edit/delete restricted to editor/owner. Superadmin+institutions only; admin/mod now **cannot** create/edit/delete scholarships (403).
- **Application security** — helpers `canAccessApplication` + `findApplyScholarship`; `GET /apply` own-or-staff, `GET /allapply` staff / institution-owned / self, `GET /singleApply/:id`, `PATCH /allapply/cancel/:id`, `PATCH /allapply/accepted/:id` all `verifyToken+loadAuthUser`, invalid OID → 400; removed stale duplicate accepted handler.
- `node --check index.js` OK; server `TASKS.md` updated.

**Blocker**
- Same as before — `VERCEL_TOKEN` invalid, server not yet deployed. Local test blocked until user creates `Schole-hive-server/.env` (Mongo/DB creds + `ACCESS_TOKEN_SECRET` + `ADMIN_EMAILS`) and runs `npm start` against `localhost:5000`.

**Left / next**
- E2E smoke (see client log 2026-09-02): student active; institution register→pending; superadmin approve; institution adds/edits own scholarship; admin/mod 403 on scholarship CRUD; reject → rejected screen.
- Deploy requires fresh `VERCEL_TOKEN` (`npx vercel --prod --yes --token`).

---

## 2026-09-01 — Profile full-fledged + review moderation

**What was done**
- Moved review system to verified (`accepted`-only, 1-per, `pending→approved` moderation, `verifyModaretor`, indexes, recalc).
- Added profile persistence: `POST /users` stores `photoURL/createdAt`, secures `GET /user` + `GET /users` staff-only, new `GET /users/me` + `PATCH /users/me` whitelist (`ab9b2c1`). Pushed `ab9b2c1`+`1763399`.

**Blocker**
- Vercel `VERCEL_TOKEN` invalid — live `https://server-six-vert.vercel.app` not deployed. Rotate then `npx vercel --prod --yes --token`.

**Left / next**
- Deploy server, verify `PATCH /users/me` + review gate live.

---

## 2026-09-01 — Proper review moderation: verified-applicant, 1-per-scholarship

**What was done**
- Mirrors client `https://github.com/ShehabShan/School-Hive` review work (`3e7cd5e`): `verifyModaretor`, indexes, `recalcScholarshipRating`, secured `POST /addReviews` (accepted-only gate + dup 409 + pending), `GET /allReviews` ownership+status filter safe join, `GET /allReviews/:id` approved-only, `DELETE` owner|staff + `PATCH` edit & `PATCH /moderate` + `GET /reviews/stats`. `node --check` ok, pushed to `main`.

**Blocker**
- Vercel deploy failed: `The token provided via --token is not valid` (`VERCEL_TOKEN` expired). Live `https://server-six-vert.vercel.app` not yet updated. Rotate token then `npx vercel --prod --yes --token "$VERCEL_TOKEN"`.

**Left / next**
- Deploy server, verify `POST /addReviews` 403/409 and moderation recalc on live.

---

## 2026-08-31 — Session-continuity system setup (mirror)

**What was done**
- Created the mirror session-continuity system: `AGENTS.md`, `TASKS.md`, `docs/HANDOFF_LOG.md`, `docs/DEPLOY.md`, `docs/CREDENTIALS.md`.
- Baked in standing working rules (commit frequently, push after every commit, token-budget emergency commit+push, keep continuity files current).
- Documented the full API surface (auth, users, scholarships, reviews, applications) in `AGENTS.md`.

**Decisions & context**
- Secrets stay OUT of this repo; the server reads env vars from Vercel project
  `server-six-vert` (Environment Variables panel) and local gitignored `.env`.
- Vercel deploy token lives outside the repo at `~/.config/school-hive/deploy.env`
  (registry: `docs/CREDENTIALS.md`); Vercel CLI is invoked via `npx vercel --prod --token`.
- `npm start` is currently a placeholder — `npm run dev` (nodemon-style) is the local path; Vercel uses `vercel.json` -> `@vercel/node` -> `index.js`.

**In progress**
- Nothing. Baseline established.

**Left / next**
- See `TASKS.md` BACKLOG (no tests, single-file API, no pagination, etc.).

---

_(older entries go below — none yet; this is the first session recorded)_
