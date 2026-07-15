import {
    exampleBoards,
    buildExampleHalfBoard,
    chooseAiExampleHalfBoard,
} from './exampleBoards';
import { validateSetup } from './validateSetup';
import { pieces, Piece } from './piece';

describe('buildExampleHalfBoard', () => {
    test('every curated example passes validateSetup', () => {
        exampleBoards.forEach((_, index) => {
            const board = buildExampleHalfBoard(index, 0);
            const [isValid, errors] = validateSetup(
                board as unknown as Piece[][],
                false,
            );
            expect(errors).toEqual([]);
            expect(isValid).toBe(true);
        });
    });

    test('every curated example places exactly the expected count of each piece', () => {
        exampleBoards.forEach((_, index) => {
            const board = buildExampleHalfBoard(index, 0);
            const flat = board.flat().filter((p): p is Piece => p !== null);
            Object.entries(pieces).forEach(([name, { count }]) => {
                if (name === 'enemy') {
                    return;
                }
                expect(flat.filter((p) => p.name === name)).toHaveLength(count);
            });
        });
    });

    test('assigns every piece the requested affiliation', () => {
        const board = buildExampleHalfBoard(0, 1);
        board.flat().forEach((piece) => {
            if (piece) {
                expect(piece.affiliation).toBe(1);
            }
        });
    });

    test('a single reversal (the real submission, unpatched) fails validateSetup', () => {
        const board = buildExampleHalfBoard(0, 1);
        const unpatchedSubmission = [...board].reverse();
        const [isValid] = validateSetup(
            unpatchedSubmission as unknown as Piece[][],
            false,
        );
        expect(isValid).toBe(false);
    });
});

describe('chooseAiExampleHalfBoard', () => {
    test('always returns a valid board for one of the curated examples', () => {
        for (let i = 0; i < 25; i += 1) {
            const board = chooseAiExampleHalfBoard(1);
            const [isValid, errors] = validateSetup(
                board as unknown as Piece[][],
                false,
            );
            expect(errors).toEqual([]);
            expect(isValid).toBe(true);
        }
    });
});
