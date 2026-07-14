import { sanitizeGameForClient, generateToken } from './gameController';

describe('generateToken', () => {
    test('produces a non-empty, non-guessable, unique string each call', () => {
        const a = generateToken();
        const b = generateToken();
        expect(a).toEqual(expect.any(String));
        expect(a.length).toBeGreaterThanOrEqual(16);
        expect(a).not.toEqual(b);
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
