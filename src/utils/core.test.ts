import { expect, test } from '@jest/globals';
import { isCamp, isHQ } from './core';

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
