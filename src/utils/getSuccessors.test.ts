import { Board, emptyBoard } from './board';
import {
    getSuccessors,
    isValidDestination,
    generateAdjList,
    _getEngineerRailroadMoves,
    _getNormalRailroadMoves,
    isBlockedPath,
} from './getSuccessors';

import { createPiece, placePiece } from './piece';

describe('isValidDestination', () => {
    let board = emptyBoard();

    beforeEach(() => {
        board = emptyBoard();
    });

    describe('test out of bound destinations', () => {
        test('out of bound x move [-1, 5] should not be valid', () => {
            expect(isValidDestination(board, -1, 5, 0)).toBe(false);
        });
        test('out of bound y move [0, -1] should not be valid', () => {
            expect(isValidDestination(board, 0, -1, 0)).toBe(false);
        });
    });

    describe('test normal position occupation by friendly vs enemy', () => {
        beforeEach(() => {
            board = placePiece(board, 0, 0, createPiece('field_marshall', 0));
        });
        test('[0, 0] should be an invalid destination for affiliation 0 since you cannot attack your own troops', () => {
            expect(isValidDestination(board, 0, 0, 0)).toBe(false);
        });
        test('[0, 0] should be a valid destination for affiliation 1 since you can attack an enemy', () =>
            expect(isValidDestination(board, 0, 0, 1)).toBe(true));
    });

    describe('test camp positions', () => {
        test('[2, 1] should be an invalid destination for affiliation 0 since it is occupied', () => {
            board = placePiece(board, 2, 1, createPiece('bomb', 0));
            expect(isValidDestination(board, 2, 1, 0)).toBe(false);
        });
        test('[2, 1] should be an invalid destination for affiliation 1 since it is occupied', () => {
            board = placePiece(board, 2, 1, createPiece('bomb', 1));
            expect(isValidDestination(board, 2, 1, 1)).toBe(false);
        });
        test('[2, 1] should be a valid destination for affiliation 0 since it is empty', () => {
            expect(isValidDestination(board, 2, 1, 0)).toBe(true);
        });
        test('[2, 1] should be a valid destination for affiliation 1 since it is empty', () => {
            expect(isValidDestination(board, 2, 1, 1)).toBe(true);
        });
    });
});

describe('_getEngineerRailroadMoves', () => {
    let board = emptyBoard();

    beforeEach(() => {
        board = emptyBoard();
    });

    test('engineer should be able to visit all railroad tracks as long as there are no obstructions by other pieces', () => {
        board = placePiece(board, 1, 0, createPiece('engineer', 0));
        const moves = _getEngineerRailroadMoves(board, 1, 0, 0);
        // engineer's own position should not be included
        expect(moves.has(JSON.stringify([1, 0]))).toBe(false);

        // left vertical track (excluding engineer's current position)
        for (let i = 2; i < 11; i++) {
            expect(moves.has(JSON.stringify([i, 0]))).toBe(true);
        }

        // right vertical track (all)
        for (let i = 1; i < 11; i++) {
            expect(moves.has(JSON.stringify([i, 4]))).toBe(true);
        }

        // horizontal track at row 1 (excluding engineer's current position)
        for (let i = 1; i < 5; i++) {
            expect(moves.has(JSON.stringify([1, i]))).toBe(true);
        }

        // horizontal track at row 5 (all)
        for (let i = 0; i < 5; i++) {
            expect(moves.has(JSON.stringify([5, i]))).toBe(true);
        }

        // horizontal track at row 6 (all)
        for (let i = 0; i < 5; i++) {
            expect(moves.has(JSON.stringify([6, i]))).toBe(true);
        }

        // horizontal track at row 10 (all)
        for (let i = 0; i < 5; i++) {
            expect(moves.has(JSON.stringify([10, i]))).toBe(true);
        }
    });

    test('engineer should be blocked by an enemy piece', () => {
        board = placePiece(board, 1, 0, createPiece('engineer', 0));
        board = placePiece(board, 1, 2, createPiece('bomb', 1));
        board = placePiece(board, 1, 4, createPiece('bomb', 1));
        const moves = _getEngineerRailroadMoves(board, 1, 0, 0);

        expect(moves.has(JSON.stringify([1, 0]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 1]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 2]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 3]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 4]))).toBe(true);
        expect(moves.has(JSON.stringify([2, 4]))).toBe(true);
    });

    test('engineer should be blocked by an allied piece', () => {
        board = placePiece(board, 1, 0, createPiece('engineer', 0));
        board = placePiece(board, 1, 2, createPiece('bomb', 0));
        board = placePiece(board, 1, 4, createPiece('bomb', 0));
        const moves = _getEngineerRailroadMoves(board, 1, 0, 0);

        expect(moves.has(JSON.stringify([1, 0]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 1]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 2]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 3]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 4]))).toBe(false);
        expect(moves.has(JSON.stringify([2, 4]))).toBe(true);
    });

    test('path through mountain range should be blocked', () => {
        board = placePiece(board, 5, 1, createPiece('engineer', 0));
        board = placePiece(board, 5, 0, createPiece('bomb', 0));
        board = placePiece(board, 5, 2, createPiece('bomb', 0));
        const moves = _getEngineerRailroadMoves(board, 5, 1, 0);

        expect(moves.has(JSON.stringify([6, 1]))).toBe(false);
    });
});

