# DEPLOY.md — Schole-hive-server (Vercel)

| Piece | Host | Repo | URL |
|-------|------|------|-----|
| Server | Vercel | `Schole-hive-server` (this repo) | https://server-six-vert.vercel.app |
| Client | Firebase Hosting | `School-Hive` (sibling repo) | https://scholarhive-913e4.web.app |

Deploy credentials are NOT committed here. They live in the sibling client repo's
`School-Hive/docs/CREDENTIALS.md`. See `docs/CREDENTIALS.md` (server) for details.

## Deploy (Vercel)

The Vercel project **`server`** is linked to GitHub
(`ShehabShan/Schole-hive-server`) with auto-deploy: **every push to `main`
deploys production** to `https://server-six-vert.vercel.app`. Normal flow:

```bash
git checkout main
git merge feature/<branch>      # promote work to main
git push origin main            # Vercel auto-deploys
```

CLI fallback (GitHub integration not used): the production URL belongs to the
existing project named **`server`** (NOT `schole-hive-server`). Link to it first
or you'll create a throwaway project; the link writes `.vercel/project.json`
(gitignored).

```bash
npm install
VERCEL_TOKEN="<read from School-Hive/docs/CREDENTIALS.md>"
npx vercel link --project server --yes --token "$VERCEL_TOKEN"   # first time only
npx vercel --prod --yes --token "$VERCEL_TOKEN"
```

`vercel.json` routes all traffic to `index.js` via `@vercel/node`.

## Environment variables (configured in Vercel dashboard, NOT in the repo)

- `MONGO_URI` (full MongoDB connection string) **or** `DB_USER` + `DB_PASS`
- `ACCESS_TOKEN_SECRET` (JWT signing secret)
- `ADMIN_EMAILS` (comma-separated emails -> auto `superadmin` on signup)
- `NODE_ENV=production` (sets sameSite/secure cookie behavior)

## Local dev

```bash
cp .env.example .env   # fill in the vars above (local .env is gitignored)
npm run dev            # Express on :5000
```

## Order & verification

1. Deploy the server, confirm https://server-six-vert.vercel.app responds.
2. Client deploy follows (see `../School-Hive/docs/DEPLOY.md`).
3. Smoke-test auth round-trip (sign up / log in hits `POST /jwt`).
