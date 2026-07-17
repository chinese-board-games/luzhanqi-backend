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
There is no CI configured for this repo — `tsc --noEmit` and `npm test` are
the verification surface; DB-dependent changes additionally need a live
`docker compose up` check (see gotchas below).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
`fix:`, `refactor:`, `test:`, `docs:`, `chore:`, optionally with a scope,
e.g. `fix(lzqgame): ...`).

## Layout

- `src/server.ts` — HTTP + socket.io bootstrap, CORS allowlist
- `src/lzqgame.ts` — all socket.io event handlers (join/rejoin/move/setup/AI turns). Thin wrappers where possible; real logic lives in `services/`. Also owns the auth/ownership checks for socket events — see "Authentication & authorization" below
- `src/middleware/auth.ts` — `requireAuth`/`optionalAuth` Express middleware verifying a Firebase ID token from the `Authorization: Bearer <token>` header (sets `req.uid`)
- `src/utils/firebaseAdmin.ts` — `verifyIdToken`; lazily initializes the Firebase Admin SDK from `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` env vars
- `src/services/gameplayService.ts` — socket-free move/setup application (`applyMove`, `submitInitialBoard`, `pieceMovement`, `broadcastGameState`) — reused by both real player handlers and the AI's own turns. Prefer adding new gameplay logic here over `lzqgame.ts` so it stays testable without a socket
- `src/controllers/` — Mongoose DB access (`gameController.ts`, `userController.ts`)
- `src/models/Game.ts` — the `Game` schema (board, players, turn/phase, reconnection tokens, join code, rule-variant config, AI config)
- `src/models/User.ts` — the `User` schema (games list, `archivedGames` — dismissed-but-not-deleted rejoin entries, rank)
- `src/routes/` — REST endpoints (`GET/POST /games/...`, `/user/...`) — see "Authentication & authorization"
- `src/utils/` — pure, socket/DB-free functions: board/piece primitives (`board.ts`, `piece.ts`), move generation (`getSuccessors.ts`), setup validation (`validateSetup.ts`), fog-of-war redaction (`fog.ts`), curated setup layouts (`exampleBoards.ts`), the AI opponent (`aiPlayer.ts` heuristic move scorer, `aiSetup.ts` random valid placement)

## Authentication & authorization

The client sends a Firebase ID token (never a raw uid) wherever caller
identity matters; the server verifies it before trusting anything. Anonymous
play is allowed throughout — a missing token is fine, a *present but
invalid* one is treated as an error, not silently downgraded to anonymous.

- **REST**: `/user/*` requires `requireAuth` + a `requireSelf` check (the
  verified uid must equal the `:userId` in the URL) applied once at the
  router level. `GET /games/:gameId` uses `optionalAuth`: a verified
  participant gets their own fogged view (same as they'd see in-game);
  anyone else (unauthenticated, or authenticated as a non-participant) gets
  `board`/`deadPieces`/`moves` stripped entirely, since this route has no
  other way to fog per-viewer.
- **Sockets**: `lzqgame.ts`'s `resolveUid(socket, idToken)` verifies a
  token via `verifyIdToken` and emits an `'error'` + returns a
  `TOKEN_INVALID` sentinel on failure (bail out with
  `if (uid === TOKEN_INVALID) return;` — don't treat it as anonymous).
  Separately, `verifyOwnsSeat(socket, gid, playerName)` checks the claimed
  `(gid, playerName)` against `socketSeatRegistry` (an in-memory
  `socket.id → {gid, playerName}` map maintained by
  join/rejoin/create handlers) before letting a socket act as that player
  in `playerMakeMove`/`playerForfeit`/`playerInitialBoard`/`pieceSelection`/
  `hostRoomFull` — this is what stops one connected client from moving,
  forfeiting, or reconfiguring rules as a different player just by naming
  them in the payload. `socketSeatRegistry` is orthogonal to the DB-backed
  reconnection token — losing it (e.g. a server restart) doesn't affect
  reconnection, only same-session seat spoofing.
- Local dev without `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/
  `FIREBASE_PRIVATE_KEY` set works fine for anonymous flows (no token ever
  reaches `verifyIdToken`) but throws the moment a real token needs
  verifying.

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
- **`firebaseAdmin.ts` uses deferred `require()`, not top-level `import`.**
  `firebase-admin/auth` transitively pulls in an ESM-only dependency
  (`jose`) that Jest's CommonJS transform can't parse. A static import
  would break the moment *any* test imports anything that transitively
  imports this module, even if `verifyIdToken` is never called. Keep new
  Firebase Admin usage behind a function-scoped `require()`, not a
  module-level `import`.
- **A rule-variant change must stay in sync across three places**:
  `pieceMovement`/`getSuccessors` in `gameplayService.ts`/`getSuccessors.ts`
  (server truth), the AI's move evaluation in `aiPlayer.ts` (so the AI
  doesn't misjudge outcomes under a variant it doesn't know about), and the
  frontend's `predictOutcome.js`/`getSuccessors.js` mirrors (see that
  repo's AGENTS.md). `landminesSurvive`/`flyingBombs`/`captureTheFlag` all
  default to `false` in `Game.config` — any new variant should too, so
  existing games are unaffected.
- **`captureTheFlag`'s board orientation.** Host (affiliation 0) occupies
  the *bottom* half of the merged 12-row board (home HQ at row 11); the
  guest (affiliation 1) occupies the top half (home HQ at row 0) — this is
  fixed by `submitInitialBoard`'s merge order regardless of submission
  order. Getting these backwards once shipped a bug where capturing the
  enemy flag (standing at their HQ) was mistaken for reaching your own HQ,
  ending the game on capture instead of requiring the carry-home. If a
  dropped/respawned flag's carrier is captured, it respawns at the flag
  owner's home row (searching the two HQ cells, then the rest of the row,
  then falling back to the move's source square — a fresh setup fills
  every cell, so "no free HQ cell" is the common case, not an edge case).
- **`emplaceBoardFog` must tolerate a null board.** `Game.board` is `null`
  until both setup halves are merged (phase 0/1). Every caller *should*
  guard with a `board` truthiness check before calling in, but at least one
  call site historically didn't (a crash reported in GH issue #83) — the
  function itself now guards defensively, but don't rely on that alone when
  adding a new caller; check `myGame.board` first anyway for clarity.
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
  starts (~30-60s) after ~15 min of inactivity. Firebase Admin credentials
  are set as Render environment variables, not committed to the repo.
