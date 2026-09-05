# PROJECT_CONTEXT.md — School-Hive Full-Stack (for Claude / any AI planner)

> **Purpose:** Single-file brain dump so an AI (Claude, etc.) can generate accurate plans without re-discovering the codebase. Give this file + your task prompt. Covers **both repos** (client + server) that run as one product.

---

## 1. One-Liner + Live URLs + Repos

| Piece | Repo | Live URL | Host | Project ID |
|-------|------|----------|------|------------|
| **Client** (React) | `https://github.com/ShehabShan/School-Hive` — local `School-Hive/` | `https://scholarhive-913e4.web.app` | Firebase Hosting | `scholarhive-913e4` (`.firebaserc`, `firebase.json:2`) |
| **Server** (Express) | `https://github.com/ShehabShan/Schole-hive-server` — local `Schole-hive-server/` sibling | `https://server-six-vert.vercel.app` | Vercel | `server` — `orgId team_2BZVyUrUv1CN2VEyU43IxnR6`, `projectId prj_RHc6ftkASVUyYGHzJHpWfJZppLkj` (`School-Hive/scripts/deploy.sh:14-15`, `Schole-hive-server/.vercel/project.json`) |

**Product:** MERN scholarship platform + Q&A forum ("SoloSphere"/"School-Hive"). Students find/apply for scholarships, review them, ask academia questions; institutions publish scholarships; moderators/admins manage.

**Current HEADs (2026-09-05 post-cleanup):**
- Client `School-Hive@8247512` — `fix(details): resolve TDZ crash` (base `57d6768 feat: overhaul QuestionDetail UI...`), deployed via `scripts/deploy.sh --client-only`
- Server `Schole-hive-server@a5772d1` — `docs: mark comment-system removal` (2 recent feature commits `b0a181b`/`b1419cc` permanently deleted via `reset --hard + force-with-lease`, then deployed via `deploy.sh`)

---

## 2. Architecture

```
Browser (Vite SPA) ──Axios──> Vercel Node (Express) ──MongoClient──> MongoDB Atlas (db: schoolHive)
        │                          │
        ├─ Firebase Auth (email/pass + Google) ─POST /jwt─> JWT (access-token in localStorage)
        └─ Firebase Hosting (dist/)    └─ collections (14) + ensureIndexes()
```

- **Client talks to server** via `VITE_server_url` (`School-Hive/src/Hooks/useAxiosPublic.jsx:4`, `useAxiosSecure.jsx:6`). Falls back to `https://server-six-vert.vercel.app` if env unset. **Vite build bakes this URL** — see Deploy §9.
- **Auth:** Firebase `onAuthStateChanged` → `POST /jwt {email}` → server signs JWT (async `jwt.sign`) → stored `localStorage["access-token"]` → `Authorization: Bearer` on `useAxiosSecure`. `POST /clear-jwt` on logout. 401/403 interceptor in `useAxiosSecure.jsx:25` redirects to `/signIn` with `state.from` (debounced, `getNavigate()` holder, not `window.location` hard reload).
- **Image upload:** `src/lib/optimizeImage.js` (browser-image-compression, WebP q 0.82, 1280px, WebWorker) → imgbb. Reused in 7 flows (Registration, MyProfile, RichTextEditor, Apply, Add/EditScholarship, VerifyRequest).

---

## 3. Tech Stack

**Client `School-Hive/package.json`:**
- React 18 + Vite 5 + `react-router-dom` 7.18 (`createBrowserRouter` in `src/routes/Routes.jsx`)
- Tailwind 3.4 + daisyUI 4.10, `framer-motion`, `lucide-react`
- `@tanstack/react-query` 5.65, `axios` 1.7, `firebase` 11.2, `zod` 4.5, `react-hook-form` + `@hookform/resolvers`, `react-hot-toast`, `sweetalert2`, `react-markdown` + `remark-gfm`
- Dev: `sharp` for static recompression, `vitejs/plugin-react`, eslint

**Server `Schole-hive-server/package.json`:**
- Express 4.21 + `cors`, `compression` 1.8 (gzip), `cookie-parser`, `dotenv`, `mongodb` 6.12, `jsonwebtoken` 9.0
- No TS, no test harness yet (backlog). Thin layered architecture (see §4).

---

## 4. Repository Layout

