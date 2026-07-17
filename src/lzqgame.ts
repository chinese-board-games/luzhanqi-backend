import { inspect } from 'util';
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
    resolveGameId,
} from './controllers/gameController';
import { addGame, removeGame, getUser } from './controllers/userController';
import {
    applyMove,
    submitInitialBoard,
    submitAiInitialBoard,
    broadcastGameState,
    getGameStats,
    GameStats,
} from './services/gameplayService';
import { getSuccessors, emplaceBoardFog, verifyIdToken } from './utils';
import { chooseAiMove } from './utils/aiPlayer';
import { AI_PLAYER_NAME, DEFAULT_AI_WEIGHTS } from './utils/aiConstants';
import { Board, Piece } from './types';

let io: Server;
let gameSocket: Socket;

// tracks which (gid, playerName) seat a live socket currently occupies - two
// jobs: announcing a disconnect to the room, and (see verifyOwnsSeat) proof
// that a socket claiming to act as some playerName actually is that seat,
// so one connected client can't submit moves/forfeit/setup as someone else
// just by naming them. Reconnection itself is handled by the DB-backed
// token, not this in-memory registry.
const socketSeatRegistry = new Map<string, { gid: string; playerName: string }>();

// console.log/info's default inspection depth is 2, but gameStats is an
// array of per-player arrays of piece-count objects - 3 levels deep - so
// this needs depth: null to print every level in full.
export const formatGameStats = (gameStats: GameStats | null) =>
    inspect(gameStats, { depth: null });

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
    gameSocket.on('getMyActiveGames', getMyActiveGames);
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

// sentinel distinguishing "token verification failed" from a legitimate
// null uid (anonymous play) - callers bail out on this without proceeding,
// since a present-but-invalid token is treated as an error, never silently
// downgraded to anonymous (see verifyIdToken)
const TOKEN_INVALID = Symbol('TOKEN_INVALID');

/**
 * Verifies an optional Firebase ID token for a socket event handler. Emits
 * an 'error' event and returns TOKEN_INVALID on failure, so callers can bail
 * out early with `if (uid === TOKEN_INVALID) return;`.
 * @see resolveUid
 */
async function resolveUid(
    socket: Socket,
    idToken: string | null | undefined,
): Promise<string | null | typeof TOKEN_INVALID> {
    try {
        return await verifyIdToken(idToken);
    } catch (err) {
        console.error('Token verification failed:', err);
        socket.emit('error', [
            'Your session could not be verified. Please sign in again.',
        ]);
        return TOKEN_INVALID;
    }
}

/**
 * Verifies the calling socket actually occupies the seat it claims to act
 * as (set by hostCreateNewGame/playerJoinRoom/playerRejoinRoom - see
 * socketSeatRegistry), so one connected client can't submit a move,
 * forfeit, or setup as a different player just by naming them in the
 * payload. Emits an 'error' event and returns false on mismatch, so
 * callers can bail out early with `if (!verifyOwnsSeat(...)) return;`.
 * @see verifyOwnsSeat
 */
