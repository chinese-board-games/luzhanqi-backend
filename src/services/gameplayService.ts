import { cloneDeep, isEqual } from 'lodash';
import type { Server } from 'socket.io';
import { IGame } from '../models/Game';
import {
    getGameById,
    updateBoard,
    updateGame,
    isPlayerTurn,
    winner,
    sanitizeGameForClient,
} from '../controllers/gameController';
import { pieces, validateSetup, printBoard, emplaceBoardFog } from '../utils';
import { chooseAiExampleHalfBoard } from '../utils/exampleBoards';
import { AI_PLAYER_NAME, AI_SOCKET_SENTINEL } from '../utils/aiConstants';
import { Board } from '../utils/board';
import { Piece } from '../utils/piece';
// emplaceBoardFog's signature predates the clean Piece/Board types above and
// still expects the legacy shape from types.ts - only used for that cast.
import { Piece as FoggablePiece } from '../types';

type Coord = [number, number];

export type PieceMovementConfig = {
    // a non-Engineer attacking a landmine destroys only itself, leaving the
    // mine in place, instead of destroying both (the default)
    landminesSurvive?: boolean;
    // capturing the enemy flag marks the capturer as carrying it instead of
    // ending the game; that side wins only once the carrier reaches its own
    // home HQ (see gameController.winner)
    captureTheFlag?: boolean;
};

// tried in order: the two HQ cells first, then the rest of the home row
const HOME_ROW_COLS = [1, 3, 0, 2, 4];
// host (affiliation 0) occupies the bottom half of the merged 12-row board
// (HQ at row 11); the guest (affiliation 1) occupies the top half (HQ at
// row 0) - see submitInitialBoard's merge order in this same file
const homeHQRow = (affiliation: number) => (affiliation === 0 ? 11 : 0);

// finds a cell to respawn a dropped flag on: the owning affiliation's home
// row, preferring the two HQ cells but falling back to any empty cell in
// that row (a fresh 25-piece setup fills every cell, so both HQ cells
// being occupied - by the carrier's captor, by a landmine that never
// moved, etc - is common, not a rare edge case). If the entire home row is
// somehow full, falls back to `fallbackCell`, which the caller must
// guarantee is empty.
function findFlagDropCell(
    board: Board,
    affiliation: number,
    fallbackCell: Coord,
): Coord {
    const row = homeHQRow(affiliation);
    for (const col of HOME_ROW_COLS) {
        if (board[row][col] === null) {
            return [row, col];
        }
    }
    return fallbackCell;
}