### 4.1 Client `School-Hive/`
```
src/
  main.jsx                — QueryClient + RouterProvider + HelmetProvider
  routes/Routes.jsx:57    — createBrowserRouter, 3 role dashboards
  Layout/                 — MainLayout, Home, AdminDashboard, UserDashboard, ModaratorDashboard
  Firebase/               — firebase.init.js, AuthProvider.jsx (JWT round-trip)
  Hooks/                  — useAxiosPublic/Secure, useAuth, useAdmin/useModaretor/useSuperAdmin/useUser,
                           useRole (single role hook), useScholership, useSingleScholership, useReviews,
                           useSaved, useFollow, useCompare, useDebounce
  Pages/
    AllScholership/       — AllScholership.jsx (search/filter/sort/pagination), ScholarshipCard.jsx
    ScholarshipDetails/   — ScholarshipDetails.jsx (fixed TDZ 8247512), AllReviews.jsx + details/* (Gallery, SummaryCard, StickyApplyBar, SectionAccordion, etc.)
    UserPage/             — MyProfile, MyApplication, MyReviews, Saved, Apply
    ModaratorPages/       — ManageScholarships, AllAppliedScholarship, AddScholarship
    AdminPages/           — ManageUsers, ManageAppliedApplication, ManageReviews, InstitutionApprovals, VerifyApprovals
    QA/                   — BrowseQuestions, QuestionDetail, AskQuestionWizard, VerifyRequest
    Authentication/       — Login, Registation, InstitutionStatus, SocialLogin
  Component/              — ui/*, scholarship/*, QA/*, ErrorPage/NotFound, etc.
  lib/                    — optimizeImage.js, navigation.js (getNavigate holder)
  scripts/                — deploy.sh, check-dist-server-url.mjs, optimize-assist.mjs
public/, dist/, firebase.json, .firebaserc
```

### 4.2 Server `Schole-hive-server/`
```
src/
  server.js               — entry (createApp, listen); exports for Vercel
  app.js:35               — createApp() => Express: CORS + compression + json 100kb + cookieParser + securityHeaders + globalRateLimit + ensureDb + cache 30s + mount 13 routers + 404/errorHandler
  api/index.js            — Vercel serverless shim -> src/server.js
  index.js                — shim -> src/server.js (backward compat)
  config/
    env.js                — validates PORT/MONGO_URI|DB_USER+DB_PASS/ACCESS_TOKEN_SECRET/ADMIN_EMAILS
    db.js:22              — connect() => schoolHive collections + ensureIndexes() (14 collections, 30+ indexes, text indexes, answerCount backfill)
  middleware/
    verifyToken, loadAuthUser, authorize (6 guards: verifyAdmin, verifyModaretor, verifySuperAdmin, verifyInstitution, verifyScholarshipEditor, verifyScholarshipOwner),
    security (helmet-like), rateLimit (global 100/min + auth 20/min), errorHandler+asyncHandler, cache
  routes/ (13 files, mounted in app.js:61)
    auth.routes, user.routes, scholarship.routes, saved.routes, inquiry.routes, review.routes, apply.routes,
    seed.routes, institutionStudents.routes, question.routes, answer.routes, verify.routes, notification.routes
  controllers/ + services/ + utils/ — thin controllers -> services (filter/sort, recalcRating) -> collections
vercel.json               — rewrites -> api/index.js via @vercel/node
```

---

## 5. Data Model (Mongo `schoolHive`)

**Collections `src/config/db.js:24-39`:** `scholership` (note typo kept), `users`, `reviews`, `apply`, `saved`, `inquiries`, `review_history`, `institutionStudents`, `follows`, `questions`, `answers`, `reputationEvents`, `verifyRequests`, `notifications`. `question_comments` data still in DB but code removed.

**Key docs:**

**`users`** — `{email (unique), name, photo, role: user|modaretor|admin|superadmin|institution, status: active|pending|approved|rejected (institution), reputation, isVerified, completeness, follower info, orgName/orgType/orgCountry/orgWebsite/orgDescription (institution), createdAt}` + `ADMIN_EMAILS` → superadmin on signup. Indexes `email unique`, `role`, `role+status`.

**`scholership`** — `{_id, universityName, scholarshipName, scholarshipCategory, subjectName, degree: Bachelor|Masters|PhD|Diploma, country, city, universityWorldrank, universityImage, gallery[], tags[], subjectName, eligibility[], benefits[], highlights[], documents[], requirements[], scholarshipDescription, country, city, degree, applicationDeadline (string date), postDate, rating (avg), reviewsCount, applicationFees, serviceCharge, stipend, currency, duration, status: published|draft|scheduled, publishAt, createdBy (email), createdByRole, createdAt}`. Text index `universityName+scholarshipDescription+subjectName+scholarshipCategory`, plus `status`, `rating`, `applicationFees`, `applicationDeadline`.

