import { pieces, Piece } from './piece';
import { isHQ, isCamp, iterBoard } from './core';

/**
 * The complete type of a game piece.
 *
 * @typedef {Object} Piece
 * @property {string} name
 * @property {number} affiliation
 * @property {number} order
 * @property {number} kills
 */

/**
 * Validates that a set up half board of pieces follows all of the game rules.
 * Used for the beginning of games.
 *
 * @function
 * @param {Piece[][]} halfBoard A 6 by 5 two dimensional array of pieces.
 * @param {boolean} isHostHalf States if the half board the bottom or top half.
 * @see validateSetup
 * @returns {boolean} Whether the half board is valid or not.
 */
export function validateSetup(
    halfBoard: Piece[][],
    isHostHalf: boolean,
): [boolean, string[]] {
    const errors = [];
    // flip the board if neccessary
    if (isHostHalf) {
        halfBoard = [...halfBoard].reverse();
    }

    // validate shape
    if (halfBoard.length != 6) {
        errors.push('The board must be 6 by 5.');
    }

    for (const row of halfBoard) {
        if (row.length != 5) {
            errors.push('The board must be 6 by 5.');
        }
    }

    const pieceCount = (name: string) => {
        return halfBoard.flat().filter((p: Piece) => p?.name === name).length;
    };

    // validate piece counts
    for (const [k, v] of Object.entries(pieces)) {
        if (v.count !== pieceCount(k)) {
            errors.push(`There must be ${v.count} ${k}s.`);
        }
    }

    // validate camps are empty and non-camp positions are filled
    iterBoard(halfBoard, (piece, r, c) => {
        if (
            (isCamp(r, c) && piece != null) ||
            (!isCamp(r, c) && piece == null)
        ) {
            errors.push('Camps must be empty and non-camps must be filled.');
        }
    });

    // validate the flag is in HQ
    iterBoard(halfBoard, (piece, r, c) => {
        if (piece && piece.name == 'flag' && !isHQ(r, c)) {
            errors.push('The flag must be in the HQ.');
        }
    });

    // validate landmine is in bottom two rows
    iterBoard(halfBoard, (piece, r) => {
        if (piece && piece.name == 'landmine' && r >= 4) {
            errors.push('Landmines must be in the bottom two rows.');
        }
    });

    // validate bomb is not in the top row
    iterBoard(halfBoard, (piece, r) => {
        if (piece && piece.name == 'bomb' && r == 5) {
            errors.push('Bombs cannot be in the top row.');
        }
    });

    return [!errors.length, errors];
}