function verifyOwnsSeat(socket: Socket, gid: string, playerName: string): boolean {
    const seat = socketSeatRegistry.get(socket.id);
    if (seat?.gid === gid && seat?.playerName === playerName) {
        return true;
    }
    socket.emit('error', [
        `You do not have permission to act as ${playerName} in this game.`,
    ]);
    return false;
}

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
        idToken,
        gameConfig,
    }: {
        playerName: string;
        idToken?: string | null;
        gameConfig?: Partial<GameConfigData>;
    },
) {
    const hostId = await resolveUid(this, idToken);
    if (hostId === TOKEN_INVALID) return;

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
            joinCode: finalGame.joinCode,
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
    // only the host (always players[0] - see createGame) may start the
    // game or set its rule config; the client-side "Room Full" button is
    // already host-only UI, but that alone doesn't stop a socket from
    // emitting this event directly
    const myGame = await getGameById(gid);
    const host = myGame?.players[0];
    if (!host || !verifyOwnsSeat(this, gid, host)) {
        return;
    }

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
        idToken?: string | null;
        joinRoomId: string;
        mySocketId: string;
        players: string[];
        spectators: string[];
    },
) {
    const clientId = await resolveUid(this, data.idToken);
    if (clientId === TOKEN_INVALID) return;
    data.clientId = clientId;

    console.info(
        `Player ${data.playerName} attempting to join room: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    // data.joinRoomId may be either a real game ObjectId or a short join code
    const resolvedGid = await resolveGameId(data.joinRoomId);
    if (!resolvedGid) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room code.',
        ]);
        return;
    }
    data.joinRoomId = resolvedGid;

    const existingPlayers = await getPlayers(data.joinRoomId);
    if (!existingPlayers) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room code.',
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
                joinCode: myUpdatedGame.joinCode,
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
        idToken,
    }: {
        gameId: string;
        playerName?: string;
        token?: string;
        idToken?: string | null;
    },
) {
    console.info(
        `Player ${playerName || '(unknown)'} attempting to rejoin room: ${gameId} on socket id: ${this.id}`,
    );

    const myGame = await getGameById(gameId);
    if (!myGame) {
        this.emit('rejoinFailed', { gameId, reason: 'game-not-found' });
        return;
    }

    // proof of seat ownership is either the token issued to this device at
    // join time, or - for a device that's never seen this game before -
    // a Firebase-verified uid matching the one recorded for a seat when it
    // joined (never the raw client-asserted uid). The session-token path is
    // tried first and doesn't touch idToken at all, so a transient token-
    // verification hiccup never blocks a rejoin that would have succeeded
    // via the session token alone.
    let resolvedPlayerName: string | undefined;
    if (
        playerName &&
        token &&
        myGame.players.includes(playerName) &&
        myGame.playerToTokenMap.get(playerName) === token
    ) {
        resolvedPlayerName = playerName;
    } else {
        const uid = await resolveUid(this, idToken);
        if (uid === TOKEN_INVALID) return;
        if (uid) {
            resolvedPlayerName = myGame.players.find(
                (p) => myGame.playerToUidMap.get(p) === uid,
            );
        }
    }

    if (!resolvedPlayerName) {
        this.emit('rejoinFailed', { gameId, reason: 'invalid-session' });
        return;
    }
    playerName = resolvedPlayerName;

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
        // once the game has ended (phase 3), reveal the full board on
        // rejoin instead of continuing to fog it - matches the live
        // in-progress endGame broadcast, which already sends the unfogged
        // finalGame (see broadcastGameState)
        const view =
            myGame.config.fogOfWar && myGame.phase !== 3
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
        winnerIndex = await winner(gameId, myGame);
        gameStats = await getGameStats(gameId, myGame);
    }

    this.emit('youHaveRejoinedTheRoom', {
        gameId,
        playerName,
        // always included (not just for the uid-fallback path) so a device
        // that rejoined via uid alone caches this seat's token for next time
        token: myGame.playerToTokenMap.get(playerName),
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
        config: myGame.config,
    });
    io.sockets.in(gameId).emit('playerReconnected', { playerName });
}

type ActiveGameSummary = {
    gameId: string;
    yourPlayerName: string;
    opponentName: string | null;
    isAiGame: boolean;
};

/**
 * Lets a logged-in user discover an in-progress game tied to their account
 * worth rejoining (e.g. from a different device that has no localStorage
 * session for them). A game is durable in Mongo regardless of who's
 * currently connected, so "worth rejoining" is purely: not ended, and not
 * dismissed via archiveGame. Only the single most recently updated such
 * game is returned - older ones are still visible in full game history.
 */
async function getMyActiveGames(
    this: Socket,
    { idToken }: { idToken?: string | null },
) {
    const uid = await resolveUid(this, idToken);
    if (uid === TOKEN_INVALID) return;
    if (!uid) {
        this.emit('myActiveGames', []);
        return;
    }

    const myUser = await getUser(uid);
    const gameIds = myUser?.games || [];
    const archivedGameIds = new Set(myUser?.archivedGames || []);
    let mostRecent: (ActiveGameSummary & { updatedAt: Date }) | null = null;

    for (const gid of gameIds) {
        if (archivedGameIds.has(gid)) {
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const myGame = await getGameById(gid);
        if (!myGame || myGame.phase === 3) {
            continue;
        }
        const yourPlayerName = myGame.players.find(
            (p) => myGame.playerToUidMap.get(p) === uid,
        );
        if (!yourPlayerName) {
            continue;
        }
        const yourIndex = myGame.players.indexOf(yourPlayerName);
        const opponentName = myGame.players[1 - yourIndex] ?? null;
        const isAiGame = myGame.config.opponentType === 'ai';
        const updatedAt = (myGame as unknown as { updatedAt: Date }).updatedAt;

        if (!mostRecent || updatedAt > mostRecent.updatedAt) {
            mostRecent = { gameId: gid, yourPlayerName, opponentName, isAiGame, updatedAt };
        }
    }

    this.emit('myActiveGames', mostRecent ? [mostRecent] : []);
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
        idToken?: string | null;
        leaveRoomId: string;
        players: string[];
    },
) {
    const uid = await resolveUid(this, data.idToken);
    if (uid === TOKEN_INVALID) return;
    data.uid = uid;

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
        idToken?: string | null;
        joinRoomId: string;
        mySocketId: string;
        spectators: string[];
        players: string[];
    },
) {
    const clientId = await resolveUid(this, data.idToken);
    if (clientId === TOKEN_INVALID) return;
    data.clientId = clientId;

    console.info(
        `Spectator ${data.spectatorName} attempting to join room: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    // data.joinRoomId may be either a real game ObjectId or a short join code
    const resolvedGid = await resolveGameId(data.joinRoomId);
    if (!resolvedGid) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room code.',
        ]);
        return;
    }
    data.joinRoomId = resolvedGid;

    const existingGame = await getGameById(data.joinRoomId);

    if (!existingGame?.players) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room code.',
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
            this.emit('youAreSpectatingTheRoom', {
                gameId: data.joinRoomId,
                joinCode: myUpdatedGame.joinCode,
            });
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
        idToken?: string | null;
        leaveRoomId: string;
        spectators: string[];
    },
) {
    const uid = await resolveUid(this, data.idToken);
    if (uid === TOKEN_INVALID) return;
    data.uid = uid;

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
    if (!verifyOwnsSeat(this, gid, playerName)) return;

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
    if (!verifyOwnsSeat(this, gid, playerName)) return;

    const myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${gid}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);

    const successors = getSuccessors(board, piece[0], piece[1], playerIndex, {
        flyingBombs: myGame.config?.flyingBombs,
    });
    this.emit('pieceSelected', successors);
}