**`reviews`** — `{_id, scholarshipName, universityName, reviewer_email, scholarShip_id, rating, comment, status: pending|approved|removed, helpfulVoterEmails[], helpfulCount, createdAt}` Unique `reviewer_email+scholarShip_id`.

**`apply`** — `{_id, scholarship_id, email, universityName, scholarshipCategory, applicationStatus: pending|processing|completed|cancelled|rejected, postDate, statusHistory: [{status, at}]}`

**`questions`** — `{_id, title, body (markdown), category, tags[], context: {destinationCountry, homeCountry, studyLevel}, authorEmail, authorName, voteScore, upvoterEmails[], downvoterEmails[], answerCount (denormalized), acceptedAnswerId, followerEmails[], createdAt}` Text index `title+body+tags`.

**`answers`** — `{_id, questionId (ObjectId), authorEmail, body (markdown), voteScore, upvoterEmails[], downvoterEmails[], accepted, createdAt}`

**Other:** `saved {userEmail+scholarshipId unique}`, `follows {followerEmail+followingEmail unique}`, `notifications {recipientEmail, type, read, relatedQuestionId/AnswerId}`, `verifyRequests {email,status}`, `inquiries {scholarshipId, email, message}`.

---

## 6. Auth & Roles

- **Firebase:** Email/pass + Google (`AuthProvider.jsx:31 googleSingIn` via `signInWithPopup`). `createUser`/`signIn` set `loading true` → Firebase SDK. `updateUserProfile` wraps `updateProfile`.
- **JWT:** `onAuthStateChanged` → `axiosPublic.post("/jwt", {email})` → `localStorage["access-token"]`. `loadAuthUser` middleware hydrates `req.authUser`. Logout → `POST /clear-jwt` + `localStorage.removeItem`.
- **Roles:** `users.role` enum `user`, `modaretor` (typo kept), `admin`, `superadmin`, `institution`. Institution signup → `status pending` until superadmin `PATCH /users/institution/:id {status:'approved'|'rejected'}`. `verifyInstitution`, `verifyScholarshipEditor` (superadmin || approved institution), `verifyScholarshipOwner` (superadmin || `createdBy` match) guard scholarship writes. Scholarship create stamps `createdBy`/`createdByRole`.
- **Client hooks:** `useRole` single source, `useAdmin`/`useModaretor`/`useSuperAdmin` wrappers, `useAuth` context. `useAxiosSecure` request interceptor adds `Bearer` + 401/403 handler (`AuthProvider.jsx:56` tokenLoaded gating).

---

## 7. Client Routes `src/routes/Routes.jsx:57`

**Public (MainLayout):** `/` (Home), `/allScholership` (+ `/:id` → `ScholarshipDetails`), `/scholarships` alias (+ `/:id`), `/apply/:id` (Private), `/myProfile`, `/contact`, `/aboutUs`, `/signIn`, `/registration`, `/pendingApproval`, `/rejectedApproval`, `/compare`, `/saved`, `/profile/:email`, `/questions` (+ `/:id` + `/ask` Private), `/verify` (Private).

**Dashboards:**
- `userDashboard` (`UserRoute`): `myProfile`, `myApplication`, `myApplication/:id`, `myApplication/addReviews/:id`, `myReviews`, `saved`
- `modaratorDashboard` (`ModaretorRoute`): `myProfile`, `myReviews`+`/history`, `allAppliedScholarships`+`/:id`
- `adminDashboard` (`AdminRoute`): `adminProfile`, `addScholarships` (`SuperAdminRoute`), `manageScholarships`+`/:id` (`SuperAdminRoute`), `manageAppliedApplication`, `allAppliedScholarships/:id`, `manageUsers`, `institutionApprovals` (`SuperAdminRoute`), `manageReviews`+`/history`, `verifyRequests` (`SuperAdminRoute`)
- `institutionDashboard` (`InstitutionRoute`): `myProfile`, `students` (→ MyProfile), `addScholarships`, `manageScholarships`+`/:id`

*Note:* Route `allScholership` typo is canonical; both spellings exist. `PrivateRoute` = `PrivetRouter` typo file.

---