// returns a new board with the move applied, and any pieces that died as a result
export function pieceMovement(
    board: Board,
    source: Coord,
    target: Coord,
    config: PieceMovementConfig = {},
) {
    // copy the board
    board = cloneDeep(board);
    const deadPieces: Piece[] = [];

    if (!source.length || !target.length) {
        return { board, deadPieces };
    }

    const sourcePiece = board[source[0]][source[1]];
    const targetPiece = board[target[0]][target[1]];

    // there is no piece at the source tile (not a valid move)
    if (
        sourcePiece === null ||
        sourcePiece.name === 'landmine' ||
        sourcePiece.name === 'flag'
    ) {
        return { board, deadPieces };
    }

    // pieces are of same affiliation
    if (targetPiece && sourcePiece.affiliation === targetPiece.affiliation) {
        return { board, deadPieces };
    }

    // landmines are handled before the generic order comparison below,
    // since their order (-1) would otherwise let any real piece "win"
    // against one - this branch only fires for non-Engineers; an Engineer
    // falls through to the order-comparison branch and safely defuses it
    if (
        targetPiece &&
        targetPiece.name === 'landmine' &&
        sourcePiece.name !== 'engineer'
    ) {
        if (config.landminesSurvive && sourcePiece.name !== 'bomb') {
            // the mine survives; only the attacker is destroyed - except a
            // bomb, which blows itself and the mine up regardless of this
            // setting (bombs always trade with whatever they hit)
            deadPieces.push(sourcePiece);
            board[source[0]][source[1]] = null;
        } else {
            // mutual destruction (default, and always for a bomb attacker)
            deadPieces.push(targetPiece, sourcePiece);
            board[target[0]][target[1]] = null;
            board[source[0]][source[1]] = null;
        }
    } else if (
        targetPiece &&
        (sourcePiece.name === 'bomb' ||
            sourcePiece.name === targetPiece.name ||
            targetPiece.name === 'bomb')
    ) {
        // remove both pieces
        deadPieces.push(
            board[target[0]][target[1]] as Piece,
            board[source[0]][source[1]] as Piece,
        );
        board[target[0]][target[1]] = null;
        board[source[0]][source[1]] = null;
    } else if (targetPiece === null || sourcePiece.order > targetPiece.order) {
        // place source piece on target tile, remove source piece from source tile
        if (targetPiece) {
            // a piece was actually captured here - the source piece survives
            // and occupies the target tile, so it must not be marked dead
            deadPieces.push(targetPiece);
            if (config.captureTheFlag && targetPiece.name === 'flag') {
                sourcePiece.carryingFlag = true;
            }
        }
        board[target[0]][target[1]] = sourcePiece;
        board[source[0]][source[1]] = null;
    } else {
        // kill source piece only
        deadPieces.push(board[source[0]][source[1]] as Piece);
        board[source[0]][source[1]] = null;
    }

    // under captureTheFlag, a flag being carried never truly vanishes: if
    // its carrier just died (to anything - a landmine, a bomb, a stronger
    // piece), the flag drops and respawns at its original owner's home row
    // instead, rather than ending the game or disappearing forever. The
    // source tile of this move is always empty afterward whenever a piece
    // died (every combat branch above vacates it), so it's always a valid
    // last-resort drop spot. This guarantees the flag can only ever
    // disappear from the board outright (ending the game per winner()'s
    // fallback) by being destroyed before anyone has captured it.
    if (config.captureTheFlag) {
        deadPieces
            .filter((piece) => piece.carryingFlag)
            .forEach((fallenCarrier) => {
                const flagOwnerAffiliation = 1 - fallenCarrier.affiliation;
                const cell = findFlagDropCell(
                    board,
                    flagOwnerAffiliation,
                    source,
                );
                board[cell[0]][cell[1]] = {
                    name: 'flag',
                    affiliation: flagOwnerAffiliation,
                    order: 0,
                    kills: 0,
                };
            });
    }

    return { board, deadPieces };
}

export type GameStats = {
    remain: { name: string; count: number; order: number }[][];
    lost: { name: string; count: number; order: number }[][];
};

// accepts an optional game document the caller already fetched, skipping
// the internal getGameById re-fetch (see applyMove, a hot path where every
// independent re-fetch of the same document adds real DB round-trip cost)
type PreloadedGame = Awaited<ReturnType<typeof getGameById>>;

// returns per-player remaining/lost piece counts, or null if the game/board isn't found
export async function getGameStats(
    gid: string,
    preloadedGame?: PreloadedGame,
): Promise<GameStats | null> {
    const myGame = preloadedGame ?? (await getGameById(gid));
    if (!myGame?.board) {
        console.error('Game or game board not found.');
        return null;
    }
    const emptyPieceArr = [
        ...Object.keys(pieces).map((piece) => ({
            name: piece,
            count: 0,
            order: pieces[piece].order,
        })),
    ];

    const remain = [
        JSON.parse(JSON.stringify(emptyPieceArr)) as [
            { name: string; count: number; order: number },
        ],
        JSON.parse(JSON.stringify(emptyPieceArr)) as [
            { name: string; count: number; order: number },
        ],
    ];
    myGame.board.forEach((row) => {
        row.forEach((piece) => {
            if (piece) {
                const affiliation = piece.affiliation;
                const pieceIndex = remain[affiliation].findIndex(
                    (p) => p.name === piece.name,
                );
                remain[affiliation][pieceIndex].count += 1;
            }
        });
    });
    const lost = [
        remain[0].map(({ name, order, count: _count }) => {
            const pieceIndex = remain[0].findIndex((p) => p.name === name);
            return {
                name,
                count: pieces[name].count - remain[0][pieceIndex].count,
                order,
            };
        }),
        remain[1].map(({ name, order, count: _count }) => {
            const pieceIndex = remain[1].findIndex((p) => p.name === name);
            return {
                name,
                count: pieces[name].count - remain[1][pieceIndex].count,
                order,
            };
        }),
    ];
    return { remain, lost };
}

