import { Board } from "./board";
import { isValidRow, isValidCol } from "./core";

/** An object containing basic game information for each piece type. */
export const pieces: Record<string, { count: number, order: number}> = {
    bomb: { count: 2, order: -1 },
    brigadier_general: { count: 2, order: 6 },
    captain: { count: 3, order: 3 },
    colonel: { count: 2, order: 5 },
    engineer: { count: 3, order: 1 },
    field_marshall: { count: 1, order: 9 },
    flag: { count: 1, order: 0 },
    general: { count: 1, order: 8 },
    landmine: { count: 3, order: -1 },
    lieutenant: { count: 3, order: 2 },
    major_general: { count: 2, order: 7 },
    major: { count: 2, order: 4 },
    enemy: { count: 0, order: -1 }
};

export interface Piece {
    name: string
    affiliation: number
    order: number
    kills: number
}

/**
 * Initializes and returns a new piece object.
 *
 * @function
 * @param  name The name of the piece, should be a key in pieces object.
 * @param  affiliation 0 for host, increments by 1 for additional players.
 * @returns A new Piece object.
 */
export const createPiece = (name: string, affiliation: number): Piece => {
    if (!pieces[name]) {
        throw Error('Invalid piece name provided');
    }
    return {
        name,
        affiliation,
        order: pieces[name].order,
        kills: 0,
    };
};

/**
 * Returns a new board with the placed piece.
 *
 * @function
 * @param {Board} board The Board object as defined in the backend Schema.
 * @param {number} r The row of the target coordinate pair.
 * @param {number} c The column of the target coordinate pair.
 * @param {Piece} piece A Piece object as defined in Piece.js.
 * @see placePiece
 * @returns {Board} A new board with the placed piece.
 */
 export const placePiece = (
    board: Board,
    r: number,
    c: number,
    piece: Piece | null,
): Board => {
    if (!isValidRow(r) || !isValidCol(c)) {
        throw Error('Invalid position passed');
    }
    return board.map((row, i) =>
        row.map((cell, j) => (i === r && j === c ? piece : cell)),
    );
};
