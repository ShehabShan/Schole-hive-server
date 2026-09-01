# TASKS.md — Schole-hive-server (Express + MongoDB API)

Live project status. Keep this file current every session:
- START -> **IN PROGRESS**. FINISH -> **DONE** (archive to `docs/TASK_HISTORY.md` at milestone). New work -> **BACKLOG**.

History: `docs/TASK_HISTORY.md` · Narrative: `docs/HANDOFF_LOG.md` · Deploy: `docs/DEPLOY.md`.

---

## IN PROGRESS

- Scholarship Transformation (2026-09-01) — server foundations for faceted search + saved + stats

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

