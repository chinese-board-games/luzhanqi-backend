import { Piece } from './piece';

/**
 * A 12 by 5 two dimensional array of Piece objects.
 */
export type Board = (Piece | null)[][];

/**
 * 
 * @returns An empty 12 by 5 board.
 */
 export const emptyBoard = (): Board => {
    const board: Board = [];
    for (let i = 0; i < 12; i++) {
        board.push(Array(5).fill(null));
    }
    return board;
}
