# AGENTS.md — Schole-hive-server (Express + MongoDB API)

Project-level rules and session-continuity system for AI coding agents.
Any AI agent starting a session in this repo MUST read this file first and follow
the rules below. This is the MIRROR of the client repo's system
(`../School-Hive/AGENTS.md`) — keep the two in sync.

## 1. MANDATORY onboarding — read these before doing anything

1. Read `TASKS.md` — DONE / IN PROGRESS / LEFT.
2. Read the newest (top) entry in `docs/HANDOFF_LOG.md`.
3. Read `docs/DEPLOY.md` and `docs/CREDENTIALS.md` — how to deploy (Vercel) and
   where deploy secrets live (secrets are NOT committed to this repo).
4. Read the sibling client repo `../School-Hive/AGENTS.md` and its `TASKS.md` /
   `docs/HANDOFF_LOG.md` if present — the client is the other half of this app
   and holds the master session-continuity narrative.

## 2. STANDING WORKING RULES (apply to every session, no exceptions)

- **Commit frequently.** One small, working commit per unit of progress (one
  endpoint, one fix, one refactor). Do NOT batch everything into one commit.
- **Push after every commit.** Never leave work only in the session environment.
- **Token/usage-budget safety.** If you risk running out of context/token budget
  mid-task, IMMEDIATELY commit and push whatever is done and working, update
  `TASKS.md` and `docs/HANDOFF_LOG.md` first, then push those too.
- **Update continuity files as you go.** Start -> IN PROGRESS in `TASKS.md`;
  finish -> DONE; meaningful chunk / end of session / budget pressure -> append a
  dated entry to the TOP of `docs/HANDOFF_LOG.md`. Commit and push.
- **Never store secrets in the repo.** No tokens, passwords, or API keys in
  committed files (incl. `.env`, `.env.local`, `deploy.env`). The server reads its
  secrets from Vercel Environment Variables and local `.env` (gitignored).
- **DEPLOY BLOCK — owner permission required (client + server).** NEVER run `npm run deploy`, `npx vercel --prod`, `vercel --prod`, `git push origin main` (Vercel auto-deploys on push to `main`), or `git merge feature/* -> main` without the owner's explicit permission in the current session. Permission must be an explicit user message such as `deploy approved`, `yes deploy`, or `allow deploy`. If a task would require a deploy, you MUST first ask the owner via the `question` tool and wait for affirmative confirmation. Document the decision in `docs/HANDOFF_LOG.md`. This rule overrides "Commit frequently / Push after every commit" for production deploys — pushing to `feature/*` branches is allowed, pushing/deploying to `main`/production is not.
- **No debug leftovers.** Remove `console.log` debug statements before committing.

## 3. Project overview

Express + MongoDB API for the School-Hive scholarship platform. Deployed to Vercel
as `https://server-six-vert.vercel.app`. The React client (`../School-Hive`) calls
these endpoints with axios. Auth: JWT issued via `POST /jwt`, verified via
`verifyToken` middleware (Bearer header or `token` cookie). DB: MongoDB database
`schoolHive`, collections `scholership`, `reviews`, `users`, `apply`.

## 4. Commands

```bash
npm install            # install deps
npm run dev            # start locally on :5000 (NODE_ENV default) — reads .env
npm start              # no-op placeholder currently
```

- Local `.env` is gitignored. Required vars (also set in Vercel):
  - `MONGO_URI` (full connection string) **or** `DB_USER` + `DB_PASS`
  - `ACCESS_TOKEN_SECRET` (JWT signing secret)
  - `ADMIN_EMAILS` (comma-separated emails auto-promoted to `superadmin` on signup)
  - `NODE_ENV` (production on Vercel)

## 5. Repository layout

- `index.js` — the entire API in one file (Express app + MongoDB client + routes).
  - Auth: `POST /jwt`, `POST /clear-jwt`, `verifyToken` middleware.
  - Users: `POST /users`, `GET /users`, `GET /user?email=`, role checks
    `GET /users/:role/:email` (`admin`, `superAdmin`, `modaretor`, `user`).
    Roles: `user`, `modaretor`, `admin`, `superadmin` (owner, protected — cannot
    be modified via role-change endpoints).
  - Scholarships: `POST/GET /allScholership`, `GET/DELETE/PATCH /allScholership/:id`.
  - Reviews: `POST /addReviews`, `GET /allReviews`, `GET /allReviews/:id`,
    `DELETE /allReviews/:id`.
  - Applications: `POST /apply`, `GET /apply`, `GET /allapply`,
    `GET /singleApply/:id`, `PATCH /allapply/cancel/:id`, `PATCH /allapply/accepted/:id`.
  - `GET /` — root status message.
- `vercel.json` — routes all traffic to `index.js` via `@vercel/node`.
- `package.json` — express, cors, dotenv, jsonwebtoken, mongodb, cookie-parser.

## 6. Related repo

Client: `https://github.com/ShehabShan/School-Hive` (React/Vite). Clone it next to
this repo as `School-Hive` for full local dev. Its `AGENTS.md` is the master
continuity entry point.

## 7. Onboarding reference

- `TASKS.md` — project status (done / in progress / todo).
- `docs/HANDOFF_LOG.md` — session-by-session handoff log (newest at top).
- `docs/DEPLOY.md` — deploy procedure + credential location.
- `docs/CREDENTIALS.md` — deploy credential registry (values NOT in repo).
