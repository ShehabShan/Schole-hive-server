# CREDENTIALS.md — Deploy credentials registry (server)

This file is the **registry** for deployment secrets. It lists what exists and where
it lives. It deliberately contains NO secret values — secrets are never committed to
this repo (see `AGENTS.md` rule: no secrets in the repo).

## Where deploy credentials live

Both deploy tokens live OUTSIDE both repos, in a single git-ignored env file owned
by the session environment:

```
~/.config/school-hive/deploy.env
```

Permissions: `600` (owner read/write only). The filename `deploy.env` is gitignored
in this repo and in `School-Hive` as a safety net.

## Variables in that file

| Variable          | Used for          | Project        |
|-------------------|-------------------|----------------|
| `VERCEL_TOKEN`    | `vercel --token`  | server-six-vert |
| `FIREBASE_TOKEN`  | `firebase deploy` | scholarhive-913e4 |

## How a future session deploys the server

```bash
set -a
# shellcheck disable=SC1091
. ~/.config/school-hive/deploy.env
set +a

npm install
npx vercel --prod --token "$VERCEL_TOKEN"
```

The server's own secrets (MongoDB URI, JWT secret, admin emails) are configured in
the Vercel project's Environment Variables dashboard — they are NOT in this repo
and NOT in `deploy.env`. If the Vercel token is missing, ask the project owner to
re-supply it and re-write it to `~/.config/school-hive/deploy.env` (mode `600`).

## Guardrails

- NEVER print, log, or write a token value into a repo file, a commit message, or a
  support request.
- If you suspect a token leaked, tell the project owner so it can be rotated and
  re-written to `deploy.env`.
