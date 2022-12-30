import { Board } from './board';
import { Piece } from './piece';

/**
 * Checks validity of row index
 *
 * @function
 * @param r The row index of a coordinate pair.
 * @see isValidRow
 * @returns Whether the row index is within board bounds.
 */

 export const isValidRow = (r: number): boolean => r >= 0 && r < 12;

 /**
  * Checks validity of column index
  *
  * @function
  * @param {number} c The column index of a coordinate pair.
  * @see isValidCol
  * @returns {boolean} Whether the column index is within board bounds.
  */
 
 export const isValidCol = (c: number): boolean => c >= 0 && c < 5; 

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
            row.push(callback(board[i][j], i, j));
        }
        newBoard.push(row);
    }
    return newBoard;
};

export const isOccupied = (board: Board, r: number, c: number): boolean => {
    if (!isValidRow(r) || !isValidCol(c)) {
        return false;
    }
    return board[r][c] !== null;
};

/**
 * Checks whether the space is a railroad tile.
 *
 * @function
 * @param {number} r The row of the target coordinate pair.
 * @param {number} c The column of the target coordinate pair.
 * @returns {boolean} Whether the space is a railroad tile.
 */

 export const isRailroad = (r: number, c: number): boolean => {
    if (!isValidRow(r) || !isValidCol(c)) {
        return false;
    }
    if (c === 0 || c === 4) {
        return r >= 1 && r <= 10;
    }
    return r === 1 || r === 5 || r === 6 || r === 10;
};
