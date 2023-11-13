import { isEqual, cloneDeep } from 'lodash';
import type { Server, Socket } from 'socket.io';
import Game, { GameConfigData } from './models/Game';
import {
    createGame,
    addClient,
    removePlayer,
    getPlayers,
    isPlayerTurn,
    getMoveHistory,
    updateBoard,
    updateGame,
    winner,
    deleteGame,
    getGameById,
} from './controllers/gameController';
import { addGame, removeGame } from './controllers/userController';
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
    gameSocket.on('playerJoinRoom', playerJoinRoom);
    gameSocket.on('playerLeaveRoom', playerLeaveRoom);
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
    this: Socket,
    {
        playerName,
        hostId,
        gameConfig,
    }: {
        playerName: string;
        hostId: string | null;
        gameConfig: GameConfigData;
    },
) {
    const myGame = await createGame({
        host: playerName,
        playerToUidMap: new Map([[playerName, hostId]]),
        playerToSocketIdMap: new Map([[playerName, this.id]]),
        gameConfig,
    });
    if (myGame) {
        // MongoDB ObjectIds are BSON by default, ensure roomIds are always strings
        const string_gid = myGame._id.toString();
        this.emit('newGameCreated', {
            gameId: string_gid,
            mySocketId: this.id,
            players: await getPlayers(string_gid),
        });
        console.info(
            `New game created with ID: ${string_gid} at socket: ${this.id}`,
        );

        // Join the room and wait for the players
        this.join(string_gid);
        // Add the Game _id to the host's User document if they are logged in
        hostId && (await addGame(hostId, string_gid));
    } else {
        console.error('Game was not created.');
    }
}

/**
 * Two players have joined. Alert the host!
 * @param roomId The room ID
 */
async function hostPrepareGame(
    this: Socket,
    gid: string,
    gameConfig: GameConfigData | null,
) {
    const data = {
        mySocketId: this.id,
        roomId: gid,
        turn: 0,
    };
    if (gameConfig) {
        const res = await Game.findByIdAndUpdate(
            gid,
            { $set: { config: gameConfig } },
            { new: true },
        );
    }
    console.info(`All players present. Preparing game for room ${gid}`);
    io.sockets.in(gid).emit('beginNewGame', data);
}

/**
 * A Player (not the host) clicked the 'Join Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
async function playerJoinRoom(
    this: Socket,
    data: {
        playerName: string;
        clientId: string | null;
        joinRoomId: string;
        mySocketId: string;
        players: string[];
    },
) {
    console.info(
        `Player ${data.playerName} attempting to join room: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    const existingPlayers = await getPlayers(data.joinRoomId);
    if (!existingPlayers) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room ID.',
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

        const myUpdatedGame = await addClient({
            gid: data.joinRoomId,
            playerName: data.playerName,
            clientId: data.clientId,
            mySocketId: data.mySocketId,
        });
        if (myUpdatedGame) {
            // add the Game _id to the player's User document if they are logged in
            data.clientId &&
                (await addGame(data.clientId, myUpdatedGame._id.toString()));

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

/**
 * The player wants to leave the game. Remove only the player.
 * @param roomId The room ID
 */
async function playerLeaveRoom(
    this: Socket,
    data: {
        playerName: string;
        uid: string | null;
        leaveRoomId: string;
        players: string[];
    },
) {
    console.info(
        `Player with name: ${data.playerName} leaving room ${data.leaveRoomId}`,
    );
    // clean up by removing the player from DB
    const existingPlayers = await getPlayers(data.leaveRoomId);

    if (!existingPlayers) {
        this.emit('error', ['Attempting to leave room that does not exist.']);
        return;
    }
    console.info(`Room: ${data.leaveRoomId}`);

    if (existingPlayers.indexOf(data.playerName) == 0) {
        // host is leaving, delete the game and kick everyone
        console.info(`Room ${data.leaveRoomId} has been deleted.`);
        // remove the game
        const myDeletedGame = await deleteGame(data.leaveRoomId);
        if (myDeletedGame) {
            myDeletedGame.players.forEach(async (player) => {
                const eachUid = myDeletedGame.playerToUidMap.get(player);
                eachUid &&
                    (await removeGame(eachUid, myDeletedGame._id.toString()));
            });
            io.sockets
                .in(data.leaveRoomId)
                .emit('youHaveLeftTheRoom', { ...data, players: [] });
            io.socketsLeave(data.leaveRoomId);
        } else {
            console.error(
                `Game corresponding to room ${data.leaveRoomId} could not be deleted.`,
            );
            this.emit('error', [
                `${data.playerName} (host) could not be removed from room: ${data.leaveRoomId}`,
            ]);
        }
    } else {
        // Leave the room
        this.leave(data.leaveRoomId);

        console.info(
            `Player ${data.playerName} leaving room: ${data.leaveRoomId} at socket: ${this.id}`,
        );

        const myUpdatedGame = await removePlayer({
            gid: data.leaveRoomId,
            playerName: data.playerName,
            clientId: data.uid,
        });
        if (myUpdatedGame) {
            // remove the Game id from the player's User document if they are logged in
            data.uid &&
                (await removeGame(data.uid, myUpdatedGame._id.toString()));

            const players = await getPlayers(data.leaveRoomId);
            if (!players || players.length !== 1) {
                console.error('Player could not be removed from given room');
                this.emit('error', [
                    `${data.playerName} could not be removed from room: ${data.leaveRoomId}`,
                ]);
                return;
            }
            data.players = players;
            this.emit('youHaveLeftTheRoom');
            io.sockets.in(data.leaveRoomId).emit('playerLeftRoom', data);
        } else {
            console.error('Player could not be removed from given room');
            this.emit('error', [
                `${data.playerName} could not be removed from room: ${data.leaveRoomId}`,
            ]);
        }
    }
}

