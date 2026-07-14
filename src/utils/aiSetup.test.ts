import { generateRandomValidHalfBoard } from './aiSetup';
import { validateSetup } from './validateSetup';
import { pieces } from './piece';
import { Piece } from './piece';

describe('generateRandomValidHalfBoard', () => {
    test('produces a half-board that passes validateSetup, repeatedly', () => {
        for (let i = 0; i < 25; i += 1) {
            const board = generateRandomValidHalfBoard(1);
            const [isValid, errors] = validateSetup(
                board as unknown as Piece[][],
                false,
            );
            expect(errors).toEqual([]);
            expect(isValid).toBe(true);
        }
    });

    test('places exactly the expected count of each piece', () => {
        const board = generateRandomValidHalfBoard(0);
        const flat = board.flat().filter((p): p is Piece => p !== null);
        Object.entries(pieces).forEach(([name, { count }]) => {
            if (name === 'enemy') {
                return;
            }
            expect(flat.filter((p) => p.name === name)).toHaveLength(count);
        });
    });

    test('assigns every piece the requested affiliation', () => {
        const board = generateRandomValidHalfBoard(1);
        board.flat().forEach((piece) => {
            if (piece) {
                expect(piece.affiliation).toBe(1);
            }
        });
    });

    test('keeps bombs off the frontline row (row 5)', () => {
        for (let i = 0; i < 10; i += 1) {
            const board = generateRandomValidHalfBoard(0);
            board[5].forEach((piece) => {
                expect(piece?.name).not.toBe('bomb');
            });
        }
    });

    // submitInitialBoard (gameplayService.ts) reverses a guest-seat
    // (playerIndex !== 0) submission exactly once before validating it, so
    // whatever is actually sent as `myPositions` must be pre-reversed to
    // cancel that out. Passing the generator's raw output straight through
    // (the bug this guards against) silently fails validation instead.
    test('a single reversal (the real submission, unpatched) fails validateSetup', () => {
        const board = generateRandomValidHalfBoard(1);
        const unpatchedSubmission = [...board].reverse();
        const [isValid] = validateSetup(
            unpatchedSubmission as unknown as Piece[][],
            false,
        );
        expect(isValid).toBe(false);
    });

    test('submitAiInitialBoard pre-reverses so the real submission round-trips to a valid board', () => {
        for (let i = 0; i < 25; i += 1) {
            const board = generateRandomValidHalfBoard(1);
            // mirrors submitAiInitialBoard's pre-reversal
            const patchedSubmission = [...board].reverse().reverse();
            const [isValid, errors] = validateSetup(
                patchedSubmission as unknown as Piece[][],
                false,
            );
            expect(errors).toEqual([]);
            expect(isValid).toBe(true);
        }
    });
});
