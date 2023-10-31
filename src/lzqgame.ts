/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-this-alias */
import { isEqual, cloneDeep } from 'lodash';
import type { Server, Socket } from 'socket.io';
import {
    createGame,
    addPlayer,
    getPlayers,
    isPlayerTurn,
    getMoveHistory,
    getGame,
    updateBoard,
    updateGame,
    winner,
} from './controllers/gameController';
import { addGame } from './controllers/userController';
import {
    getSuccessors,
    printBoard,
    validateSetup,
    pieces,
    createPiece,
} from './utils';
import { Board, Piece } from './types';

let io: Server;
let gameSocket: Socket;

export const initGame = (sio: Server, socket: Socket) => {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: 'You are connected!' });

    // Host events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);

    // Player Events
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerRestart', playerRestart);
    gameSocket.on('playerMakeMove', playerMakeMove);
    gameSocket.on('playerForfeit', playerForfeit);
    gameSocket.on('playerInitialBoard', playerInitialBoard);

    // Utility Events
    gameSocket.on('pieceSelection', pieceSelection);
};

/* *******************************
 *                             *
 *       HOST FUNCTIONS        *
 *                             *
 ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
async function hostCreateNewGame(
    this: any,
    { playerName, hostId }: { playerName: string; hostId: string },
) {
    // Create a unique Socket.IO Room
    // eslint-disable-next-line no-bitwise
    const gameId = ((Math.random() * 100000) | 0).toString();
    const myGame = await createGame({
        room: gameId,
        host: playerName,
        hostId,
        playerToSocketIdMap: new Map([[playerName, this.id]]),
    });
    if (myGame) {
        this.emit('newGameCreated', {
            gameId: gameId,
            mySocketId: this.id,
            players: await getPlayers(gameId),
        });
        console.info(
            `New game created with ID: ${gameId} at socket: ${this.id}`,
        );

        // Join the Room and wait for the players
        this.join(gameId);
        // Add the Game _id to the host's User document if they are logged in
        hostId && (await addGame(hostId, myGame._id));
    } else {
        console.error('Game was not created.');
    }
}

/**
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(this: any, gameId: string) {
    const data = {
        mySocketId: this.id,
        gameId,
        turn: 0,
    };
    console.info(`All players present. Preparing game ${data.gameId}`);
    io.in(data.gameId).emit('beginNewGame', data);
}

/**
 * A Player (not the host) clicked the 'Join Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
async function playerJoinGame(
    this: any,
    data: {
        playerName: string;
        clientId: string | null;
        joinRoomId: string;
        mySocketId: string;
        players: string[];
    },
) {
    console.info(
        `Player ${data.playerName} attempting to join game: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    const existingPlayers = await getPlayers(data.joinRoomId);
    if (!existingPlayers) {
        this.emit('error', [
            'This game does not exist. Please enter a valid game ID.',
        ]);
    } else if (existingPlayers.includes(data.playerName)) {
        this.emit('error', [
            'There is already a player in this game by that name. Please choose another.',
        ]);
    } else {
        console.info(`Room: ${data.joinRoomId}`);
        // attach the socket id to the data object.
        data.mySocketId = this.id;

        // Join the room
        this.join(data.joinRoomId);

        console.info(
            `Player ${data.playerName} joining game: ${data.joinRoomId} at socket: ${this.id}`,
        );

        const myUpdatedGame = await addPlayer({
            room: data.joinRoomId,
            playerName: data.playerName,
            clientId: data.clientId,
            mySocketId: data.mySocketId,
        });
        if (myUpdatedGame) {
            // add the Game _id to the player's User document if they are logged in
            data.clientId && (await addGame(data.clientId, myUpdatedGame._id));

            const players = await getPlayers(data.joinRoomId);
            if (!players) {
                console.error('Player could not be added to given game');
                this.emit('error', [
                    `${data.playerName} could not be added to game: ${data.joinRoomId}`,
                ]);
                return;
            }
            data.players = players;
            this.emit('youHaveJoinedTheRoom', data);
            io.sockets.in(data.joinRoomId).emit('playerJoinedRoom', data);
        } else {
            console.error('Player could not be added to given game');
            this.emit('error', [
                `${data.playerName} could not be added to game: ${data.joinRoomId}`,
            ]);
        }
    }
}

const emplaceBoardFog = (game: { board: Piece[][] }, playerIndex: number) => {
    // copy the board because we are diverging them
    const myBoard = cloneDeep(game.board);

    myBoard.forEach((row: Piece[], y: number) => {
        // for each space
        row.forEach((space: Piece | null, x: number) => {
            if (space !== null && space.affiliation !== playerIndex) {
                // only replace pieces that are there
                myBoard[y][x] = {
                    0: y,
                    1: x,
                    length: 2,
                    ...createPiece('enemy', 1 - playerIndex), // indicate the affiliation as opposite of oneself
                };
            }
        });
    });
    const myGame = cloneDeep(game);
    myGame.board = myBoard;
    printBoard(myBoard);
    return myGame;
};

async function playerInitialBoard(
    this: any,
    {
        playerName,
        myPositions,
        room,
    }: {
        playerName: string;
        myPositions: [][];
        room: string;
    },
) {
    console.info(`playerInitialBoard from ${playerName} on socket ${this.id}`);
    let myGame = await getGame(room);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${room}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);
    if (myGame.board === null) {
        let halfGameBoard;
        if (playerIndex === 0) {
            // the host
            console.info('Confirmed host');
            halfGameBoard = myPositions;
        } else {
            // the guest
            halfGameBoard = myPositions.reverse();
        }
        const [isValid, validationErrorStack] = validateSetup(
            halfGameBoard,
            !playerIndex,
        );
        if (!isValid) {
            console.error(validationErrorStack.join(', \n'));
            this.emit('error', validationErrorStack);
            return;
        }
        await updateBoard(room, halfGameBoard);
        this.emit('halfBoardReceived');
    } else if (myGame.board.length === 6) {
        // only half of the board is filled
        let completeGameBoard;
        if (playerIndex === 0) {
            // the host
            completeGameBoard = myGame.board.concat(myPositions);
        } else if (playerIndex === 1) {
            // the guest
            completeGameBoard = myPositions
                .reverse()
                .concat(myGame.board as [][]);
        }
        await updateBoard(room, completeGameBoard);
        myGame = await getGame(room);

        if (!myGame) {
            console.error('Game not found.');
            this.emit('error', [`$Game not found: ${room}`]);
            return;
        }

        myGame.playerToSocketIdMap.forEach(
            (socketId: string, instPlayerName: string) => {
                console.info(
                    `Sending board to ${instPlayerName} on socket: ${socketId}`,
                );

                if (!myGame) {
                    console.error('Game not found.');
                    this.emit('error', [`$Game not found: ${room}`]);
                    return;
                }

                const playerIndex = myGame.players.indexOf(instPlayerName);
                console.info(`playerIndex: ${playerIndex}`);

                const modifiedGame = emplaceBoardFog(
                    myGame as unknown as { board: Piece[][] },
                    playerIndex,
                );
                io.to(socketId).emit('boardSet', modifiedGame);
            },
        );
    }
}

async function pieceSelection(
    this: any,
    {
        board,
        piece,
        playerName,
        room,
    }: {
        board: [][];
        piece: number[];
        playerName: string;
        room: string;
    },
) {
    console.info(`pieceSelection from ${playerName} on socket ${this.id}`);
    const myGame = await getGame(room);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${room}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);

    const successors = getSuccessors(board, piece[0], piece[1], playerIndex);
    this.emit('pieceSelected', successors);
}

// returns a new board
function pieceMovement(board: Board, source: Piece, target: Piece) {
    // copy the board
    board = cloneDeep(board);

    if (!source.length || !target.length) {
        return board;
    }

    const sourcePiece = board[source[0]][source[1]];
    const targetPiece = board[target[0]][target[1]];

    // there is no piece at the source tile (not a valid move)
    if (
        sourcePiece === null ||
        sourcePiece.name === 'landmine' ||
        sourcePiece.name === 'flag'
    ) {
        return board;
    }

    // pieces are of same affiliation
    if (targetPiece && sourcePiece.affiliation === targetPiece.affiliation) {
        return board;
    }

    if (
        targetPiece &&
        (sourcePiece.name === 'bomb' ||
            sourcePiece.name === targetPiece.name ||
            targetPiece.name === 'bomb' ||
            (sourcePiece.name !== 'engineer' &&
                targetPiece.name === 'landmine'))
    ) {
        // remove both pieces
        board[target[0]][target[1]] = null;
        board[source[0]][source[1]] = null;
    } else if (
        targetPiece === null ||
        sourcePiece.order > targetPiece.order ||
        (sourcePiece.name === 'engineer' && targetPiece.name === 'landmine')
    ) {
        // both pieces die
        // place source piece on target tile, remove source piece from source tile
        board[target[0]][target[1]] = sourcePiece;
        board[source[0]][source[1]] = null;
    } else {
        // kill source piece only
        board[source[0]][source[1]] = null;
    }
    return board;
}

// return game stats in the form of a nested array
async function getGameStats(this: any, room: string) {
    const myGame = await getGame(room);
    if (!myGame?.board) {
        console.error('Game or game board not found.');
        this.emit('error', [`$Game or game board not found: ${room}`]);
        return;
    }
    // get number of pieces killed by each player
    const emptyPieceArr = [
        ...Object.keys(pieces).map((piece) => ({
            name: piece,
            count: 0,
            order: pieces[piece].order,
        })),
    ];

    const remain = [
        // deep copies of emptyPieceArr, strongly typed
        JSON.parse(JSON.stringify(emptyPieceArr)) as [
            { name: string; count: number; order: number },
        ],
        JSON.parse(JSON.stringify(emptyPieceArr)) as [
            { name: string; count: number; order: number },
        ],
    ];
    myGame.board.forEach((row) => {
        row.forEach((piece) => {
            if (piece) {
                const affiliation = piece.affiliation;
                const pieceIndex = remain[affiliation].findIndex(
                    (p) => p.name === piece.name,
                );
                remain[affiliation][pieceIndex].count += 1;
            }
        });
    });
    // get number of pieces killed by each player
    const lost = [
        remain[0].map(({ name, order, count: _count }) => {
            const pieceIndex = remain[0].findIndex((p) => p.name === name);
            return {
                name,
                count: pieces[name].count - remain[0][pieceIndex].count,
                order,
            };
        }),
        remain[1].map(({ name, order, count: _count }) => {
            const pieceIndex = remain[1].findIndex((p) => p.name === name);
            return {
                name,
                count: pieces[name].count - remain[1][pieceIndex].count,
                order,
            };
        }),
    ];
    return {
        remain,
        lost,
    };
}

async function playerMakeMove(
    this: any,
    {
        playerName,
        uid,
        room,
        turn,
        pendingMove,
    }: {
        playerName: string;
        uid: string;
        room: string;
        turn: number;
        pendingMove: {
            source: Piece;
            target: Piece;
        };
    },
) {
    // TODO: add move validation function
    if (
        await isPlayerTurn({
            playerName,
            room,
            turn,
        })
    ) {
        let myGame = await getGame(room);
        if (!myGame) {
            console.error('Game not found.');
            this.emit('error', [`$Game not found: ${room}`]);
            return;
        }
        const myBoard = myGame.board;
        const { source, target } = pendingMove;
        const newBoard = pieceMovement(myBoard as Board, source, target);
        if (isEqual(newBoard, myBoard)) {
            this.emit('error', ['No move made.']);
        } else {
            turn += 1;
            await updateBoard(room, newBoard);
            // print the board
            printBoard(newBoard);
            const moveHistory = await getMoveHistory(room);
            if (!moveHistory) {
                console.error('Move history not found.');
                this.emit('error', [`$Move history not found: ${room}`]);
                return;
            }
            await updateGame(room, {
                turn,
                moves: [...moveHistory, pendingMove],
            });
            myGame = await getGame(room);

            if (!myGame) {
                console.error('Game not found.');
                this.emit('error', [`$Game not found: ${room}`]);
                return;
            }

            console.info(`Someone made a move, the turn is now ${turn}`);
            console.info(`Sending back gameState on ${room}`);
            console.info(`myGame.playerToSocketIdMap: `);
            console.info(myGame.playerToSocketIdMap);
            myGame.playerToSocketIdMap.forEach(
                (socketId: string, instPlayerName: string) => {
                    console.info(
                        `Sending board to ${instPlayerName} on socket: ${socketId}`,
                    );

                    if (!myGame) {
                        console.error('Game not found.');
                        this.emit('error', [`$Game not found: ${room}`]);
                        return;
                    }

                    const playerIndex = myGame.players.indexOf(instPlayerName);
                    console.info(`playerIndex: ${playerIndex}`);

                    const modifiedGame = emplaceBoardFog(
                        myGame as unknown as { board: Piece[][] },
                        playerIndex,
                    );
                    io.to(socketId).emit('playerMadeMove', modifiedGame);
                },
            );

            const winnerIndex = await winner(room);
            const gameStats = await getGameStats(room);
            if (winnerIndex !== -1) {
                console.info('game ended from victory', gameStats);
                io.sockets.in(room).emit('endGame', { winnerIndex, gameStats });
                await updateGame(room, { winnerId: uid || 'anonymous' });
            }
        }
    } else {
        this.emit('error', ['It is not your turn.']);
    }
}

async function playerForfeit(
    this: any,
    { playerName, room }: { playerName: string; room: string },
) {
    const myGame = await getGame(room);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${room}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);
    const winnerIndex = playerIndex === 0 ? 1 : 0;

    if (winnerIndex == 0) {
        // host wins
        await updateGame(room, {
            winnerId: myGame.hostId || 'anonymous',
        });
    } else {
        // client wins
        await updateGame(room, {
            winnerId: myGame.clientId || 'anonymous',
        });
    }

    const gameStats = await getGameStats(room);
    console.info('game ended due to forfeit');
    io.sockets.in(room).emit('endGame', { winnerIndex, gameStats });
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(this: any, data: { gameId: string; playerId: string }) {
    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}