describe('_getNormalRailroadMoves', () => {
    let board = emptyBoard();

    beforeEach(() => {
        board = emptyBoard();
    });

    test('piece should be able to visit all railroad tracks within a straight line', () => {
        board = placePiece(board, 1, 0, createPiece('bomb', 0));
        const moves = _getNormalRailroadMoves(board, 1, 0, 0);

        // left vertical track (excluding bomb's current position)
        for (let i = 2; i < 11; i++) {
            expect(moves.has(JSON.stringify([i, 0]))).toBe(true);
        }

        // right vertical track (excluding horizontal track at row 1 intersect))
        for (let i = 2; i < 11; i++) {
            expect(moves.has(JSON.stringify([i, 4]))).toBe(false);
        }

        // horizontal track at row 1 (excluding bomb's current position)
        for (let i = 1; i < 5; i++) {
            expect(moves.has(JSON.stringify([1, i]))).toBe(true);
        }

        // horizontal track at row 5 (excluding left veritical track intersect))
        for (let i = 1; i < 5; i++) {
            expect(moves.has(JSON.stringify([5, i]))).toBe(false);
        }

        // horizontal track at row 6 (excluding left veritical track intersect)
        for (let i = 1; i < 5; i++) {
            expect(moves.has(JSON.stringify([6, i]))).toBe(false);
        }

        // horizontal track at row 10 (excluding left veritical track intersect)
        for (let i = 1; i < 5; i++) {
            expect(moves.has(JSON.stringify([10, i]))).toBe(false);
        }
    });

    test('piece should be blocked by an enemy piece', () => {
        board = placePiece(board, 1, 0, createPiece('bomb', 0));
        board = placePiece(board, 1, 2, createPiece('major', 1));
        const moves = _getNormalRailroadMoves(board, 1, 0, 0);

        expect(moves.has(JSON.stringify([1, 0]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 1]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 2]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 3]))).toBe(false);
    });

    test('engineer should be blocked by an allied piece', () => {
        board = placePiece(board, 1, 0, createPiece('bomb', 0));
        board = placePiece(board, 1, 2, createPiece('major', 0));
        const moves = _getNormalRailroadMoves(board, 1, 0, 0);

        expect(moves.has(JSON.stringify([1, 0]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 1]))).toBe(true);
        expect(moves.has(JSON.stringify([1, 2]))).toBe(false);
        expect(moves.has(JSON.stringify([1, 3]))).toBe(false);
    });

    test('path through mountain range should be blocked', () => {
        board = placePiece(board, 5, 1, createPiece('bomb', 0));
        board = placePiece(board, 5, 0, createPiece('major', 0));
        board = placePiece(board, 5, 2, createPiece('major', 0));
        const moves = _getNormalRailroadMoves(board, 5, 1, 0);

        expect(moves.has(JSON.stringify([6, 1]))).toBe(false);
    });

});

describe('isBlockedPath', () => {
    test.each`
        origin    | destination | expected
        ${[5, 1]} | ${[6, 1]}   | ${true}
        ${[6, 1]} | ${[5, 1]}   | ${true}
        ${[5, 3]} | ${[6, 3]}   | ${true}
        ${[6, 3]} | ${[5, 3]}   | ${true}
    `(
        '$origin to $destination should be blocked? $expected',
        ({ origin, destination, expected }) => {
            console.log(origin);
            console.log(destination)
            expect(isBlockedPath(origin, destination)).toBe(expected);
        },
    );
});

describe('generateAdjList', () => {
    const adjList = generateAdjList();

    test.each`
        pair      | expected
        ${[5, 0]} | ${true}
        ${[5, 2]} | ${true}
        ${[4, 1]} | ${true}
        ${[6, 1]} | ${false}
    `(
        '[5, 1] has a connection to $pair should be $expected',
        ({ pair, expected }) => {
            const connections = adjList.get(JSON.stringify([5, 1]));
            expect(connections).toBeInstanceOf(Set);
            expect(connections?.has(JSON.stringify(pair))).toBe(expected);
        },
    );

    test.each`
        pair      | expected
        ${[5, 1]} | ${true}
        ${[4, 1]} | ${true}
        ${[4, 2]} | ${true}
        ${[4, 3]} | ${true}
        ${[5, 3]} | ${true}
        ${[6, 2]} | ${true}
    `(
        '[5, 2] has a connection to $pair should be $expected',
        ({ pair, expected }) => {
            const connections = adjList.get(JSON.stringify([5, 2]));
            expect(connections).toBeInstanceOf(Set);
            expect(connections?.has(JSON.stringify(pair))).toBe(expected);
        },
    );

    test.each`
        pair      | expected
        ${[0, 1]} | ${true}
        ${[1, 0]} | ${true}
        ${[1, 1]} | ${false}
    `(
        '[0, 0] has a connection to $pair should be $expected',
        ({ pair, expected }) => {
            const connections = adjList.get(JSON.stringify([0, 0]));
            expect(connections).toBeInstanceOf(Set);
            expect(connections?.has(JSON.stringify(pair))).toBe(expected);
        },
    );

    test.each`
        pair      | expected
        ${[3, 1]} | ${true}
        ${[2, 1]} | ${true}
        ${[2, 2]} | ${true}
        ${[2, 3]} | ${true}
        ${[3, 3]} | ${true}
        ${[4, 3]} | ${true}
        ${[4, 2]} | ${true}
        ${[4, 1]} | ${true}
        ${[1, 2]} | ${false}
        ${[5, 2]} | ${false}
    `(
        '[3, 2] has a connection to $pair should be $expected',
        ({ pair, expected }) => {
            const connections = adjList.get(JSON.stringify([3, 2]));
            expect(connections).toBeInstanceOf(Set);
            expect(connections?.has(JSON.stringify(pair))).toBe(expected);
        },
    );
});

describe('getSuccessors', () => {
    let board: Board = [];

    beforeEach(() => {
        board = emptyBoard();
    });
    
    test('this should not crash', () => {
        getSuccessors(board, 0, 0, 0);
    });
});
