import io from './server';
import { isEqual } from 'lodash';
import type { Socket } from 'socket.io';
import {
    addPlayer,
    removePlayer,
    getPlayers,
    isPlayerTurn,
    getMoveHistory,
    getDeadPieces,
    updateBoard,
    updateGame,
    winner,
    deleteGame,
    getGameById,
} from './controllers/gameController';
import { addGame, removeGame } from './controllers/userController';
import {
    printBoard,
    validateSetup,
    pieces,
    emplaceBoardFog,
    pieceMovement,
} from './utils';
import { Board, Piece } from './types';

/**
 * A Player (not the host) clicked the 'Join Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
export async function playerJoinRoom(
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
    } else if (existingPlayers.length == 2) {
        this.emit('error', ['There are already two players in this game.']);
    } else if (existingPlayers.includes(data.playerName)) {
        this.emit('error', [
            'There is already a player in this game by that name. Please choose another name.',
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
export async function playerLeaveRoom(
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
        this.emit('error', [
            'Attempting to leave room that does not exist or does not contain players.',
        ]);
        return;
    }
    console.info(`Room: ${data.leaveRoomId}`);

    const myGame = await getGameById(data.leaveRoomId);

    if (myGame?.board) {
        // board has already been set, do not delete the Game
        this.emit('youHaveLeftTheRoom', { ...data, players: [] });
        return;
    }

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

export async function playerInitialBoard(
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
                    `Sending board to player ${instPlayerName} on socket: ${socketId}`,
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
                              myGame as unknown as {
                                  board: Piece[][];
                                  deadPieces: Piece[];
                              },
                              playerIndex,
                          )
                        : myGame,
                );
            },
        );
        myGame.spectatorToSocketIdMap.forEach(
            (socketId: string, instSpectatorName: string) => {
                console.info(
                    `Sending board to spectator ${instSpectatorName} on socket: ${socketId}`,
                );

                if (!myGame) {
                    console.error('Game not found.');
                    this.emit('error', [`$Game not found: ${gid}`]);
                    return;
                }

                const spectatorIndex =
                    myGame.spectators.indexOf(instSpectatorName);
                console.info(`spectatorIndex: ${spectatorIndex}`);

                io.to(socketId).emit('boardSet', myGame);
            },
        );
    }
}

export async function playerMakeMove(
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
        const { board: newBoard, deadPieces } = pieceMovement(
            myBoard as Board,
            source,
            target,
        );
        if (isEqual(newBoard, myBoard)) {
            this.emit('error', ['No move made.']);
        } else {
            turn += 1;
            await updateBoard(gid, newBoard);
            // print the board
            printBoard(newBoard);
            const moveHistory = await getMoveHistory(gid);
            const deadPieceHistory = await getDeadPieces(gid);
            if (!moveHistory) {
                console.error('Move history not found.');
                this.emit('error', [`$Move history not found: ${gid}`]);
                return;
            }
            await updateGame(gid, {
                turn,
                moves: [...moveHistory, pendingMove],
                deadPieces: [...(deadPieceHistory || []), ...deadPieces],
            });
            myGame = await getGameById(gid);

            if (!myGame) {
                console.error('Game not found.');
                this.emit('error', [`$Game not found: ${gid}`]);
                return;
            }

            console.info(`Someone made a move, the turn is now ${turn}`);
            console.info(`Sending back gameState on ${gid}`);
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
                                  myGame as unknown as {
                                      board: Piece[][];
                                      deadPieces: Piece[];
                                  },
                                  playerIndex,
                              )
                            : myGame,
                    );
                },
            );

            myGame.spectatorToSocketIdMap.forEach(
                (socketId: string, instSpectatorName: string) => {
                    console.info(
                        `Sending board to ${instSpectatorName} on socket: ${socketId}`,
                    );

                    if (!myGame) {
                        console.error('Game not found.');
                        this.emit('error', [`$Game not found: ${gid}`]);
                        return;
                    }

                    const spectatorIndex =
                        myGame.spectators.indexOf(instSpectatorName);
                    console.info(`spectatorIndex: ${spectatorIndex}`);

                    io.to(socketId).emit('playerMadeMove', myGame);
                },
            );

            const winnerIndex = await winner(gid);
            const gameStats = await getGameStats(this, gid);
            if (winnerIndex !== -1) {
                console.info('game ended from victory', gameStats);
                io.sockets.in(gid).emit('endGame', {
                    winnerIndex,
                    gameStats,
                    finalGame: myGame,
                });
                await updateGame(gid, { winnerId: uid || 'anonymous' });
            }
        }
    } else {
        this.emit('error', ['It is not your turn.']);
    }
}

export async function playerForfeit(
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

    const gameStats = await getGameStats(this, gid);
    console.info('game ended due to forfeit');
    io.sockets
        .in(gid)
        .emit('endGame', { winnerIndex, gameStats, finalGame: myGame });
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
export function playerRestart(
    this: Socket,
    data: { gameId: string; playerId: string },
) {
    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}

// return game stats in the form of a nested array
export async function getGameStats(socket: Socket, gid: string) {
    const myGame = await getGameById(gid);
    if (!myGame?.board) {
        console.error('Game or game board not found.');
        socket.emit('error', [`$Game or game board not found: ${gid}`]);
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
