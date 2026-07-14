import type { Server, Socket } from 'socket.io';
import Game, { GameConfigData } from './models/Game';
import {
    createGame,
    addClient,
    removePlayer,
    getPlayers,
    addSpectator,
    getSpectators,
    getGameById,
    removeSpectator,
    updateGame,
    sanitizeGameForClient,
    addAiPlayer,
    deleteGame,
    winner,
} from './controllers/gameController';
import { addGame, removeGame } from './controllers/userController';
import {
    applyMove,
    submitInitialBoard,
    submitAiInitialBoard,
    broadcastGameState,
    getGameStats,
} from './services/gameplayService';
import { getSuccessors, emplaceBoardFog } from './utils';
import { chooseAiMove } from './utils/aiPlayer';
import { AI_PLAYER_NAME } from './utils/aiConstants';
import { Board, Piece } from './types';

let io: Server;
let gameSocket: Socket;

// tracks which (gid, playerName) seat a live socket currently occupies,
// purely so we can announce a disconnect to the room - reconnection itself
// is handled by the DB-backed token, not this in-memory registry.
const socketSeatRegistry = new Map<string, { gid: string; playerName: string }>();

export const initGame = (sio: Server, socket: Socket) => {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: 'You are connected!' });

    // Host events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);

    // Player Events
    gameSocket.on('playerJoinRoom', playerJoinRoom);
    gameSocket.on('playerRejoinRoom', playerRejoinRoom);
    gameSocket.on('playerLeaveRoom', playerLeaveRoom);
    gameSocket.on('playerRestart', playerRestart);
    gameSocket.on('playerMakeMove', playerMakeMove);
    gameSocket.on('playerForfeit', playerForfeit);
    gameSocket.on('playerInitialBoard', playerInitialBoard);

    // Spectator Events
    gameSocket.on('spectateRoom', spectateRoom);
    gameSocket.on('spectatorLeaveRoom', spectatorLeaveRoom);

    // Utility Events
    gameSocket.on('pieceSelection', pieceSelection);

    // Connection Events
    gameSocket.on('disconnect', playerDisconnect);
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
        gameConfig?: Partial<GameConfigData>;
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

        // Join the room and wait for the players
        this.join(string_gid);
        socketSeatRegistry.set(this.id, { gid: string_gid, playerName });

        let finalGame = myGame;
        if (gameConfig?.opponentType === 'ai') {
            const withAi = await addAiPlayer(string_gid);
            if (withAi) {
                finalGame = withAi;
                await submitAiInitialBoard(string_gid);
            }
        }

        this.emit('newGameCreated', {
            gameId: string_gid,
            mySocketId: this.id,
            players: finalGame.players,
            phase: finalGame.phase,
            token: finalGame.playerToTokenMap.get(playerName),
        });
        console.info(
            `New game created with ID: ${string_gid} at socket: ${this.id}`,
        );

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
    const updateFields: Record<string, unknown> = { phase: 1 };
    if (gameConfig) {
        updateFields.config = gameConfig;
    }
    await Game.findByIdAndUpdate(gid, { $set: updateFields }, { new: true });
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
        spectators: string[];
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
            const spectators = await getSpectators(data.joinRoomId);
            if (!players) {
                console.error('Player could not be added to given game');
                this.emit('error', [
                    `${data.playerName} could not be added to game: ${data.joinRoomId}`,
                ]);
                return;
            }
            data.players = players;
            data.spectators = spectators || [];
            socketSeatRegistry.set(this.id, {
                gid: data.joinRoomId,
                playerName: data.playerName,
            });
            this.emit('youHaveJoinedTheRoom', {
                ...data,
                token: myUpdatedGame.playerToTokenMap.get(data.playerName),
                phase: myUpdatedGame.phase,
            });
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
 * A player's browser reconnected (page reload, closed tab reopened, etc).
 * Reclaims their seat if the provided token matches the one issued when
 * they originally joined, then sends them a full snapshot of the game.
 */
async function playerRejoinRoom(
    this: Socket,
    {
        gameId,
        playerName,
        token,
    }: { gameId: string; playerName: string; token: string },
) {
    console.info(
        `Player ${playerName} attempting to rejoin room: ${gameId} on socket id: ${this.id}`,
    );

    const myGame = await getGameById(gameId);
    if (!myGame) {
        this.emit('rejoinFailed', { gameId, reason: 'game-not-found' });
        return;
    }
    if (
        !myGame.players.includes(playerName) ||
        myGame.playerToTokenMap.get(playerName) !== token
    ) {
        this.emit('rejoinFailed', { gameId, reason: 'invalid-session' });
        return;
    }

    myGame.playerToSocketIdMap.set(playerName, this.id);
    await updateGame(gameId, {
        playerToSocketIdMap: myGame.playerToSocketIdMap,
    });
    this.join(gameId);
    socketSeatRegistry.set(this.id, { gid: gameId, playerName });

    const playerIndex = myGame.players.indexOf(playerName);
    const boardComplete = Array.isArray(myGame.board) && myGame.board.length === 12;
    let board = null;
    let deadPieces: unknown[] = [];
    if (boardComplete) {
        const view = myGame.config.fogOfWar
            ? emplaceBoardFog(
                  myGame as unknown as { board: Piece[][]; deadPieces: Piece[] },
                  playerIndex,
              )
            : myGame;
        board = view.board;
        deadPieces = view.deadPieces;
    }

    let winnerIndex: number | null = null;
    let gameStats = null;
    if (myGame.phase === 3 && boardComplete) {
        winnerIndex = await winner(gameId);
        gameStats = await getGameStats(gameId);
    }

    this.emit('youHaveRejoinedTheRoom', {
        gameId,
        playerName,
        players: myGame.players,
        spectators: myGame.spectators,
        phase: myGame.phase,
        turn: myGame.turn,
        board,
        deadPieces,
        moves: myGame.moves,
        submittedSide: myGame.playersSubmittedSetup?.includes(playerName) ?? false,
        winnerIndex,
        gameStats,
    });
    io.sockets.in(gameId).emit('playerReconnected', { playerName });
}

