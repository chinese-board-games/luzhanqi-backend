import { Piece } from './piece';
import { isCamp } from './core';

/**
 * A 12 by 5 two dimensional array of Piece objects.
 */
export type Board = (Piece | null)[][];

/**
 *
 * @returns An empty 12 by 5 board.
 */
export const emptyBoard = (): Board => {
    const board: Board = [];
    for (let i = 0; i < 12; i++) {
        board.push(Array(5).fill(null));
    }
    return board;
};

// function that prints the board in a readable format. Iterates the
// board's actual dimensions rather than assuming a full 12x5 grid, since
// a half-submitted setup board (see gameplayService.submitInitialBoard)
// only has 6 rows until both players have placed their pieces.
export const printBoard = (board: Board): void => {
    board.forEach((boardRow, i) => {
        let row = '';
        // after the sixth row, add the frontier
        if (i === 6) {
            row += ' .... [/\\/\\] .... [/\\/\\] .... \n';
        }
        boardRow.forEach((piece, j) => {
            // first four letters of the piece name, capitalized, or '....' if null
            const label = piece?.name.slice(0, 4).toUpperCase() || '----';
            // if the row is a camp, surround piece name with brackets
            // otherwise, add a space on either side
            row += isCamp(i, j) ? `[${label}]` : ` ${label} `;
        });
        console.info(row);
    });
};
