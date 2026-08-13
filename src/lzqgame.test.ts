import { buildEndGamePayload, formatGameStats } from './lzqgame';
import { GameStats } from './services/gameplayService';

describe('formatGameStats', () => {
    // console.log/info's default inspection depth is 2 - gameStats is 3
    // levels deep (remain/lost -> per-player array -> piece-count object) -
    // so formatGameStats must use depth: null to print every level in full
    test('renders nested piece-count objects instead of collapsing them to [Object]', () => {
        const gameStats: GameStats = {
            remain: [
                [{ name: 'flag', count: 1, order: 0 }],
                [{ name: 'captain', count: 3, order: 3 }],
            ],
            lost: [
                [{ name: 'bomb', count: 2, order: -1 }],
                [{ name: 'general', count: 1, order: 8 }],
            ],
        };

        const formatted = formatGameStats(gameStats);

        expect(formatted).not.toContain('[Object]');
        expect(formatted).toContain('flag');
        expect(formatted).toContain('captain');
        expect(formatted).toContain('bomb');
        expect(formatted).toContain('general');
    });

    test('handles a null gameStats without throwing', () => {
        expect(() => formatGameStats(null)).not.toThrow();
        expect(formatGameStats(null)).toBe('null');
    });
});

describe('buildEndGamePayload', () => {
    const board = [[{ name: 'flag', affiliation: 0 }]];
    const game = {
        board,
        players: ['human', 'Computer'],
        phase: 3,
        playerToTokenMap: new Map([['human', 'secret-token']]),
        playerToUidMap: new Map([['human', 'uid-1']]),
        playerToSocketIdMap: new Map([['human', 'socket-1']]),
    };

    // the client only reveals the board when finalGame is present (see
    // GameContext's endGame handler), so every ending has to carry it -
    // including an AI left with no legal moves, which reaches the client
    // as the computer giving up
    test('carries the final board so the client can reveal it', () => {
        const payload = buildEndGamePayload(0, null, game);

        expect(payload.finalGame).toBeDefined();
        expect(payload.finalGame.board).toEqual(board);
        expect(payload.winnerIndex).toBe(0);
    });

    test('strips the credential maps from the revealed game', () => {
        const payload = buildEndGamePayload(1, null, game);

        expect(payload.finalGame).not.toHaveProperty('playerToTokenMap');
        expect(payload.finalGame).not.toHaveProperty('playerToUidMap');
        expect(payload.finalGame).not.toHaveProperty('playerToSocketIdMap');
    });
});
