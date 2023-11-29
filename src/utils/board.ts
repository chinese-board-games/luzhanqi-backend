import { cloneDeep } from 'lodash';

import { Piece } from './piece';
import { isCamp } from './core';
import { createPiece } from './piece';

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
};

export const emplaceBoardFog = (
    game: { board: Piece[][]; deadPieces: Piece[] },
    playerIndex: number,
) => {
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

    const myDeadPieces = game.deadPieces.map((piece) => {
        if (piece.affiliation !== playerIndex) {
            return { ...piece, name: 'enemy', order: -1 };
        }
        return piece;
    });

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
                        ...createPiece('enemy', 1 - playerIndex), // indicate the affiliation as opposite of oneself
                        0: y,
                        1: x,
                        length: 2,
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

// returns a new board
export const pieceMovement = (board: Board, source: Piece, target: Piece) => {
    board = cloneDeep(board);
    const deadPieces: Piece[] = [];

    if (!source.length || !target.length) {
        return { board, deadPieces };
    }

    const sourcePiece = board[source[0]][source[1]];
    const targetPiece = board[target[0]][target[1]];

    // there is no piece at the source tile (not a valid move)
    if (
        sourcePiece === null ||
        sourcePiece.name === 'landmine' ||
        sourcePiece.name === 'flag'
    ) {
        return { board, deadPieces };
    }

    // pieces are of same affiliation
    if (targetPiece && sourcePiece.affiliation === targetPiece.affiliation) {
        return { board, deadPieces };
    }
    if (targetPiece === null) {
        // place source piece on target tile, remove source piece from source tile
        board[target[0]][target[1]] = sourcePiece;
        board[source[0]][source[1]] = null;
    } else if (
        sourcePiece.name === 'bomb' ||
        sourcePiece.name === targetPiece.name ||
        targetPiece.name === 'bomb' ||
        (sourcePiece.name !== 'engineer' && targetPiece.name === 'landmine')
    ) {
        // kill both pieces
        deadPieces.push(targetPiece, sourcePiece);
        board[target[0]][target[1]] = null;
        board[source[0]][source[1]] = null;
    } else if (
        sourcePiece.order > targetPiece.order ||
        (sourcePiece.name === 'engineer' && targetPiece.name === 'landmine')
    ) {
        // kill target piece
        deadPieces.push(targetPiece);

        // place source piece on target tile, remove source piece from source tile
        board[target[0]][target[1]] = sourcePiece;
        board[source[0]][source[1]] = null;
    } else {
        // kill source piece only
        deadPieces.push(sourcePiece);
        board[source[0]][source[1]] = null;
    }
    return { board, deadPieces };
};

// function that prints the board in a readable format
export const printBoard = (board: Board): void => {
    for (let i = 0; i < 12; i++) {
        let row = '';
        // after the sixth row, add the frontier
        if (i === 6) {
            row += ' .... [/\\/\\] .... [/\\/\\] .... \n';
        }
        for (let j = 0; j < 5; j++) {
            // if the row is a camp, surround piece name with brackets
            // otherwise, add a space on either side
            if (isCamp(i, j)) {
                // first four letters of the piece name, capitalized, or '....' if null
                row +=
                    '[' +
                    (board[i][j]?.name.slice(0, 4).toUpperCase() || '----') +
                    ']';
            } else {
                row +=
                    ' ' +
                    (board[i][j]?.name.slice(0, 4).toUpperCase() || '----') +
                    ' ';
            }
        }
        console.info(row);
    }
};
