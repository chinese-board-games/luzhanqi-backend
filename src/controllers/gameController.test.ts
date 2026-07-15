import {
    sanitizeGameForClient,
    generateToken,
    generateJoinCode,
    winnerUnderCaptureTheFlag,
} from './gameController';
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
    test('no winner while both flags are present and untouched', () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 1, createPiece('flag', 0));
        board = placePiece(board, 11, 1, createPiece('flag', 1));

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('no winner while a flag is captured but the carrier has not reached home yet', () => {
        let board = emptyBoard();
        // host's own flag is untouched; guest's flag was captured and is
        // being carried by this piece, which hasn't reached row 0 yet
        board = placePiece(board, 0, 1, createPiece('flag', 0));
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        board = placePiece(board, 5, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('affiliation 0 wins once its carrier reaches row 0 (its own home HQ) with the flag', () => {
        let board = emptyBoard();
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        board = placePiece(board, 0, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(0);
    });

    test('affiliation 1 wins once its carrier reaches row 11 (its own home HQ) with the flag', () => {
        let board = emptyBoard();
        const carrier = createPiece('general', 1);
        carrier.carryingFlag = true;
        board = placePiece(board, 11, 3, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(1);
    });

    test('a carrier merely passing through the enemy half (not its own HQ) does not win', () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 1, createPiece('flag', 0));
        const carrier = createPiece('captain', 0);
        carrier.carryingFlag = true;
        // affiliation 0's home HQ is row 0, not row 11 - this is the
        // opponent's HQ, so simply standing here should not be a win
        board = placePiece(board, 11, 1, carrier);

        expect(winnerUnderCaptureTheFlag(board)).toBe(-1);
    });

    test('a flag destroyed outright (no carrier anywhere) falls back to an instant loss for its owner', () => {
        // affiliation 1's flag is simply missing (e.g. destroyed by a bomb)
        // and nothing on the board is carrying it
        let board = emptyBoard();
        board = placePiece(board, 0, 1, createPiece('flag', 0));

        expect(winnerUnderCaptureTheFlag(board)).toBe(0);
    });
});
