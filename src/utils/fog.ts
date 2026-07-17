import { cloneDeep } from 'lodash';
import { createPiece } from './piece';
import { printBoard } from './board';
import { Piece } from '../types';

/**
 * Produces the view of a game that a given player is legitimately allowed
 * to see: their own pieces as-is, and enemy pieces replaced with a generic
 * 'enemy' placeholder (unless the enemy's field marshall has died, in which
 * case their flag is revealed). Also filters dead pieces down to the
 * player's own, since a fogged player never legitimately learns which of
 * the opponent's pieces have died.
 * @see emplaceBoardFog
 */
export const emplaceBoardFog = (
    game: { board: Piece[][] | null; deadPieces: Piece[] },
    playerIndex: number,
) => {
    // the board is null before both halves of setup have been merged. 
    // Guarding here instead of only at each call site means the 
    // function is safe regardless of whether a caller remembers to 
    // check first.
    if (!game.board) {
        return cloneDeep(game);
    }

    // copy the board because we are diverging them
    const myBoard = cloneDeep(game.board);
    const enemyHasFieldMarshall = myBoard.some((row: Piece[]) =>
        row.some((space: Piece | null) => {
            return (
                space != null &&
                space.affiliation !== playerIndex &&
                space.name === 'field_marshall'
            );
        }),
    );

    const myDeadPieces = game.deadPieces.filter(
        (piece) => piece.affiliation == playerIndex,
    );

    myBoard.forEach((row: Piece[], y: number) => {
        // for each space
        row.forEach((space: Piece | null, x: number) => {
            // only replace pieces that are there
            if (space !== null && space.affiliation !== playerIndex) {
                // reveal flag if field marshall is captured
                const isRevealedFlag =
                    space.name === 'flag' && !enemyHasFieldMarshall;

                // hide piece if is enemy piece and not revealed flag
                if (!isRevealedFlag) {
                    myBoard[y][x] = {
                        0: y,
                        1: x,
                        length: 2,
                        ...createPiece('enemy', 1 - playerIndex), // indicate the affiliation as opposite of oneself
                    };
                }
            }
        });
    });
    const myGame = cloneDeep(game);
    myGame.board = myBoard;
    myGame.deadPieces = myDeadPieces;
    printBoard(myBoard);
    return myGame;
};
