# CREDENTIALS.md — Deploy credentials registry (server)

This file is the **registry** for deployment secrets. It lists what exists and where
it lives. The deploy token values themselves are NOT stored in this repo — they live
in the sibling client repo's `School-Hive/docs/CREDENTIALS.md`, which is the
canonical owner-approved location (committed in plaintext for this low-stakes test
project so sessions never lose access).

## Where deploy credentials live

- `VERCEL_TOKEN` + `FIREBASE_TOKEN` → committed in **`School-Hive/docs/CREDENTIALS.md`** (client repo).
- Server runtime secrets (`DB_USER`/`DB_PASS`, `ACCESS_TOKEN_SECRET`, `ADMIN_EMAILS`)
  → Vercel project Environment Variables (production) and the gitignored
  `Schole-hive-server/.env` (local runs).

## How a future session deploys the server

Normal flow — the Vercel project `server` is linked to GitHub
(`ShehabShan/Schole-hive-server`) with auto-deploy on push to `main`:

```bash
git checkout main
git merge feature/login-roles     # promote the branch to deploy
git push origin main              # Vercel deploys production automatically
```

CLI fallback (GitHub integration not used):

```bash
VERCEL_TOKEN="<read from ../School-Hive/docs/CREDENTIALS.md>"
npx vercel link --project server --yes --token "$VERCEL_TOKEN"   # first time only
npx vercel --prod --yes --token "$VERCEL_TOKEN"
```

If `VERCEL_TOKEN` needs rotating, create a new token in the Vercel dashboard
(Settings → Tokens, scoped to project `server`) and update the value in
`School-Hive/docs/CREDENTIALS.md` — then copy this file's notes if anything changes.

## Guardrails

- Do not duplicate token values into this repo — read them from
  `School-Hive/docs/CREDENTIALS.md`.
- If you suspect a token leaked, tell the project owner so it can be rotated in the
  Vercel dashboard / Firebase Console and re-written to the client credentials file.