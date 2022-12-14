import { expect, test } from '@jest/globals';
import { isCamp, isHQ, isValidRow, isValidCol, isRailroad } from './core';

describe('isCamp', () => {
    test('[2, 1] should be a camp', () => expect(isCamp(2, 1)).toBe(true));
    test('[3, 2] should be a camp', () => expect(isCamp(3, 2)).toBe(true));
    test('[2, 3] should be a camp', () => expect(isCamp(2, 3)).toBe(true));
    test('[4, 1] should be a camp', () => expect(isCamp(4, 1)).toBe(true));
    test('[4, 3] should be a camp', () => expect(isCamp(4, 3)).toBe(true));
    test('[7, 1] should be a camp', () => expect(isCamp(7, 1)).toBe(true));
    test('[7, 3] should be a camp', () => expect(isCamp(7, 3)).toBe(true));
    test('[8, 2] should be a camp', () => expect(isCamp(8, 2)).toBe(true));
    test('[9, 1] should be a camp', () => expect(isCamp(9, 1)).toBe(true));
    test('[9, 3] should be a camp', () => expect(isCamp(9, 3)).toBe(true));
});

describe('isHQ', () => {
    test('[0, 1] should be a HQ', () => expect(isHQ(0, 1)).toBe(true));
    test('[0, 3] should be a HQ', () => expect(isHQ(0, 3)).toBe(true));
    test('[11, 1] should be a HQ', () => expect(isHQ(11, 1)).toBe(true));
    test('[11, 3] should be a HQ', () => expect(isHQ(11, 3)).toBe(true));
});

describe('isValidRow', () => {
    test('-1 should not be a valid row index', () =>
        expect(isValidRow(-1)).toBe(false));
    test('0 should be a valid row index', () =>
        expect(isValidRow(0)).toBe(true));
    test('5 should be a valid row index', () =>
        expect(isValidRow(5)).toBe(true));
    test('11 should be a valid row index', () =>
        expect(isValidRow(11)).toBe(true));
    test('12 should not be a valid row index', () =>
        expect(isValidRow(12)).toBe(false));
});

describe('isValidCol', () => {
    test('-1 should not be a valid column index', () =>
        expect(isValidCol(-1)).toBe(false));
    test('0 should be a valid column index', () =>
        expect(isValidCol(0)).toBe(true));
    test('4 should be a valid column index', () =>
        expect(isValidCol(4)).toBe(true));
    test('5 should be a valid column index', () =>
        expect(isValidCol(5)).toBe(false));
});

describe('isRailroad', () => {
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

    test('[0, 0] to [0, 4] should be invalid railroad coordinates', () => {
        for (let i = 0; i < 5; i++) {
            expect(isRailroad(0, i)).toBe(false);
        }
    });

    test('positions bounded by [2, 1], [2, 3], [4, 1], [4, 3] should be invalid railroad coordinates', () => {
        for (let r = 2; r < 5; r++) {
            for(let c = 1; c < 4; c++) {
                expect(isRailroad(r, c)).toBe(false)
            }
        }
    });

    test('positions bounded by [2, 1], [2, 3], [4, 1], [4, 3] should be invalid railroad coordinates', () => {
        for (let r = 7; r < 10; r++) {
            for(let c = 1; c < 4; c++) {
                expect(isRailroad(r, c)).toBe(false)
            }
        }
    });

    test('[11, 0] to [11, 4] should be invalid railroad coordinates', () => {
        for (let i = 0; i < 5; i++) {
            expect(isRailroad(11, i)).toBe(false);
        }
    });
});