export type MoveResult =
    | {
          ok: true;
          game: IGame;
          turn: number;
          deadPieces: Piece[];
          winnerIndex: number;
          gameStats: GameStats | null;
          fieldMarshallDown: { playerName: string; affiliation: number }[];
      }
    | { ok: false; reason: string };

/**
 * Validates and applies a move to a game, persists the result, and checks
 * for a winner. No socket/io access - safe to call for a human move (from
 * the playerMakeMove socket handler) or an AI move (from runAiTurn).
 * @see applyMove
 */
export async function applyMove(
    gid: string,
    playerName: string,
    uid: string | null,
    turn: number,
    pendingMove: { source: Coord; target: Coord },
): Promise<MoveResult> {
    // fetched once here and threaded through every check/write below -
    // isPlayerTurn, getMoveHistory, getDeadPieces, winner, and
    // getGameStats all take this same document, so a single move costs
    // one read here plus the writes below
    const myGame = await getGameById(gid);
    if (!myGame) {
        return { ok: false, reason: 'Game not found.' };
    }

    const isTurn = await isPlayerTurn({ playerName, gid, turn }, myGame);
    if (!isTurn) {
        return { ok: false, reason: 'It is not your turn.' };
    }

    const myBoard = myGame.board;
    const { source, target } = pendingMove;
    const { board: newBoard, deadPieces } = pieceMovement(
        myBoard as Board,
        source,
        target,
        {
            landminesSurvive: myGame.config?.landminesSurvive,
            captureTheFlag: myGame.config?.captureTheFlag,
        },
    );
    if (isEqual(newBoard, myBoard)) {
        return { ok: false, reason: 'No move made.' };
    }

    const newTurn = turn + 1;
    printBoard(newBoard);

    // board, turn, moves, and deadPieces all commit together as one write;
    // updateGame returns the post-write document ({ new: true }), so this
    // also serves as the read-back of the committed state
    const updatedGame = await updateGame(gid, {
        board: newBoard,
        turn: newTurn,
        moves: [...(myGame.moves || []), pendingMove],
        deadPieces: [...(myGame.deadPieces || []), ...deadPieces],
    });
    if (!updatedGame) {
        return { ok: false, reason: 'Game not found after update.' };
    }

    const winnerIndex = await winner(gid, updatedGame);
    const gameStats = await getGameStats(gid, updatedGame);
    if (winnerIndex !== -1) {
        await updateGame(gid, { winnerId: uid || 'anonymous', phase: 3 });
    }

    const fieldMarshallDown = deadPieces
        .filter((piece) => piece.name === 'field_marshall')
        .map((piece) => ({
            playerName: updatedGame.players[piece.affiliation],
            affiliation: piece.affiliation,
        }));

    return {
        ok: true,
        game: updatedGame,
        turn: newTurn,
        fieldMarshallDown,
        deadPieces,
        winnerIndex,
        gameStats,
    };
}

export type SetupResult =
    | { ok: true; complete: false }
    | { ok: true; complete: true; game: IGame }
    | { ok: false; reason: string; errors?: string[] };

/**
 * Validates and stores one player's half-board during the setup/placement
 * phase, merging the two halves once both have been submitted. No
 * socket/io access - reused for both human placements and the AI's
 * generated placement.
 * @see submitInitialBoard
 */
