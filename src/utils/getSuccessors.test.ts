import { Board } from './board';
import {
    getSuccessors,
    isValidRow,
    isValidCol,
    isRailroad,
    isValidDestination,
    placePiece,
    generateAdjList,
} from './getSuccessors';

import { createPiece } from './piece';

// test row and column validation
test('-1 should not be a valid row index', () =>
    expect(isValidRow(-1)).toBe(false));
test('0 should be a valid row index', () => expect(isValidRow(0)).toBe(true));
test('5 should be a valid row index', () => expect(isValidRow(5)).toBe(true));
test('11 should be a valid row index', () => expect(isValidRow(11)).toBe(true));
test('12 should not be a valid row index', () =>
    expect(isValidRow(12)).toBe(false));

test('-1 should not be a valid column index', () =>
    expect(isValidCol(-1)).toBe(false));
test('0 should be a valid column index', () =>
    expect(isValidCol(0)).toBe(true));
test('4 should be a valid column index', () =>
    expect(isValidCol(4)).toBe(true));
test('5 should be a valid column index', () =>
    expect(isValidCol(5)).toBe(false));

// test isRailroad
const generateRow = (r: number) => [...Array(4).keys()].map((c) => [r, c]);

const topRailCoords = generateRow(1);
test('[1, 0] to [1, 4] should be valid railroad coordinates', () =>
    expect(
        topRailCoords.map(([r, c]) => isRailroad(r, c)).every((v) => v),
    ).toBe(true));

const topMidRailCoords = generateRow(5);
test('[5, 0] to [5, 4] should be valid railroad coordinates', () =>
    expect(
        topMidRailCoords.map(([r, c]) => isRailroad(r, c)).every((v) => v),
    ).toBe(true));

const botMidRailCoords = generateRow(6);
test('[6, 0] to [6, 4] should be valid railroad coordinates', () =>
    expect(
        botMidRailCoords.map(([r, c]) => isRailroad(r, c)).every((v) => v),
    ).toBe(true));

const botRailCoords = generateRow(10);
test('[10, 0] to [10, 4] should be valid railroad coordinates', () =>
    expect(
        botRailCoords.map(([r, c]) => isRailroad(r, c)).every((v) => v),
    ).toBe(true));

const generateCol = (c: number) => [...Array(12).keys()].map((r) => [r, c]);

const leftCol = generateCol(0).slice(1, -1);
test('[0, 1] to [0, 11] should be valid railroad coordinates', () =>
    expect(leftCol.map(([r, c]) => isRailroad(r, c)).every((v) => v)).toBe(
        true,
    ));

const rightCol = generateCol(4).slice(1, -1);
test('[4, 1] to [4, 11] should be valid railroad coordinates', () =>
    expect(rightCol.map(([r, c]) => isRailroad(r, c)).every((v) => v)).toBe(
        true,
    ));

// test isValidDestination
let board: Board = [];
for (let i = 0; i < 12; i++) {
    board.push(Array(5).fill(null));
}

test('out of bound x move [-1, 5] should not be valid', () =>
    expect(isValidDestination(board, -1, 5, 0)).toBe(false));

test('out of bound y move [0, -1] should not be valid', () =>
    expect(isValidDestination(board, 0, -1, 0)).toBe(false));

board = placePiece(board, 0, 0, createPiece('field_marshall', 0));
test('[0, 0] should be an invalid destination for affiliation 0', () =>
    expect(isValidDestination(board, 0, 0, 0)).toBe(false));
test('[0, 0] should be a valid destination for affiliation 1', () =>
    expect(isValidDestination(board, 0, 0, 1)).toBe(true));

// test generateAdjList
const adjList = generateAdjList();
test('should return a adjacency list', () => {
    expect(adjList instanceof Map).toBe(true);
    // console.log(Object.fromEntries(generateAdjList()));
});

// test getSuccessors
test('this should not crash', () => {
    getSuccessors(board, adjList, 0, 0, 0);
});
