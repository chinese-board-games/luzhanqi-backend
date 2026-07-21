import {
    sanitizeGameForClient,
    generateToken,
    generateJoinCode,
    winner,
    winnerUnderCaptureTheFlag,
} from './gameController';
import { pieceMovement } from '../services/gameplayService';
import { emptyBoard } from '../utils/board';
import { createPiece, placePiece } from '../utils/piece';

describe('generateToken', () => {
    test('produces a non-empty, non-guessable, unique string each call', () => {
        const a = generateToken();
        const b = generateToken();
        expect(a).toEqual(expect.any(String));
        expect(a.length).toBeGreaterThanOrEqual(16);
        expect(a).not.toEqual(b);
    });
});

describe('generateJoinCode', () => {
    test('produces a 6-character code using only unambiguous characters', () => {
        const code = generateJoinCode();
        expect(code).toHaveLength(6);
        expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
        // visually-confusable characters must never appear
        expect(code).not.toMatch(/[0O1IL]/);
    });

    test('is not deterministic', () => {
        const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
        expect(codes.size).toBeGreaterThan(1);
    });
});

describe('sanitizeGameForClient', () => {
    const rawGame = {
        room: 'abc',
        players: ['host', 'guest'],
        playerToSocketIdMap: new Map([['host', 'socket-1']]),
        playerToUidMap: new Map([['host', 'uid-1']]),
        playerToTokenMap: new Map([['host', 'super-secret-token']]),
        spectatorToUidMap: new Map(),
        spectatorToSocketIdMap: new Map(),
        turn: 0,
        board: null,
    };

    test('strips internal identity maps from a plain object', () => {
        const sanitized = sanitizeGameForClient(rawGame);
        expect(sanitized.playerToTokenMap).toBeUndefined();
        expect(sanitized.playerToUidMap).toBeUndefined();
        expect(sanitized.playerToSocketIdMap).toBeUndefined();
        expect(sanitized.spectatorToUidMap).toBeUndefined();
        expect(sanitized.spectatorToSocketIdMap).toBeUndefined();
        // safe fields survive
        expect(sanitized.room).toBe('abc');
        expect(sanitized.players).toEqual(['host', 'guest']);
    });

    test('strips internal identity maps from a Mongoose-document-like object', () => {
        const doc = {
            toObject: () => rawGame,
        };
        const sanitized = sanitizeGameForClient(doc);
        expect(sanitized.playerToTokenMap).toBeUndefined();
        expect(sanitized.room).toBe('abc');
    });

    test('never leaks a reconnection token under any key', () => {
        const sanitized = sanitizeGameForClient(rawGame);
        expect(JSON.stringify(sanitized)).not.toContain('super-secret-token');
    });
});