async function playerMakeMove(
    this: Socket,
    {
        playerName,
        idToken,
        room: gid,
        turn,
        pendingMove,
    }: {
        playerName: string;
        idToken?: string | null;
        room: string;
        turn: number;
        pendingMove: {
            source: [number, number];
            target: [number, number];
        };
    },
) {
    if (!verifyOwnsSeat(this, gid, playerName)) return;

    const uid = await resolveUid(this, idToken);
    if (uid === TOKEN_INVALID) return;

    const result = await applyMove(gid, playerName, uid, turn, pendingMove);
    if (!result.ok) {
        this.emit('error', [result.reason]);
        return;
    }

    console.info(`Someone made a move, the turn is now ${result.turn}`);
    await broadcastGameState(io, result.game, 'playerMadeMove');
    broadcastFieldMarshallDown(gid, result.fieldMarshallDown);

    if (result.winnerIndex !== -1) {
        console.info('game ended from victory', formatGameStats(result.gameStats));
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

// announces to the whole room (players + spectators) that one or both
// field marshals died on the move that just resolved - relevant to both
// sides since the opponent's flag becomes revealed once their field
// marshal falls (see emplaceBoardFog)
function broadcastFieldMarshallDown(
    gid: string,
    fieldMarshallDown: { playerName: string; affiliation: number }[],
) {
    if (fieldMarshallDown.length) {
        io.sockets.in(gid).emit('fieldMarshallDown', fieldMarshallDown);
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
    const move = chooseAiMove(
        fogged.board as Board,
        aiPlayerIndex,
        myGame.config.aiSettings || DEFAULT_AI_WEIGHTS,
        {
            landminesSurvive: myGame.config.landminesSurvive,
            flyingBombs: myGame.config.flyingBombs,
        },
    );

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
    broadcastFieldMarshallDown(gid, result.fieldMarshallDown);
    if (result.winnerIndex !== -1) {
        console.info('game ended from victory (AI)', formatGameStats(result.gameStats));
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
    if (!verifyOwnsSeat(this, gid, playerName)) return;

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
    // unfogged, same as the other endGame emits - the client relies on
    // finalGame to reveal the board once the game is over (see
    // GameContext.jsx's endGame handler); the board itself is unaffected by
    // a forfeit, so myGame (fetched before the phase update above) is still
    // accurate
    io.sockets.in(gid).emit('endGame', {
        winnerIndex,
        gameStats,
        finalGame: sanitizeGameForClient(myGame),
    });
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
