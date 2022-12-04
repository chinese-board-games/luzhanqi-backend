import { Board, emptyBoard } from './board';
import {
    getSuccessors,
    isValidDestination,
    generateAdjList,
    _getEngineerRailroadMoves,
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

    test('Engineer should be able to visit all railroad tracks as long as there are no obstructions by other pieces', () => {
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

    test('Engineer should be blocked by an enemy piece', () => {
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

    test('Engineer should be blocked by an allied piece', () => {
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
});



describe('generateAdjList', () => {
    const adjList = generateAdjList();
    test('should return a adjacency list', () => {
        expect(adjList instanceof Map).toBe(true);
    });
});

describe('getSuccessors', () => {
    const board: Board = [];
    for (let i = 0; i < 12; i++) {
        board.push(Array(5).fill(null));
    }
    const adjList = generateAdjList();
    test('this should not crash', () => {
        getSuccessors(board, adjList, 0, 0, 0);
    });
});