const emplaceBoardFog = (game: { board: Piece[][] }, playerIndex: number) => {
    // copy the board because we are diverging them
    const myBoard = cloneDeep(game.board);
    const enemyHasFieldMarshall = myBoard.some((row: Piece[]) =>
        row.some((space: Piece | null) => {
            return (
                space !== null &&
                space.affiliation !== playerIndex &&
                space.name === 'fieldMarshall'
            );
        }),
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
    printBoard(myBoard);
    return myGame;
};

async function playerInitialBoard(
    this: Socket,
    {
        playerName,
        myPositions,
        room: gid,
    }: {
        playerName: string;
        myPositions: [][];
        room: string;
    },
) {
    console.info(`playerInitialBoard from ${playerName} on socket ${this.id}`);
    let myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${gid}`]);
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
        await updateBoard(gid, halfGameBoard);
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
        await updateBoard(gid, completeGameBoard);
        myGame = await getGameById(gid);

        if (!myGame) {
            console.error('Game not found.');
            this.emit('error', [`$Game not found: ${gid}`]);
            return;
        }

        myGame.playerToSocketIdMap.forEach(
            (socketId: string, instPlayerName: string) => {
                console.info(
                    `Sending board to ${instPlayerName} on socket: ${socketId}`,
                );

                if (!myGame) {
                    console.error('Game not found.');
                    this.emit('error', [`$Game not found: ${gid}`]);
                    return;
                }

                const playerIndex = myGame.players.indexOf(instPlayerName);
                console.info(`playerIndex: ${playerIndex}`);

                io.to(socketId).emit(
                    'boardSet',
                    myGame.config.fogOfWar
                        ? emplaceBoardFog(
                              myGame as unknown as { board: Piece[][] },
                              playerIndex,
                          )
                        : myGame,
                );
            },
        );
    }
}

async function pieceSelection(
    this: Socket,
    {
        board,
        piece,
        playerName,
        room: gid,
    }: {
        board: [][];
        piece: number[];
        playerName: string;
        room: string;
    },
) {
    console.info(`pieceSelection from ${playerName} on socket ${this.id}`);
    const myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${gid}`]);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getGameStats(this: any, gid: string) {
    const myGame = await getGameById(gid);
    if (!myGame?.board) {
        console.error('Game or game board not found.');
        this.emit('error', [`$Game or game board not found: ${gid}`]);
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
    this: Socket,
    {
        playerName,
        uid,
        room: gid,
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
            gid,
            turn,
        })
    ) {
        let myGame = await getGameById(gid);
        if (!myGame) {
            console.error('Game not found.');
            this.emit('error', [`$Game not found: ${gid}`]);
            return;
        }
        const myBoard = myGame.board;
        const { source, target } = pendingMove;
        const newBoard = pieceMovement(myBoard as Board, source, target);
        if (isEqual(newBoard, myBoard)) {
            this.emit('error', ['No move made.']);
        } else {
            turn += 1;
            await updateBoard(gid, newBoard);
            // print the board
            printBoard(newBoard);
            const moveHistory = await getMoveHistory(gid);
            if (!moveHistory) {
                console.error('Move history not found.');
                this.emit('error', [`$Move history not found: ${gid}`]);
                return;
            }
            await updateGame(gid, {
                turn,
                moves: [...moveHistory, pendingMove],
            });
            myGame = await getGameById(gid);

            if (!myGame) {
                console.error('Game not found.');
                this.emit('error', [`$Game not found: ${gid}`]);
                return;
            }

            console.info(`Someone made a move, the turn is now ${turn}`);
            console.info(`Sending back gameState on ${gid}`);
            console.info(`myGame.playerToSocketIdMap: `);
            console.info(myGame.playerToSocketIdMap);
            myGame.playerToSocketIdMap.forEach(
                (socketId: string, instPlayerName: string) => {
                    console.info(
                        `Sending board to ${instPlayerName} on socket: ${socketId}`,
                    );

                    if (!myGame) {
                        console.error('Game not found.');
                        this.emit('error', [`$Game not found: ${gid}`]);
                        return;
                    }

                    const playerIndex = myGame.players.indexOf(instPlayerName);
                    console.info(`playerIndex: ${playerIndex}`);

                    io.to(socketId).emit(
                        'playerMadeMove',
                        myGame.config.fogOfWar
                            ? emplaceBoardFog(
                                  myGame as unknown as { board: Piece[][] },
                                  playerIndex,
                              )
                            : myGame,
                    );
                },
            );

            const winnerIndex = await winner(gid);
            const gameStats = await getGameStats(gid);
            if (winnerIndex !== -1) {
                console.info('game ended from victory', gameStats);
                io.sockets.in(gid).emit('endGame', { winnerIndex, gameStats });
                await updateGame(gid, { winnerId: uid || 'anonymous' });
            }
        }
    } else {
        this.emit('error', ['It is not your turn.']);
    }
}

async function playerForfeit(
    this: Socket,
    { playerName, room: gid }: { playerName: string; room: string },
) {
    const myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${gid}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);
    const winnerIndex = playerIndex === 0 ? 1 : 0;

    await updateGame(gid, {
        winnerId:
            myGame.playerToUidMap.get(myGame.players[winnerIndex]) ||
            'anonymous',
    });

    const gameStats = await getGameStats(gid);
    console.info('game ended due to forfeit');
    io.sockets.in(gid).emit('endGame', { winnerIndex, gameStats });
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(
    this: Socket,
    data: { gameId: string; playerId: string },
) {
    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}
