# TASKS.md — Schole-hive-server (Express + MongoDB API)

Live project status. Keep this file current every session:
- START a unit -> **IN PROGRESS**. FINISH a unit -> **DONE**. New work -> **BACKLOG**.

Detailed session narrative and decisions live in `docs/HANDOFF_LOG.md` (newest at top).
Deploy procedure and credentials live in `docs/DEPLOY.md` / `docs/CREDENTIALS.md`.

---

## DONE

### Session-continuity system (mirror of client repo)
- [x] `AGENTS.md`, `TASKS.md`, `docs/HANDOFF_LOG.md`, `docs/DEPLOY.md`, `docs/CREDENTIALS.md`.
- [x] Standing working rules baked in: commit frequently, push after every commit, token-budget safety, keep continuity files current, no secrets in repo.

### Core server (as found at setup)
- [x] Express + MongoDB app, single `index.js`, database `schoolHive`.
- [x] JWT auth: `POST /jwt`, `POST /clear-jwt`, `verifyToken` (Bearer header or cookie).
- [x] Role model: `user`, `modaretor`, `admin`, `superadmin` (owner). Role-check endpoints for each role; superadmin role protected from modification.
- [x] Users API: create user (`/users` POST), list (`/users` GET, verified), get by email (`/user?email=`). `ADMIN_EMAILS` env auto-promotes owners to `superadmin` on signup.
- [x] Scholarships API: list/create, get-by-id, update, delete.
- [x] Reviews API: add, list (all + by scholarship), delete.
- [x] Applications API: apply (verified), my applications, all applications, single application, cancel (PATCH), accept/reject status (PATCH).
- [x] Root status route.
- [x] CORS for `localhost:5173`, `scholarhive-913e4.web.app`, `scholarhive-913e4.firebaseapp.com` with credentials.

---

## IN PROGRESS

_(nothing right now — next unit goes here when started)_

---

## BACKLOG / KNOWN GAPS

_(candidate work, not yet started. Add anything you find.)_

- [ ] Add automated tests (no test framework wired up; `npm test` is a placeholder).
- [ ] Split `index.js` into route controllers / middleware modules (currently a single 674-line file).
- [ ] Add schema validation for scholarship/review/application payloads.
- [ ] Add pagination to list endpoints (`/allScholership`, `/allapply`, `/allReviews`).
- [ ] Centralize role guard helpers (`verifyAdmin`, `verifySuperAdmin`, `verifyOwnerModifiable` are defined inline).
