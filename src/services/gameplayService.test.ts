import { pieceMovement } from './gameplayService';
import { emptyBoard } from '../utils/board';
import { createPiece, placePiece } from '../utils/piece';

describe('pieceMovement', () => {
    test('a quiet move onto an empty tile does not mark the moving piece dead', () => {
        let board = emptyBoard();
        board = placePiece(board, 6, 0, createPiece('engineer', 0));

        const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0]);

        expect(deadPieces).toEqual([]);
        expect(newBoard[7][0]).toMatchObject({ name: 'engineer', affiliation: 0 });
        expect(newBoard[6][0]).toBeNull();
    });

    test('capturing a weaker piece marks only the captured piece dead, not the winner', () => {
        let board = emptyBoard();
        board = placePiece(board, 6, 0, createPiece('general', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 1));

        const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0]);

        expect(deadPieces).toEqual([expect.objectContaining({ name: 'captain', affiliation: 1 })]);
        expect(newBoard[7][0]).toMatchObject({ name: 'general', affiliation: 0 });
        expect(newBoard[6][0]).toBeNull();
    });

    test('attacking a stronger piece marks only the attacker dead', () => {
        let board = emptyBoard();
        board = placePiece(board, 6, 0, createPiece('captain', 0));
        board = placePiece(board, 7, 0, createPiece('general', 1));

        const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0]);

        expect(deadPieces).toEqual([expect.objectContaining({ name: 'captain', affiliation: 0 })]);
        expect(newBoard[7][0]).toMatchObject({ name: 'general', affiliation: 1 });
        expect(newBoard[6][0]).toBeNull();
    });

    test('same-name pieces mutually destroy each other', () => {
        let board = emptyBoard();
        board = placePiece(board, 6, 0, createPiece('captain', 0));
        board = placePiece(board, 7, 0, createPiece('captain', 1));

        const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0]);

        expect(deadPieces).toHaveLength(2);
        expect(newBoard[7][0]).toBeNull();
        expect(newBoard[6][0]).toBeNull();
    });

    describe('landminesSurvive rule variant', () => {
        test('default (off): a non-Engineer attacking a landmine destroys both', () => {
            let board = emptyBoard();
            board = placePiece(board, 6, 0, createPiece('captain', 0));
            board = placePiece(board, 7, 0, createPiece('landmine', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0]);

            expect(deadPieces).toHaveLength(2);
            expect(newBoard[7][0]).toBeNull();
            expect(newBoard[6][0]).toBeNull();
        });

        test('on: a non-Engineer attacking a landmine dies alone, mine stays', () => {
            let board = emptyBoard();
            board = placePiece(board, 6, 0, createPiece('captain', 0));
            board = placePiece(board, 7, 0, createPiece('landmine', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0], {
                landminesSurvive: true,
            });

            expect(deadPieces).toEqual([
                expect.objectContaining({ name: 'captain', affiliation: 0 }),
            ]);
            expect(newBoard[6][0]).toBeNull();
            expect(newBoard[7][0]).toMatchObject({ name: 'landmine', affiliation: 1 });
        });

        test('an Engineer always safely defuses a landmine regardless of the setting', () => {
            let board = emptyBoard();
            board = placePiece(board, 6, 0, createPiece('engineer', 0));
            board = placePiece(board, 7, 0, createPiece('landmine', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0], {
                landminesSurvive: true,
            });

            expect(deadPieces).toEqual([
                expect.objectContaining({ name: 'landmine', affiliation: 1 }),
            ]);
            expect(newBoard[7][0]).toMatchObject({ name: 'engineer', affiliation: 0 });
            expect(newBoard[6][0]).toBeNull();
        });
    });

    describe('captureTheFlag rule variant', () => {
        test('capturing the flag marks the capturer as carrying it, board keeps the piece alive', () => {
            let board = emptyBoard();
            board = placePiece(board, 1, 1, createPiece('captain', 0));
            board = placePiece(board, 0, 1, createPiece('flag', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [1, 1], [0, 1], {
                captureTheFlag: true,
            });

            expect(deadPieces).toEqual([
                expect.objectContaining({ name: 'flag', affiliation: 1 }),
            ]);
            expect(newBoard[0][1]).toMatchObject({
                name: 'captain',
                affiliation: 0,
                carryingFlag: true,
            });
        });

        test('if the carrier is later destroyed in a mutual trade, the flag respawns at its home HQ', () => {
            let board = emptyBoard();
            const carrier = createPiece('captain', 0);
            carrier.carryingFlag = true;
            board = placePiece(board, 6, 0, carrier);
            board = placePiece(board, 7, 0, createPiece('captain', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0], {
                captureTheFlag: true,
            });

            expect(deadPieces.some((p) => p.carryingFlag)).toBe(true);
            // carrier was affiliation 0, so the respawned flag belongs to
            // affiliation 1 (whoever originally owned it) at its home HQ (row 11)
            expect(newBoard[11][1]).toMatchObject({ name: 'flag', affiliation: 1 });
        });

        test('if the carrier loses a fight, the flag respawns at its home HQ', () => {
            let board = emptyBoard();
            const carrier = createPiece('captain', 0);
            carrier.carryingFlag = true;
            board = placePiece(board, 6, 0, carrier);
            board = placePiece(board, 7, 0, createPiece('general', 1));

            const { board: newBoard, deadPieces } = pieceMovement(board, [6, 0], [7, 0], {
                captureTheFlag: true,
            });

            expect(deadPieces).toEqual([
                expect.objectContaining({ name: 'captain', affiliation: 0, carryingFlag: true }),
            ]);
            expect(newBoard[11][1]).toMatchObject({ name: 'flag', affiliation: 1 });
        });

        test('without captureTheFlag, a captured flag simply disappears (default behavior unchanged)', () => {
            let board = emptyBoard();
            board = placePiece(board, 1, 1, createPiece('captain', 0));
            board = placePiece(board, 0, 1, createPiece('flag', 1));

            const { board: newBoard } = pieceMovement(board, [1, 1], [0, 1]);

            expect(newBoard[0][1]).toMatchObject({ name: 'captain', affiliation: 0 });
            expect(newBoard[0][1]?.carryingFlag).toBeUndefined();
        });
    });
});
