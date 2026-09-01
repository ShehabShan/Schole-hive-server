# HANDOFF_LOG.md — Schole-hive-server

Session-by-session handoff log. **Newest entry at the top.**
Every session that does meaningful work appends a dated entry here before finishing
(or before hitting a token/budget limit) and commits + pushes it.
This is the MIRROR of the client repo's log (`../School-Hive/docs/HANDOFF_LOG.md`),
which is the master narrative — keep the two consistent.

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
