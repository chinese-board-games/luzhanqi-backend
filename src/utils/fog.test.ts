import { emplaceBoardFog } from './fog';
import { emptyBoard } from './board';
import { createPiece, placePiece } from './piece';
import { Piece } from '../types';

describe('emplaceBoardFog', () => {
    // the board is null before both setup halves are merged, and
    // emplaceBoardFog must handle that without throwing
    test('does not throw when the board is null, and returns it unchanged', () => {
        const game = { board: null, deadPieces: [] };
        expect(() => emplaceBoardFog(game, 0)).not.toThrow();
        const result = emplaceBoardFog(game, 0);
        expect(result.board).toBeNull();
    });

    test('replaces enemy pieces with a generic placeholder', () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 0, createPiece('field_marshall', 1));
        const result = emplaceBoardFog(
            { board: board as unknown as Piece[][], deadPieces: [] },
            0,
        );
        expect(result.board?.[0][0].name).toBe('enemy');
    });

    test('leaves the viewer’s own pieces untouched', () => {
        let board = emptyBoard();
        board = placePiece(board, 0, 0, createPiece('field_marshall', 0));
        const result = emplaceBoardFog(
            { board: board as unknown as Piece[][], deadPieces: [] },
            0,
        );
        expect(result.board?.[0][0].name).toBe('field_marshall');
    });

    test('filters deadPieces down to only the viewer’s own', () => {
        const board = emptyBoard();
        const result = emplaceBoardFog(
            { board: board as unknown as Piece[][], deadPieces: [
                createPiece('captain', 0) as unknown as Piece,
                createPiece('general', 1) as unknown as Piece,
            ] },
            0,
        );
        expect(result.deadPieces).toHaveLength(1);
        expect(result.deadPieces[0].affiliation).toBe(0);
    });
});