## 8. Server Endpoints (mounted `src/app.js:61`)

| Router | Prefix / Examples | Auth |
|--------|-------------------|------|
| `auth.routes` | `POST /jwt`, `POST /clear-jwt` | public |
| `user.routes` | `POST /users`, `GET /users`, `GET /user?email=`, `GET /users/:role/:email`, `GET /users/me`, `PATCH /users/me`, `GET /institutions`, `GET /institutions/pending`, `PATCH /users/institution/:id`, `GET /users/public/:email`, `GET /users/me/stats`, `GET /users/export` (CSV) | mixed, some `verifyToken+verifySuperAdmin` |
| `scholarship.routes` | `GET /allScholership` (+ aliases `/scholarships`, `/allScholarships`) `?q=&category=&subject=&degree=&country=&city=&maxFees=&deadlineAfter=&sort=&page=&limit=` → `{data,total}`, `GET /allScholership/:id`, `GET /allScholership/stats`, `POST /allScholership`, `PATCH /allScholership/:id`, `DELETE /allScholership/:id` | writes `verifyToken+verifyModaretor` (or institution guards after login-roles) |
| `saved.routes` | `POST /saved` (toggle), `GET /saved`, `DELETE /saved/:id` | `verifyToken` |
| `inquiry.routes` | `POST /inquiries`, `GET /inquiries?scholarshipId=` | GET `verifyToken+verifyModaretor` (mod list) |
| `review.routes` | `POST /addReviews`, `GET /allReviews`, `GET /allReviews/:id`, `DELETE /allReviews/:id`, `PATCH /allReviews/:id`, `PATCH /allReviews/:id/moderate`, `GET /reviews/history|removed|stats`, `PATCH /allReviews/:id/helpful` | varies |
| `apply.routes` | `POST /apply`, `GET /apply?email=`, `GET /allapply`, `GET /singleApply/:id`, `PATCH /apply/cancel/:id`, `PATCH /apply/accepted/:id` | `verifyToken` + ownership |
| `question.routes` | `POST /questions`, `GET /questions`, `GET /questions/:id`, `POST /questions/:id/follow` toggle | `verifyToken` for write/follow |
| `answer.routes` | `POST /questions/:id/answers`, `GET /questions/:id/answers`, `POST /answers/:id/vote`, `PATCH /answers/:id/accept` | `verifyToken` |
| `verify.routes` | `POST /verifyRequests`, `GET /verifyRequests` | `verifyToken` |
| `notification.routes` | `GET /notifications/me`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | `verifyToken` |
| `institutionStudents.routes` | pending student portal helpers | varies |
| `seed.routes` | dev seeding | restricted |

**Guards `src/middleware/authorize.js`:** `verifyToken` (JWT cookie or Bearer), `loadAuthUser` (hydrate `req.authUser`), `verifyAdmin/Modaretor/SuperAdmin/Institution/ScholarshipEditor/Owner`. Rate limit `globalRateLimit` 100/min + `POST /jwt` 20/min.

---

## 9. Deployment

**Principle:** `DEPLOY BLOCK` (`AGENTS.md:2`) — NEVER `push origin main` (server auto-deploys), `vercel --prod`, `firebase deploy` without explicit owner `deploy approved` / `yes deploy` in current session (ask via `question` tool). Pushing to `feature/*` is allowed.

**Tokens:** Gitignored `deploy.env` at `School-Hive/deploy.env` **and identical** `Schole-hive-server/deploy.env` (`chmod 600`). Never committed — Vercel revokes `vcp_`. Rotate: `https://vercel.com/account/tokens` → `VERCEL_TOKEN`, `npx firebase login:ci --project scholarhive-913e4` → `FIREBASE_TOKEN` (`1//...` contains `//`). Parsing must be `cut -d= -f2- | tr -d ' \r\n'` or `source deploy.env` (not `cut -d= -f2` which truncates). Templates: `deploy.env.example`.

**Fast path `School-Hive/scripts/deploy.sh:9`:**
```bash
./scripts/deploy.sh              # both: server Vercel prod -> client Firebase (+ guarded build)
./scripts/deploy.sh --server-only
./scripts/deploy.sh --client-only  # default for client fix
./scripts/deploy.sh --help
# npm aliases: npm run deploy / deploy:server / deploy:client / build:prod
```
Handles: token load, `.vercel/project.json` creation (`orgId team_2BZVyUrUv1CN2VEyU43IxnR6`), cache-bust retry `rm -rf .vercel` on `NOT_FOUND`, `curl` verify both hosts.

