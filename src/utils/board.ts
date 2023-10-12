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

// function that prints the board in a readable format
export const printBoard = (board: Board): void => {
    for (let i = 0; i < 12; i++) {
        let row = '';
        // after the sixth row, add the frontier
        if (i === 6) {
            row += ' .... [/\\/\\] .... [/\\/\\] .... \n';
        }
        for (let j = 0; j < 5; j++) {
            // if the row is a camp, surround piece name with brackets
            // otherwise, add a space on either side
            if (isCamp(i, j)) {
                // first four letters of the piece name, capitalized, or '....' if null
                row +=
                    '[' +
                    (board[i][j]?.name.slice(0, 4).toUpperCase() || '----') +
                    ']';
            } else {
                row +=
                    ' ' +
                    (board[i][j]?.name.slice(0, 4).toUpperCase() || '----') +
                    ' ';
            }
        }
        console.info(row);
    }
};
