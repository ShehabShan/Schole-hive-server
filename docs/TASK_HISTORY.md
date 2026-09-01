# TASK_HISTORY.md — Schole-hive-server (Express + MongoDB) — Archive

Completed work moved from `TASKS.md`. `TASKS.md` stays lean (IN PROGRESS / TODO / BACKLOG). Newest at top.

---

## 2026-09-01 — User & Admin Profile — Full-Fledged

- `POST /users` persists `photoURL/createdAt` (+ sync on dup), `GET /user` secured, `GET /users` staff-only
- `GET /users/me` + `PATCH /users/me` whitelist (name/photoURL/coverPhoto/phone/bio/city/country/skills) with validation

## 2026-09-01 — Review System — Proper Moderation

- `verifyModaretor` middleware (modaretor|admin|superadmin)
- Review indexes: unique `(reviewer_email, scholarShip_id)` + `(scholarShip_id, status)` + `(status, createdAt)`
- `recalcScholarshipRating` — avg of approved → `scholership.rating` + `reviewsCount`
- `POST /addReviews` — secured (`verifyToken+loadAuthUser`), validates rating/comment, gates `apply.applicationStatus==="accepted"`, dup 409, `status="pending"`, `isVerified=true`, `createdAt`
- `GET /allReviews` — `verifyToken+loadAuthUser`, enforces `email===decoded` unless staff, `status/q/scholarShip_id/page/limit`, safe ObjectId join
- `GET /allReviews/:id` — public returns `status="approved"` only
- `DELETE /allReviews/:id` — secured (owner OR staff) + recalc
- `PATCH /allReviews/:id` — owner/staff edit `comment/rating` → `isEdited` + re-pending
- `PATCH /allReviews/:id/moderate` — staff only `approved|rejected|hidden|pending` + `moderatedBy/At`
- `GET /reviews/stats` — staff only counts

## Core server (as found at setup) + Session-continuity system

- Express + MongoDB, single `index.js`, database `schoolHive`.
- JWT: `POST /jwt`, `POST /clear-jwt`, `verifyToken` (Bearer or cookie).
- Role model: `user`, `modaretor`, `admin`, `superadmin` (owner, `ADMIN_EMAILS` auto-promote).
- Users API: create, list (verified), get by email, role checks `GET /users/:role/:email`.
- Scholarships API: list/create, get-by-id, update, delete.
- Reviews API: add, list (all + by scholarship), delete.
- Applications API: apply (verified), my/all/single, cancel, accept/reject.
- Root `GET /` status, CORS for `localhost:5173` + Firebase hosts.
- Session-continuity: `AGENTS.md`, `TASKS.md`, `docs/HANDOFF_LOG.md`, `docs/DEPLOY.md`, `docs/CREDENTIALS.md`.
