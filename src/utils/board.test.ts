import { printBoard, emptyBoard, Board } from './board';

describe('printBoard', () => {
    test('handles a full 12-row board without throwing', () => {
        expect(() => printBoard(emptyBoard())).not.toThrow();
    });

    // a setup-phase board is only 6 rows until both players have submitted
    // their half (see gameplayService.submitInitialBoard) - printBoard used
    // to assume a full 12x5 grid and crashed reading row 6 of a 6-row board
    test('handles a partial 6-row board without throwing', () => {
        const halfBoard: Board = emptyBoard().slice(0, 6);
        expect(() => printBoard(halfBoard)).not.toThrow();
    });
});
