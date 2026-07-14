import { chooseAiMove } from './aiPlayer';
import { getSuccessors } from './getSuccessors';
import { emptyBoard, Board } from './board';
import { createPiece, placePiece } from './piece';

describe('chooseAiMove', () => {
    test('returns null when the AI has no pieces on the board', () => {
        const board = emptyBoard();
        expect(chooseAiMove(board, 0)).toBeNull();
    });

    test('always returns a move that getSuccessors considers legal', () => {
        let board = emptyBoard();
        board = placePiece(board, 6, 0, createPiece('captain', 0));
        board = placePiece(board, 6, 4, createPiece('major', 0));
        board = placePiece(board, 5, 0, createPiece('enemy', 1));
        board = placePiece(board, 0, 1, createPiece('field_marshall', 1));

        for (let i = 0; i < 15; i += 1) {
            const move = chooseAiMove(board, 0);
            expect(move).not.toBeNull();
            if (!move) {
                return;
            }
            const legalDestinations = getSuccessors(
                board,
                move.source[0],
                move.source[1],
                0,
            );
            expect(
                legalDestinations.some(
                    ([r, c]) => r === move.target[0] && c === move.target[1],
                ),
            ).toBe(true);
        }
    });

    test('prefers a clearly winning capture over a losing attack or a quiet move', () => {
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        try {
            let board: Board = emptyBoard();
            // our piece, free to move onto either neighbor or stay put
            board = placePiece(board, 5, 2, createPiece('general', 0));
            // a clearly-losing attack: enemy field marshall outranks us
            board = placePiece(board, 6, 2, createPiece('field_marshall', 1));
            // a clean, known-identity capture: engineer is far weaker
            board = placePiece(board, 4, 2, createPiece('engineer', 1));

            const move = chooseAiMove(board, 0);
            expect(move).toEqual({ source: [5, 2], target: [4, 2] });
        } finally {
            randomSpy.mockRestore();
        }
    });
});