**Client deploy trap `docs/DEPLOY.md:32`:** Dev `.env` has `VITE_server_url=http://localhost:5000`. Plain `npm run build` bakes localhost → breaks prod. Always use guarded `npm run build:prod` / `deploy.sh` which forces `VITE_server_url=https://server-six-vert.vercel.app` and runs `scripts/check-dist-server-url.mjs` to fail if any `localhost` survives or server URL missing.

**Server deploy:** Normally `git checkout main && git merge feature/* && git push origin main` (Vercel GitHub integration). CLI fallback `npx vercel --prod --yes --token "$VERCEL_TOKEN"` with existing `server` project link.

**Verification:** Server `curl -s https://server-six-vert.vercel.app/users/public/mdleonkhan625@gmail.com`, client `curl -I https://scholarhive-913e4.web.app` → 200, smoke auth `/jwt`.

---

## 10. Current State & Recent Changes

- **2026-09-04:** W1–W10 sub-feature waves DONE + **DEPLOYED** (statusHistory, helpful votes, CSV export, notifications, follow toggle) + Q&A answers-only model (question comments code removed, `question_comments` DB data retained). Performance ranks R1–R13 (pagination, compression, WebP, lazy Home, indexes 30+, Promise.all stats, LRU 30s cache) — see `docs/PERFORMANCE_REPORT.md`.
- **2026-09-05 09:10 UTC:** Removed stale feature commits that re-introduced B4/B10: server `b1419cc`/`b0a181b` (`reset --hard a5772d1 + force-with-lease`), client 6 commits `8218636..cfb028b` (`reset --hard 57d6768 + force-with-lease`). Backup branches `backup/main-before-delete` + `School-Hive/backup/main-before-delete-2h`.
- **2026-09-05 15:XX:** Fixed `ScholarshipDetails.jsx:46` TDZ crash → `8247512`, pushed + deployed client-only (now live).

**Backlog for planners (see `TASKS.md:65` B1–B18):** Owner answer edit + history, threaded answer comments, flags/moderation queue, inquiry lifecycle (status+replies), SEO/OG helmet, email verification banner, admin dashboard home, freshness confirm, saved folders/notes, trending, institution funnel/announcements, follow feed, application docs upload, a11y, loading skeletons, audit log. D1–D5 P3 deferred (card duplication, recommended vs rated identical, etc.).

---

## 11. Conventions & Guardrails

- **Sessions:** Read `TASKS.md` → `docs/HANDOFF_LOG.md` (newest top) → `docs/DEPLOY.md` + `deploy.env` header + sibling `AGENTS.md` before any work (`AGENTS.md:1`).
- **Commit/Push:** One small working commit per unit, `push after every commit`, update `TASKS.md` + `HANDOFF_LOG.md` as you go. Never leave uncommitted on budget pressure.
- **No debug leftovers**, no secrets in repo (`.env`, `deploy.env` gitignored). Vercel env vars hold `MONGO_URI`, `ACCESS_TOKEN_SECRET`, `ADMIN_EMAILS`.
- **Typo canon:** Keep `scholership`, `allScholership`, `modaretor`, `PrivetRouter` — they are API contracts/aliases, fixing them is breaking change.
- **Routing:** `firebase.json:22` SPA rewrite `** -> /index.html` required for deep links like `/allScholership/:id`.
- **Refs:** Use `file_path:line_number` when mentioning code (requirement for AI output).

---

## 12. How to Use This File to Plan

1. **Read this + `TASKS.md` + `docs/HANDOFF_LOG.md` first** — do NOT re-discover.
2. **Pick from BACKLOG B1–B18** or propose new slice; state server vs client touch, DB migration, indexes needed.
3. **Plan format:** Goal → Files to touch (`path:line`) → API contract → UI sketch → Verify steps (`npm run build`, `curl`, manual flow) → Deploy order (server first, then client) + permission ask.
4. **Constraints:** Keep typo aliases, guard writes with role checks, add indexes for new queries, preserve `ensureIndexes` idempotency, use `optimizeImage` for uploads, respect `DEPLOY BLOCK`.

*Mirror note: This file lives at `School-Hive/docs/PROJECT_CONTEXT.md`; server sibling references it as `../School-Hive/docs/PROJECT_CONTEXT.md` per `AGENTS.md` sibling rule. Keep in sync if copied.*

