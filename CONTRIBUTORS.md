# Contributing to luzhanqi-backend

## Workflow

1. Branch off `main` (`type/short-description`, e.g. `fix/reconnect-token`,
   `feat/rule-variant`, `chore/dep-bump`, `docs/...`).
2. Open a PR into `main`. CI (`.github/workflows/ci.yml`: lint, typecheck,
   `npm test`) must pass — it's a required status check, so the merge
   button stays disabled until it's green.
3. Use [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, optionally
   with a scope) for commit messages and PR titles.
4. Merge (this repo uses merge commits, not squash/rebase, so `git log`
   keeps a per-PR merge commit).

That's it from a contributor's side — everything after merge is automatic.
See `AGENTS.md`'s "Deployment" section for what happens next (staging
deploy → automated smoke test → promotion to production), and never push
directly to the `production` branch, which only the promotion workflow
should touch.

## Local development

- `docker compose up` — MongoDB + the app together, bind-mounted so edits
  take effect via `npm run dev`'s auto-restart. See `README.md` for the
  required `.env`.
- `npm test` — Jest; there's no DB-backed test infra, so anything touching
  `controllers/`/`services/gameplayService.ts`'s DB-facing functions needs
  manual verification against a real `docker compose up` instance, not just
  `npm test`.
- `npx tsc --noEmit` / `npm run lint` — same checks CI runs, useful to run
  locally before pushing.

## Getting oriented

Start with `AGENTS.md` — it covers the codebase layout, the
authentication/authorization model, and known gotchas worth reading before
touching game logic, auth, or rule variants.