describe('winnerUnderCaptureTheFlag', () => {
    // host (affiliation 0) occupies the bottom half of the merged board
    // (HQ at row 11); the guest (affiliation 1) occupies the top half
    // (HQ at row 0) - see submitInitialBoard's merge order

    test('no winner while both flags are present and untouched', () => {
        let board = emptyBoard();
        board = placePiece(board, 11, 1, createPiece('flag', 0));
        board = placePiece(board, 0, 1, createPiece('flag', 1));

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('no winner while a flag is captured but the carrier has not reached home yet', () => {
        let board = emptyBoard();
        // host's own flag is untouched; guest's flag was captured and is
        // being carried by this piece, which hasn't reached row 11 yet
        board = placePiece(board, 11, 1, createPiece('flag', 0));
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        board = placePiece(board, 5, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('affiliation 0 wins once its carrier reaches row 11 (its own home HQ) with the flag', () => {
        let board = emptyBoard();
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        board = placePiece(board, 11, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(0);
    });

    test('affiliation 1 wins once its carrier reaches row 0 (its own home HQ) with the flag', () => {
        let board = emptyBoard();
        const carrier = createPiece('general', 1);
        carrier.carryingFlag = true;
        board = placePiece(board, 0, 3, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(1);
    });

    test('a carrier merely passing through the enemy half (not its own HQ) does not win', () => {
        let board = emptyBoard();
        board = placePiece(board, 11, 1, createPiece('flag', 0));
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        // affiliation 0's home HQ is row 11, not row 0 - this is the
        // opponent's HQ (exactly where it captured the flag from), so
        // simply standing here should not be a win
        board = placePiece(board, 0, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('a flag destroyed outright (no carrier anywhere) falls back to an instant loss for its owner', () => {
        // affiliation 1's flag is simply missing (e.g. destroyed by a bomb)
        // and nothing on the board is carrying it
        let board = emptyBoard();
        board = placePiece(board, 0, 1, createPiece('flag', 0));

        expect(winnerUnderCaptureTheFlag(board)).toBe(0);
    });

    // regression test for a real bug: the side that killed a flag carrier
    // was being declared the loser, because the carrier's own opponent's
    // home HQ cells happened to already be full (the normal case at the
    // start of a game), so the flag failed to respawn and the instant-loss
    // fallback (meant only for a flag destroyed outright, pre-capture)
    // fired incorrectly instead.
    test('killing a flag carrier does not end the game, even when the flag owner has no free HQ cell', () => {
        let board = emptyBoard();
        // host's own flag is untouched at its home HQ
        board = placePiece(board, 11, 1, createPiece('flag', 0));
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        board = placePiece(board, 6, 0, carrier);
        board = placePiece(board, 0, 1, createPiece('landmine', 1));
        board = placePiece(board, 0, 3, createPiece('landmine', 1));
        board = placePiece(board, 7, 0, createPiece('general', 1));

        // affiliation 1 kills affiliation 0's carrier
        const { board: newBoard } = pieceMovement(board, [6, 0], [7, 0], {
            captureTheFlag: true,
        });

        expect(winnerUnderCaptureTheFlag(newBoard)).toBe(-1);
    });
});

describe('winner (default, non-captureTheFlag rules)', () => {
    // host (affiliation 0) occupies the bottom half of the merged board
    // (HQ at row 11); the guest (affiliation 1) occupies the top half
    // (HQ at row 0) - see submitInitialBoard's merge order. A flag can
    // legally sit on any row of its owner's half, not just the row
    // nearest that half's own edge of the board - these boards place
    // filler pieces in the rows ahead of each flag so a scan actually
    // encounters other pieces first, the same as a real, mostly-full
    // game board would.
    const asPreloadedGame = (board: unknown, extra: Record<string, unknown> = {}) =>
        ({ board, config: {}, ...extra } as any);

    test('no winner while both flags are present, several rows deep in their own half', async () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 0, createPiece('captain', 1));
        board = placePiece(board, 1, 0, createPiece('captain', 1));
        board = placePiece(board, 3, 3, createPiece('flag', 1));
        board = placePiece(board, 6, 0, createPiece('captain', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 0));
        board = placePiece(board, 8, 1, createPiece('flag', 0));

        expect(await winner('unused', asPreloadedGame(board))).toBe(-1);
    });

    test('host wins when only the guest half is missing its flag', async () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 0, createPiece('captain', 1));
        board = placePiece(board, 1, 0, createPiece('captain', 1));
        board = placePiece(board, 8, 1, createPiece('flag', 0));

        expect(await winner('unused', asPreloadedGame(board))).toBe(0);
    });

    test('guest wins when only the host half is missing its flag', async () => {
        let board = emptyBoard();
        board = placePiece(board, 3, 3, createPiece('flag', 1));
        board = placePiece(board, 6, 0, createPiece('captain', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 0));

        expect(await winner('unused', asPreloadedGame(board))).toBe(1);
    });

    // regression coverage for chinese-board-games/luzhanqi-backend#111: a
    // player down to only immobile pieces (or otherwise boxed in) on their
    // own turn was never declared the loser - the game just stalled,
    // forcing a manual forfeit. runAiTurn already special-cased this for
    // the AI; these confirm winner() now catches it generically, for both
    // human players and the AI.
    test('the guest loses on their own turn once only immobile pieces remain, even with both flags present', async () => {
        let board = emptyBoard();
        board = placePiece(board, 8, 1, createPiece('flag', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 0));
        board = placePiece(board, 3, 3, createPiece('flag', 1));
        board = placePiece(board, 2, 1, createPiece('landmine', 1));

        // turn 1 -> turn % 2 === 1 -> it's the guest's (affiliation 1) turn
        expect(await winner('unused', asPreloadedGame(board, { turn: 1 }))).toBe(0);
    });

    test('is not decided by stalemate when it is the other player\'s turn', async () => {
        let board = emptyBoard();
        board = placePiece(board, 8, 1, createPiece('flag', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 0));
        board = placePiece(board, 3, 3, createPiece('flag', 1));
        board = placePiece(board, 2, 1, createPiece('landmine', 1));

        // turn 0 -> it's the host's turn, and the host (who still has a
        // mobile captain) is not the one who's stuck
        expect(await winner('unused', asPreloadedGame(board, { turn: 0 }))).toBe(-1);
    });

    test('stalemate applies under the captureTheFlag variant too', async () => {
        let board = emptyBoard();
        board = placePiece(board, 8, 1, createPiece('flag', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 0));
        board = placePiece(board, 3, 3, createPiece('flag', 1));
        board = placePiece(board, 2, 1, createPiece('landmine', 1));

        const game = asPreloadedGame(board, {
            turn: 1,
            config: { captureTheFlag: true },
        });
        expect(await winner('unused', game)).toBe(0);
    });
});
