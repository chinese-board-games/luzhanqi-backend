import { createPiece } from './piece';
import { validateSetup } from './validateSetup';
import { Board } from './board';

/**
 * Curated, rule-legal half-board layouts (kept in sync with
 * luzhanqi-web's src/data/exampleBoards.js). Row 0 is the frontline, row 5
 * is the HQ row - the orientation a human sees while editing their board.
 * 'none' marks the five camp cells, which must stay empty.
 */
export const exampleBoards: string[][][] = [
  // Example 1
  [
    ['major_general', 'lieutenant', 'colonel', 'engineer', 'major_general'],
    ['engineer', 'none', 'field_marshall', 'none', 'engineer'],
    ['colonel', 'lieutenant', 'none', 'bomb', 'major'],
    ['brigadier_general', 'none', 'brigadier_general', 'none', 'lieutenant'],
    ['bomb', 'landmine', 'general', 'captain', 'captain'],
    ['landmine', 'flag', 'major', 'landmine', 'captain'],
  ],
  // Example 2 - fortress: strong pieces and landmines massed around a col-3 flag
  [
    ['lieutenant', 'captain', 'colonel', 'captain', 'lieutenant'],
    ['engineer', 'none', 'major_general', 'none', 'engineer'],
    ['brigadier_general', 'major', 'none', 'captain', 'brigadier_general'],
    ['colonel', 'none', 'general', 'none', 'engineer'],
    ['bomb', 'landmine', 'major_general', 'lieutenant', 'bomb'],
    ['landmine', 'major', 'field_marshall', 'flag', 'landmine'],
  ],
  // Example 3 - flanks: defense spread across both sides with a col-1 flag
  [
    ['captain', 'lieutenant', 'colonel', 'lieutenant', 'captain'],
    ['engineer', 'none', 'general', 'none', 'engineer'],
    ['major', 'brigadier_general', 'none', 'brigadier_general', 'major'],
    ['engineer', 'none', 'major_general', 'none', 'colonel'],
    ['landmine', 'captain', 'major_general', 'field_marshall', 'bomb'],
    ['bomb', 'flag', 'landmine', 'lieutenant', 'landmine'],
  ],
];

/**
 * Converts a curated example (given in the human-facing orientation above)
 * into a Board for the given affiliation, reversed into the same
 * HQ-row-first orientation generateRandomValidHalfBoard produces - so
 * callers (e.g. submitAiInitialBoard) can treat the two interchangeably.
 * @see buildExampleHalfBoard
 */
export function buildExampleHalfBoard(
    exampleIndex: number,
    affiliation: number,
): Board {
    const layout = exampleBoards[exampleIndex];
    const reversed = [...layout].reverse();
    const board: Board = reversed.map((row) =>
        row.map((name) => (name === 'none' ? null : createPiece(name, affiliation))),
    );

    const [isValid, errors] = validateSetup(
        board as unknown as Parameters<typeof validateSetup>[0],
        false,
    );
    if (!isValid) {
        throw new Error(
            `Example board ${exampleIndex} failed validation: ${errors.join(', ')}`,
        );
    }
    return board;
}

/**
 * Picks one of the curated example half-boards at random - used to give the
 * AI opponent a sensible (rather than purely shuffled) placement.
 * @see chooseAiExampleHalfBoard
 */
export function chooseAiExampleHalfBoard(affiliation: number): Board {
    const index = Math.floor(Math.random() * exampleBoards.length);
    return buildExampleHalfBoard(index, affiliation);
}