async function playerDisconnect(this: Socket) {
    const seat = socketSeatRegistry.get(this.id);
    if (!seat) {
        return;
    }
    socketSeatRegistry.delete(this.id);

    // On a page reload, the old socket doesn't always close immediately -
    // socket.io can take up to the ping-timeout window to notice, so this
    // disconnect can fire *after* the same player has already reconnected
    // on a new socket. If a newer socket has since taken over this seat,
    // this is that stale echo, not a real disconnect - don't announce it.
    const myGame = await getGameById(seat.gid);
    if (myGame && myGame.playerToSocketIdMap.get(seat.playerName) !== this.id) {
        return;
    }
    io.sockets.in(seat.gid).emit('playerDisconnected', {
        playerName: seat.playerName,
    });
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
        this.emit('error', [
            'Attempting to leave room that does not exist or does not contain players.',
        ]);
        return;
    }
    console.info(`Room: ${data.leaveRoomId}`);

    const myGame = await getGameById(data.leaveRoomId);

    socketSeatRegistry.delete(this.id);

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

/**
 * A user clicked the 'Spectate Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the user.
 * @param data Contains data entered via spectator's input - spectatorName and gameId.
 */
async function spectateRoom(
    this: Socket,
    data: {
        spectatorName: string;
        clientId: string | null;
        joinRoomId: string;
        mySocketId: string;
        spectators: string[];
        players: string[];
    },
) {
    console.info(
        `Spectator ${data.spectatorName} attempting to join room: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    const existingGame = await getGameById(data.joinRoomId);

    if (!existingGame?.players) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room ID.',
        ]);
    } else if (existingGame.moves.length) {
        this.emit('error', [
            'Unable to spectate game that has already started.',
        ]);
    } else if (
        existingGame.spectators?.length &&
        existingGame.spectators.includes(data.spectatorName)
    ) {
        this.emit('error', [
            'There is already a spectator by that name. Please choose another name.',
        ]);
    } else {
        console.info(`Room: ${data.joinRoomId}`);
        // attach the socket id to the data object.
        data.mySocketId = this.id;

        // Join the room
        this.join(data.joinRoomId);

        console.info(
            `Spectator ${data.spectatorName} joining game: ${data.joinRoomId} at socket: ${this.id}`,
        );

        const myUpdatedGame = await addSpectator({
            gid: data.joinRoomId,
            spectatorName: data.spectatorName,
            clientId: data.clientId,
            mySocketId: data.mySocketId,
        });
        if (myUpdatedGame) {
            // add the Game _id to the player's User document if they are logged in
            data.clientId &&
                (await addGame(data.clientId, myUpdatedGame._id.toString()));

            const spectators = await getSpectators(data.joinRoomId);
            const players = await getPlayers(data.joinRoomId);

            if (!spectators) {
                console.error('Could not spectate given game');
                this.emit('error', [
                    `${data.spectatorName} could not spectate game: ${data.joinRoomId}`,
                ]);
                return;
            }
            data.spectators = spectators;
            data.players = existingGame.players;
            this.emit('youAreSpectatingTheRoom');
            io.sockets.in(data.joinRoomId).emit('spectatorJoinedRoom', data);
        } else {
            console.error('Could not spectate given game');
            this.emit('error', [
                `${data.spectatorName} could not spectate game: ${data.joinRoomId}`,
            ]);
        }
    }
}

/**
 * The spectator wants to leave the game. Remove only the spectator.
 * @param roomId The room ID
 */
async function spectatorLeaveRoom(
    this: Socket,
    data: {
        spectatorName: string;
        uid: string | null;
        leaveRoomId: string;
        spectators: string[];
    },
) {
    console.info(
        `Player with name: ${data.spectatorName} leaving room ${data.leaveRoomId}`,
    );
    // clean up by removing the spectator from DB
    const existingSpectators = await getSpectators(data.leaveRoomId);

    if (!existingSpectators) {
        this.emit('error', [
            'Attempting to leave room that does not exist or does not contain spectators.',
        ]);
        return;
    }
    console.info(`Room: ${data.leaveRoomId}`);

    // Leave the room
    this.leave(data.leaveRoomId);

    console.info(
        `Player ${data.spectatorName} leaving room: ${data.leaveRoomId} at socket: ${this.id}`,
    );

    const myUpdatedGame = await removeSpectator({
        gid: data.leaveRoomId,
        spectatorName: data.spectatorName,
        clientId: data.uid,
    });
    if (myUpdatedGame) {
        // // remove the Game id from the player's User document if they are logged in
        // data.uid &&
        //     (await removeGame(data.uid, myUpdatedGame._id.toString()));

        const spectators = await getSpectators(data.leaveRoomId);
        if (spectators?.includes(data.spectatorName)) {
            console.error('Spectator could not be removed from given room');
            this.emit('error', [
                `${data.spectatorName} could not be removed from room: ${data.leaveRoomId}`,
            ]);
            return;
        }
        data.spectators = spectators || [];
        this.emit('youHaveLeftTheRoom');
        io.sockets.in(data.leaveRoomId).emit('spectatorLeftRoom', data);
    } else {
        console.error(
            `Spectator ${data.spectatorName} could not be removed from given room`,
        );
        this.emit('error', [
            `Spectator ${data.spectatorName} could not be removed from room: ${data.leaveRoomId}`,
        ]);
    }
}

async function playerInitialBoard(
    this: Socket,
    {
        playerName,
        myPositions,
        room: gid,
    }: {
        playerName: string;
        myPositions: Board;
        room: string;
    },
) {
    console.info(`playerInitialBoard from ${playerName} on socket ${this.id}`);
    const result = await submitInitialBoard(gid, playerName, myPositions);
    if (!result.ok) {
        this.emit('error', result.errors || [result.reason]);
        return;
    }
    if (!result.complete) {
        this.emit('halfBoardReceived');
        return;
    }
    await broadcastGameState(io, result.game, 'boardSet');
}

async function pieceSelection(
    this: Socket,
    {
        board,
        piece,
        playerName,
        room: gid,
    }: {
        board: Board;
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
        uid: string | null;
        room: string;
        turn: number;
        pendingMove: {
            source: [number, number];
            target: [number, number];
        };
    },
) {
    const result = await applyMove(gid, playerName, uid || null, turn, pendingMove);
    if (!result.ok) {
        this.emit('error', [result.reason]);
        return;
    }

    console.info(`Someone made a move, the turn is now ${result.turn}`);
    await broadcastGameState(io, result.game, 'playerMadeMove');

    if (result.winnerIndex !== -1) {
        console.info('game ended from victory', result.gameStats);
        io.sockets.in(gid).emit('endGame', {
            winnerIndex: result.winnerIndex,
            gameStats: result.gameStats,
            finalGame: sanitizeGameForClient(result.game),
        });
        return;
    }

    if (result.game.config.opponentType === 'ai') {
        scheduleAiTurn(gid, result.turn);
    }
}

function scheduleAiTurn(gid: string, turn: number) {
    // the AI always occupies the second seat
    const aiPlayerIndex = 1;
    if (turn % 2 !== aiPlayerIndex) {
        return;
    }
    const delayMs = 400 + Math.random() * 500;
    setTimeout(() => {
        runAiTurn(gid, turn).catch((err) =>
            console.error(`AI turn failed for game ${gid}:`, err),
        );
    }, delayMs);
}

async function runAiTurn(gid: string, turn: number) {
    const myGame = await getGameById(gid);
    if (!myGame || !myGame.board) {
        return;
    }
    const aiPlayerIndex = myGame.players.indexOf(AI_PLAYER_NAME);
    if (aiPlayerIndex === -1) {
        return;
    }

    const fogged = myGame.config.fogOfWar
        ? emplaceBoardFog(
              myGame as unknown as { board: Piece[][]; deadPieces: Piece[] },
              aiPlayerIndex,
          )
        : myGame;
    const move = chooseAiMove(fogged.board as Board, aiPlayerIndex);

    if (!move) {
        // AI has no legal moves - treat it as a forfeit (a pre-existing gap
        // in winner() means human-vs-human stalemates aren't handled either,
        // this just makes the case reachable and resolves it the same way)
        const winnerIndex = aiPlayerIndex === 0 ? 1 : 0;
        const gameStats = await getGameStats(gid);
        await updateGame(gid, {
            winnerId:
                myGame.playerToUidMap.get(myGame.players[winnerIndex]) ||
                'anonymous',
            phase: 3,
        });
        io.sockets.in(gid).emit('endGame', { winnerIndex, gameStats });
        return;
    }

    const result = await applyMove(gid, AI_PLAYER_NAME, null, turn, {
        source: move.source,
        target: move.target,
    });
    if (!result.ok) {
        console.error(`AI move could not be applied for game ${gid}:`, result.reason);
        return;
    }

    await broadcastGameState(io, result.game, 'playerMadeMove');
    if (result.winnerIndex !== -1) {
        console.info('game ended from victory (AI)', result.gameStats);
        io.sockets.in(gid).emit('endGame', {
            winnerIndex: result.winnerIndex,
            gameStats: result.gameStats,
            finalGame: sanitizeGameForClient(result.game),
        });
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
        phase: 3,
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