export async function submitInitialBoard(
    gid: string,
    playerName: string,
    myPositions: Board,
): Promise<SetupResult> {
    const myGame = await getGameById(gid);
    if (!myGame) {
        return { ok: false, reason: 'Game not found.' };
    }
    if (myGame.playersSubmittedSetup?.includes(playerName)) {
        return { ok: false, reason: 'You have already submitted your setup.' };
    }
    const playerIndex = myGame.players.indexOf(playerName);
    const submittedSoFar = myGame.playersSubmittedSetup || [];

    if (myGame.board === null) {
        const halfGameBoard =
            playerIndex === 0 ? myPositions : [...myPositions].reverse();
        const [isValid, validationErrorStack] = validateSetup(
            halfGameBoard as unknown as Piece[][],
            !playerIndex,
        );
        if (!isValid) {
            return {
                ok: false,
                reason: 'Invalid setup.',
                errors: validationErrorStack,
            };
        }
        await updateBoard(gid, halfGameBoard);
        await updateGame(gid, {
            playersSubmittedSetup: [...submittedSoFar, playerName],
        });
        return { ok: true, complete: false };
    } else if (myGame.board.length === 6) {
        let completeGameBoard: Board;
        if (playerIndex === 0) {
            completeGameBoard = (myGame.board as unknown as Board).concat(
                myPositions,
            );
        } else {
            completeGameBoard = [...myPositions]
                .reverse()
                .concat(myGame.board as unknown as Board);
        }
        await updateBoard(gid, completeGameBoard);
        await updateGame(gid, {
            phase: 2,
            playersSubmittedSetup: [...submittedSoFar, playerName],
        });
        const updatedGame = await getGameById(gid);
        if (!updatedGame) {
            return { ok: false, reason: 'Game not found after update.' };
        }
        return { ok: true, complete: true, game: updatedGame };
    }
    return { ok: false, reason: 'Unexpected board state.' };
}

/**
 * Picks one of the curated example half-boards at random and submits it
 * through the same path a real guest player's placement would take. The AI
 * always occupies seat 1.
 * @see submitAiInitialBoard
 */
export async function submitAiInitialBoard(gid: string): Promise<SetupResult> {
    const aiHalfBoard = chooseAiExampleHalfBoard(1);
    // submitInitialBoard reverses non-host (playerIndex !== 0) submissions
    // before validating/storing them, since that's what a real guest
    // player's raw submission is expected to look like (see the guest
    // branch below) - pre-reverse here so it round-trips back to the
    // valid board chooseAiExampleHalfBoard actually built.
    const submissionOrientedBoard = [...aiHalfBoard].reverse();
    return submitInitialBoard(gid, AI_PLAYER_NAME, submissionOrientedBoard);
}

/**
 * Emits a game-state event to every connected player (fogged per-player if
 * the game has fog of war enabled and the game is still in progress) and
 * spectator (always unfogged), always sanitized to strip internal identity
 * maps. Skips the AI's sentinel seat.
 * @see broadcastGameState
 */
export async function broadcastGameState(
    io: Server,
    myGame: IGame,
    eventName: string,
) {
    // once the game has ended (phase 3), fog no longer serves its purpose of
    // hiding in-progress strategy - reveal the full board so players can see
    // what the enemy's pieces actually were
    const applyFog = myGame.config.fogOfWar && myGame.phase !== 3;
    myGame.playerToSocketIdMap.forEach(
        (socketId: string, instPlayerName: string) => {
            if (socketId === AI_SOCKET_SENTINEL) {
                return;
            }
            const playerIndex = myGame.players.indexOf(instPlayerName);
            io.to(socketId).emit(
                eventName,
                sanitizeGameForClient(
                    applyFog
                        ? emplaceBoardFog(
                              myGame as unknown as {
                                  board: FoggablePiece[][];
                                  deadPieces: FoggablePiece[];
                              },
                              playerIndex,
                          )
                        : myGame,
                ),
            );
        },
    );
    myGame.spectatorToSocketIdMap.forEach((socketId: string) => {
        io.to(socketId).emit(eventName, sanitizeGameForClient(myGame));
    });
}
