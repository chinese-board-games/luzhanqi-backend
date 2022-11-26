const { pieces } = require('./piece');
const { isHQ, isCamp, iterBoard } = require('./core');

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
 * @param {boolean} isBottomHalf States if the half board the bottom or top half.
 * @see validateSetup
 * @returns {boolean} Whether the half board is valid or not.
 */
export function validateSetup(halfBoard, isBottomHalf = true) {
    // flip the board of neccessary
    if (!isBottomHalf) {
        halfBoard = [...halfBoard].reverse();
    }

    // validate shape
    if (halfBoard.length != 6) {
        return false;
    }

    for (const row of halfBoard) {
        if (row.length != 5) {
            return false;
        }
    }

    const pieceCount = (name) => {
        return halfBoard.filter((p) => p.name === name).length;
    };

    // validate piece counts
    for (const [k, v] of Object.entries(pieces)) {
        if (v.count !== pieceCount(k)) {
            return false;
        }
    }

    // validate camps are empty and non-camp positions are filled
    iterBoard(halfBoard, (piece, r, c) => {
        if (
            (isCamp(r, c) && piece != null) ||
            (!isCamp(r, c) && piece == null)
        ) {
            return false;
        }
    });

    // validate the flag is in HQ
    iterBoard(halfBoard, (piece, r, c) => {
        if (piece && piece.name == 'flag' && !isHQ(r, c)) {
            return false;
        }
    });

    // validate landmine is in bottom two rows
    iterBoard(halfBoard, (piece, r) => {
        if (piece && piece.name == 'landmine' && r < 4) {
            return false;
        }
    });

    // validate bomb is not in the top row
    iterBoard(halfBoard, (piece, r) => {
        if (piece && piece.name == 'bomb' && r == 0) {
            return false;
        }
    });
}
