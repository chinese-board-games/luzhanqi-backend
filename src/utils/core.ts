import { Board } from './board';
import { Piece } from './piece';

/**
 * Checks whether a given space is a camp tile.
 *
 * @function
 * @param {number} r The row index of the target coordinate pair.
 * @param {number} c The column index of the target coordinate pair.
 * @see isCamp
 * @returns {boolean} Whether the tile is a camp.
 */
export const isCamp = (r: number, c: number): boolean =>
    ((c === 1 || c === 3) && (r === 2 || r === 4 || r === 7 || r === 9)) ||
    (c === 2 && (r === 3 || r === 8));

/**
 * Checks whether a given space is a HQ tile.
 *
 * @function
 * @param {number} r The row index of the target coordinate pair.
 * @param {number} c The column index of the target coordinate pair.
 * @see isHQ
 * @returns {boolean} Whether the tile is a HQ.
 */
export const isHQ = (r: number, c: number): boolean =>
    (c == 1 || c == 3) && (r == 0 || r == 11);

/**
 * Callback to be passed to iterBoard and mapBoard.
 *
 * @callback utilCallback
 * @param {Board} board A two dimension array of Piece objects.
 * @param {r} row The row index.
 * @param {c} column The column index.
 */
type utilCallback = (value: Piece | null, i: number, j: number) => Piece | null;
type utilIterCallback = (value: Piece | null, i: number, j: number) => unknown

/**
 * Iterates through a board array and applies a callback function to each
 * piece. Equivalent to calling `forEach` on an array.
 *
 * @function
 * @param {Board} board The gameboard.
 * @param {utilCallback} callback The callback function to be applied to each piece.
 * @see iterBoard
 */
export const iterBoard = (board: Board, callback: utilIterCallback) => {
    for (let i = 0; i < board.length; i++) {
        for (let j = 0; j < board[i].length; j++) {
            callback(board[i][j], i, j);
        }
    }
};

/**
 * Maps through a board array and returns the result of the application of the
 * callback function to each piece. Equivalent to calling `map` on an array.
 *
 * @function
 * @param {Board} board The gameboard.
 * @param {utilCallback} callback The callback function to be applied to each piece.
 * @returns {Board} The result of applying the callback to each piece in the board.
 */
export const mapBoard = (board: Board, callback: utilCallback): Board => {
    const newBoard: Board = [];
    for (let i = 0; i < board.length; i++) {
        const row: (Piece | null)[] = [];
        for (let j = 0; j < board[i].length; j++) {
            row.push(callback(board[j][i], j, i));
        }
        newBoard.push(row);
    }
    return newBoard;
};
