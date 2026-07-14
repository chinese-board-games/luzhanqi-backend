# AGENTS.md — luzhanqi-backend

Node/TypeScript/Express server for Luzhanqi (Chinese military chess), using
socket.io for realtime gameplay and MongoDB (Mongoose) for persistence.

## Commands

- `npm run dev` — local dev server (`ts-node-dev`, auto-restarts on change)
- `npm run build` — type-check + compile to `dist/` (`tsc`)
- `npm run prod` — run the compiled build (`NODE_ENV=production node dist/server.js`)
- `npm test` — Jest (`NODE_ENV=test jest`); tests are colocated as `*.test.ts` next to the source they cover
- `docker compose up` — starts MongoDB + the app together (bind-mounts the repo, runs `npm run dev` inside the container); requires a `.env` file (see README.md for the template)

Node 20.9.0. A pre-commit hook (husky + lint-staged) runs `eslint --fix` on
`*.js` and `tsc-files --noEmit` (type-check only, no auto-fix) on `**/*.ts`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
`fix:`, `refactor:`, `test:`, `docs:`, `chore:`, optionally with a scope,
e.g. `fix(lzqgame): ...`).

## Layout

- `src/server.ts` — HTTP + socket.io bootstrap, CORS allowlist
- `src/lzqgame.ts` — all socket.io event handlers (join/rejoin/move/setup/AI turns). Thin wrappers where possible; real logic lives in `services/`
- `src/services/gameplayService.ts` — socket-free move/setup application (`applyMove`, `submitInitialBoard`, `pieceMovement`, `broadcastGameState`) — reused by both real player handlers and the AI's own turns. Prefer adding new gameplay logic here over `lzqgame.ts` so it stays testable without a socket
- `src/controllers/` — Mongoose DB access (`gameController.ts`, `userController.ts`)
- `src/models/Game.ts` — the `Game` schema (board, players, turn/phase, reconnection tokens, AI config)
- `src/routes/` — REST endpoints (`GET/POST /games/...`, `/user/...`)
- `src/utils/` — pure, socket/DB-free functions: board/piece primitives (`board.ts`, `piece.ts`), move generation (`getSuccessors.ts`), setup validation (`validateSetup.ts`), fog-of-war redaction (`fog.ts`), the AI opponent (`aiPlayer.ts` heuristic move scorer, `aiSetup.ts` random valid placement)

## Known gotchas

- **Two parallel Piece/Board type definitions.** `src/types.ts` has a legacy
  `Piece` shape with extra `0`/`1`/`length` fields (a leftover hack for
  treating coordinate pairs as "Piece"-typed); `src/utils/piece.ts` +
  `src/utils/board.ts` have the clean shape that `getSuccessors`/
  `validateSetup`/most game logic actually expect. They're structurally
  compatible in one direction only (legacy → clean), so passing a
  clean-typed value somewhere expecting the legacy type (e.g. into
  `emplaceBoardFog`) needs an explicit cast. When adding new code, prefer
  importing `Piece`/`Board` from `utils/piece.ts`/`utils/board.ts`.
- **No DB-backed test infra.** There's no in-memory Mongo / mocking setup,
  so `applyMove`/`submitInitialBoard`/anything touching `gameController.ts`
  isn't covered by automated tests — only pure functions in `utils/` and
  `services/gameplayService.ts`'s pure helpers (e.g. `pieceMovement`) are
  unit tested. Verify DB-dependent changes by actually running the app
  (`docker compose up` + a frontend pointed at it), not just `npm test`.
- **The local Mongo database name has a `streamhatchet` suffix baked in**
  (`src/app.ts`'s `LOCAL_MONGO_URI`, a leftover from another project) — if
  inspecting the dev DB directly via `mongosh`, the database is
  `<DB_NAME>streamhatchet`, not `<DB_NAME>`.
- Deploys to Render (see `render.yaml`) on the free tier — expect cold
  starts (~30-60s) after ~15 min of inactivity.
