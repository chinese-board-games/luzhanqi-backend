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
});
