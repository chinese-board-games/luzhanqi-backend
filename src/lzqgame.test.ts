import { formatGameStats } from './lzqgame';
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
