import { isCamp } from './core';
import { Piece } from './piece';
import { Board } from './board';

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
 * Checks validity of coordinate pair as piece destination
 *
 * @function
 * @param {Board} board The Board object as defined in the backend Schema.
 * @param {number} r The row index of the target coordinate pair.
 * @param {number} c The column index of the target coordinate pair.
 * @param {number} affiliation 0 for host, increments by 1 for additional players.
 * @see isValidDestination
 * @returns {boolean} Whether the target destination is valid.
 */
export const isValidDestination = (
    board: Board,
    r: number,
    c: number,
    affiliation: number,
): boolean =>
    isValidRow(r) &&
    isValidCol(c) &&
    (board[r][c] == null || board[r][c]?.affiliation !== affiliation);

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
        return r > 0 && r < 12;
    }
    return r === 1 || r === 5 || r === 6 || r === 10;
};

/**
 * The type of an adjacency list.
 *
 * @typedef {Map<string, string[]>} Adjlist
 */
type Adjlist = Map<string, string[]>;

function _getEngineerRailroadMoves(
    board: Board,
    adjList: Adjlist,
    r: number,
    c: number,
    affiliation: number,
): Set<string> {
    const railroadMoves: Set<string> = new Set();
    // perform dfs to find availible moves
    const stack = [[r, c]];
    const visited = new Set(JSON.stringify([r, c]));
    const directions = [
        [-1, 0],
        [0, -1],
        [1, 0],
        [0, 1],
    ];

    while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const [curRow, curCol] = stack.pop()!;

        // don't add the first location
        if (!(curRow === r && curCol === c)) {
            railroadMoves.add(JSON.stringify([curRow, curCol]));
            if (isOccupied(board, curRow, curCol)) {
                continue;
            }
        }

        // do not explore neighbors of occupied locations

        // explore neighbors if current loc is unoccupied
        directions.forEach(([incRow, incCol]) => {
            const neighbor = [curRow + incRow, curCol + incCol];
            if (
                !visited.has(JSON.stringify(neighbor)) &&
                isValidDestination(
                    board,
                    neighbor[0],
                    neighbor[1],
                    affiliation,
                ) &&
                isRailroad(neighbor[0], neighbor[1])
            ) {
                visited.add(JSON.stringify(neighbor));
                stack.push(neighbor);
            }
        });
    }

    return railroadMoves;
}

function _getNormalRailroadMoves(
    board: Board,
    adjList: Adjlist,
    r: number,
    c: number,
    affiliation: number,
): Set<string> {
    const railroadMoves: Set<string> = new Set();
    const directions = [
        [-1, 0],
        [0, -1],
        [1, 0],
        [0, 1],
    ];
    directions.forEach((direction) => {
        const [incRow, incCol] = direction;

        let curRow = r + incRow;
        let curCol = c + incCol;
        while (
            isValidDestination(board, curRow, curCol, affiliation) &&
            isRailroad(curRow, curCol)
        ) {
            railroadMoves.add(JSON.stringify([curRow, curCol]));
            if (isOccupied(board, curRow, curCol)) {
                break;
            }
            curRow += incRow;
            curCol += incCol;
        }
    });
    return railroadMoves;
}

/**
 * Gets a list of possible positions the piece at a given coordinate pair can travel to.
 *
 * @param {Board} board The Board object as defined in the backend Schema.
 * @param {number} r The row index of the source coordinate pair.
 * @param {number} c The column index of the source coordinate pair.
 * @param {Adjlist} adjList A Map object representing the graph of duplex tile
 *   connections.
 * @param {number} affiliation 0 for host, increments by 1 for additional players.
 * @see getSuccessors
 * @throws Will throw an error if the board is not 12 by 5 and/or if the source
 *   row/col is out of bounds.
 * @returns {Array} List of positions that the piece may travel to during its turn.
 */
export function getSuccessors(
    board: Board,
    adjList: Adjlist,
    r: number,
    c: number,
    affiliation: number,
): number[][] {
    // validate the board
    if (board.length !== 12) {
        throw 'Invalid number of rows in board';
    }

    if (!board.every((row) => row.length === 5)) {
        throw 'Invalid number of columns in board';
    }

    // validate from
    if (!isValidRow(r)) {
        throw 'Invalid source row index passed';
    }

    if (!isValidCol(c)) {
        throw 'Invalid source column index passed';
    }

    const piece = board[r][c];

    // get the piece type
    if (piece == null || piece.name === 'landmine' || piece.name === 'flag') {
        return [];
    }

    const railroadMoves =
        piece.name === 'engineer'
            ? _getEngineerRailroadMoves(board, adjList, r, c, affiliation)
            : _getNormalRailroadMoves(board, adjList, r, c, affiliation);

    const adjListMoves =
        [...(adjList.get(JSON.stringify([r, c])) || [])]
            ?.map((str) => JSON.parse(str))
            .filter(([r, c]) => isValidDestination(board, r, c, affiliation))
            .map((move) => JSON.stringify(move)) || [];

    const allMovesJson = new Set([
        ...railroadMoves,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        ...adjListMoves,
    ]) as Set<string>;

    const allMoves: number[][] = [...allMovesJson].map((m) => JSON.parse(m));
    return allMoves;
}

/**
 * Generates the adjacency list for a two player Luzhanqi game in the form of a
 * Map object. The generated Map uses the JSON.stringified versions of
 * coordinate arrays because of the way javascript handles the comparison of arrays.
 *
 * @function
 * @see generateAdjList
 * @returns {Map<string, string[]>} Keys are JSON.stringified coordinate array
 *   keys and values are arrays of JSON.stringified coordinates.
 */
export const generateAdjList = (): Map<string, string[]> => {
    // note that the coordinates are stored in a JSON format
    const adjList = new Map();
    for (let originR = 0; originR < 12; originR++) {
        for (let originC = 0; originC < 5; originC++) {
            const connections =
                adjList.get(JSON.stringify([originR, originC])) || new Set();

            // add up/down and left/right connections
            const directions = [
                [-1, 0],
                [0, -1],
                [1, 0],
                [0, 1],
            ];

            if (isCamp(originR, originC)) {
                // add diagonal connections
                directions.push(
                    ...[
                        [-1, -1],
                        [1, -1],
                        [-1, 1],
                        [1, 1],
                    ],
                );
            }

            directions.forEach(([incR, incC]) => {
                const destR = originR + incR;
                const destC = originC + incC;
                if (isValidRow(destR) && isValidCol(destC)) {
                    connections.add(JSON.stringify([destR, destC]));
                    // set reverse direction if center piece
                    if (isCamp(originR, originC)) {
                        if (!adjList.has(JSON.stringify([destR, destC]))) {
                            adjList.set(
                                JSON.stringify([destR, destC]),
                                new Set(),
                            );
                        }
                        adjList
                            .get(JSON.stringify([destR, destC]))
                            .add(JSON.stringify([originR, originC]));
                    }
                }
            });

            adjList.set(JSON.stringify([originR, originC]), connections);
        }
    }
    return adjList;
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
    piece: Piece,
): Board => {
    if (!isValidRow(r) || !isValidCol(c)) {
        throw 'Invalid position passed';
    }
    return board.map((row, i) =>
        row.map((cell, j) => (i === r && j === c ? piece : cell)),
    );
};

const isOccupied = (board: Board, r: number, c: number): boolean => {
    if (!isValidRow(r) || !isValidCol(c)) {
        return false;
    }
    return board[r][c] !== null;
};
