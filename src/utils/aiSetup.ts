import { createPiece, pieces } from './piece';
import { isCamp } from './core';
import { validateSetup } from './validateSetup';
import { Board } from './board';

const HALF_ROWS = 6;
const COLS = 5;

type Cell = [number, number];

const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

function shuffle<T>(items: T[]): T[] {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Builds a random half-board that satisfies validateSetup by construction:
 * flag in the HQ, landmines in the back two rows, bombs kept off the
 * frontline row, and the remaining pieces shuffled into the rest. Used to
 * give the AI opponent a placement without a real player.
 * @see generateRandomValidHalfBoard
 */
export function generateRandomValidHalfBoard(affiliation: number): Board {
    const allCells: Cell[] = [];
    for (let r = 0; r < HALF_ROWS; r += 1) {
        for (let c = 0; c < COLS; c += 1) {
            if (!isCamp(r, c)) {
                allCells.push([r, c]);
            }
        }
    }
    const hqCells = allCells.filter(([r, c]) => r === 0 && (c === 1 || c === 3));
    // validateSetup flags landmines at r >= 4, so they may only sit at r < 4
    const landmineEligibleCells = allCells.filter(([r]) => r < 4);
    // validateSetup flags bombs at r === 5 (the frontline row) only
    const frontlineCells = allCells.filter(([r]) => r === 5);

    const board: Board = Array.from({ length: HALF_ROWS }, () =>
        Array(COLS).fill(null),
    );
    let remainingCells = allCells;

    const place = (cell: Cell, name: string) => {
        board[cell[0]][cell[1]] = createPiece(name, affiliation);
        remainingCells = remainingCells.filter((c) => !sameCell(c, cell));
    };

    const flagCell = shuffle(hqCells)[0];
    place(flagCell, 'flag');

    const landmineCells = shuffle(
        landmineEligibleCells.filter((cell) =>
            remainingCells.some((c) => sameCell(c, cell)),
        ),
    ).slice(0, pieces.landmine.count);
    landmineCells.forEach((cell) => place(cell, 'landmine'));

    const pool = shuffle(
        Object.entries(pieces).flatMap(([name, { count }]) =>
            name === 'flag' || name === 'landmine' || name === 'enemy'
                ? []
                : Array(count).fill(name),
        ),
    );
    const bombNames = pool.filter((name) => name === 'bomb');
    const otherNames = pool.filter((name) => name !== 'bomb');

    const nonFrontlineRemaining = shuffle(
        remainingCells.filter(
            (cell) => !frontlineCells.some((c) => sameCell(c, cell)),
        ),
    );
    bombNames.forEach((name, i) => place(nonFrontlineRemaining[i], name));

    const restCells = shuffle(remainingCells);
    otherNames.forEach((name, i) => place(restCells[i], name));

    const [isValid, errors] = validateSetup(
        board as unknown as Parameters<typeof validateSetup>[0],
        false,
    );
    if (!isValid) {
        throw new Error(
            `Generated AI setup failed validation: ${errors.join(', ')}`,
        );
    }
    return board;
}
