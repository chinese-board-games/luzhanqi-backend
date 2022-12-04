import { isCamp, isValidRow, isValidCol, isOccupied, isRailroad } from './core';
import { Board } from './board';


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
): boolean => {
    if (!isValidRow(r) || !isValidCol(c)) {
        return false;
    }
    const debug = board[r][c];
    // you can't move into an occupied camp
    if (isCamp(r, c) && board[r][c] != null) {
        return false;
    }

    // you can't move to a position occupied by your own piece
    if (board[r][c] != null && board[r][c]?.affiliation === affiliation) {
        return false;
    }

    return true;
};

/**
 * The type of an adjacency list.
 *
 * @typedef {Map<string, string[]>} Adjlist
 */
type Adjlist = Map<string, string[]>;

export function _getEngineerRailroadMoves(
    board: Board,
    r: number,
    c: number,
    affiliation: number,
): Set<string> {
    const railroadMoves: Set<string> = new Set();

    if (!isRailroad(r, c)) {
        throw Error(`Position [${r}, ${c}] is not a railroad.`);
    }

    if (board[r][c]?.name !== 'engineer') {
        throw Error(`Position [${r}, ${c}] is not an engineer.`);
    }

    // perform dfs to find availible moves
    const stack = [[r, c]];
    const visited = new Set([JSON.stringify([r, c])]);
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
            // do not explore neighbors of occupied locations
            if (isOccupied(board, curRow, curCol)) {
                continue;
            }
        }

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

export function _getNormalRailroadMoves(
    board: Board,
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
            ? _getEngineerRailroadMoves(board, r, c, affiliation)
            : _getNormalRailroadMoves(board, r, c, affiliation);

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
