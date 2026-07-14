import crypto from 'crypto';
import Game, { GameConfigData } from '../models/Game';
import {
    AI_PLAYER_NAME,
    AI_SOCKET_SENTINEL,
    DEFAULT_AI_WEIGHTS,
} from '../utils/aiConstants';

/**
 * generates an opaque random token used to prove ownership of a player's
 * seat when reconnecting to a game (see addClient/playerRejoinRoom)
 * @see generateToken
 */
export const generateToken = (): string => crypto.randomBytes(16).toString('hex');

// excludes visually-ambiguous characters (0/O, 1/I/L) so codes are easy to
// read aloud or retype correctly
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

/**
 * generates a short, human-shareable code (e.g. "7K4X2P") for inviting
 * others to a game, without the collision check `createGame` applies
 * @see generateJoinCode
 */
export const generateJoinCode = (): string => {
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
        code += JOIN_CODE_ALPHABET[crypto.randomInt(JOIN_CODE_ALPHABET.length)];
    }
    return code;
};

/**
 * generates a join code guaranteed not to collide with an existing game's
 * @see generateJoinCode
 */
const generateUniqueJoinCode = async (): Promise<string> => {
    let code = generateJoinCode();
    while (await Game.exists({ joinCode: code })) {
        code = generateJoinCode();
    }
    return code;
};

/**
 * resolves either a real game ObjectId or a short join code to the game's
 * ObjectId string, so callers (join/spectate) can accept either. Returns
 * null if a join code doesn't match any game.
 * @see resolveGameId
 */
export const resolveGameId = async (
    idOrCode: string,
): Promise<string | null> => {
    if (OBJECT_ID_RE.test(idOrCode)) {
        return idOrCode;
    }
    const game = await Game.findOne({ joinCode: idOrCode.toUpperCase() });
    return game ? game._id.toString() : null;
};

/**
 * strips server-internal identity maps (socket ids, uids, reconnection
 * tokens) from a game object before it is sent to any client. Accepts
 * either a Mongoose document or a plain object (e.g. the fogged clone
 * produced by emplaceBoardFog).
 * @see sanitizeGameForClient
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sanitizeGameForClient = (game: any) => {
    const plainGame =
        typeof game?.toObject === 'function' ? game.toObject() : game;
    const {
        playerToTokenMap: _playerToTokenMap,
        playerToUidMap: _playerToUidMap,
        playerToSocketIdMap: _playerToSocketIdMap,
        spectatorToUidMap: _spectatorToUidMap,
        spectatorToSocketIdMap: _spectatorToSocketIdMap,
        ...safeFields
    } = plainGame;
    return safeFields;
};

/**
 * creates a Game in the database and returns
 * @param {Object} { host, playerToUidMap, playerToSocketIdMap } the room ID, uidMap, socketMap
 * @returns {Object} the Game object as defined in Game.js
 * @see createGame
 */

export const createGame = async ({
    host,
    playerToUidMap,
    playerToSocketIdMap,
    gameConfig,
}: {
    host: string;
    playerToUidMap: Map<string, string | null>;
    playerToSocketIdMap: Map<string, string>;
    gameConfig?: Partial<GameConfigData>;
}) => {
    // merge onto defaults rather than relying on a parameter default, since a
    // caller-provided object missing one key (e.g. { opponentType: 'ai' }
    // with no fogOfWar) would otherwise silently leave that key undefined
    const resolvedConfig: GameConfigData = {
        fogOfWar: true,
        opponentType: 'human',
        ...gameConfig,
        aiSettings: { ...DEFAULT_AI_WEIGHTS, ...gameConfig?.aiSettings },
    };
    const joinCode = await generateUniqueJoinCode();
    const game = new Game({
        joinCode,
        players: [host],
        playerToUidMap,
        playerToSocketIdMap,
        playerToTokenMap: new Map([[host, generateToken()]]),
        spectators: [],
        spectatorToUidMap: new Map(),
        spectatorToSocketIdMap: new Map(),
        moves: [],
        turn: 0,
        phase: 0,
        board: null,
        winnerId: null,
        config: resolvedConfig,
    });

    const savedGame = await game.save();
    if (savedGame) {
        console.info(`Game ${game._id.toString()} saved in MongoDB`);
        return savedGame;
    } else {
        console.error('Game not saved');
    }
};

/**
 * fills the second seat with the AI opponent (no real socket) and moves
 * the game straight to the placement phase
 * @see addAiPlayer
 */
export const addAiPlayer = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found');
        return;
    }
    const { players, playerToUidMap, playerToSocketIdMap } = myGame;
    players.push(AI_PLAYER_NAME);
    playerToUidMap.set(AI_PLAYER_NAME, null);
    playerToSocketIdMap.set(AI_PLAYER_NAME, AI_SOCKET_SENTINEL);

    await updateGame(gid, {
        players,
        playerToUidMap,
        playerToSocketIdMap,
        phase: 1,
    });
    return getGameById(gid);
};

export const getGameById = async (gid: string) => {
    try {
        const myGame = await Game.findById(gid);
        if (myGame) {
            return myGame;
        }
    } catch (err) {
        console.error(err);
    }

    console.error('Game not found');
};

export const updateGameUidMap = async (
    gid: string,
    playerName: string,
    uid: string,
) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        const { playerToUidMap } = myGame;
        playerToUidMap.set(playerName, uid);
        await updateGame(gid, { playerToUidMap });
        return myGame;
    }
    console.error('Game not found');
};
export const deleteGame = async (gid: string) => {
    const myGame = await Game.findByIdAndDelete(gid);
    if (myGame) {
        return myGame;
    }
    console.error('Game not found');
};

/**
 * adds a player to a Game in the database and returns the updated game or null
 * @param {Object} { gid, playerName, clientId, mySocketId } the game ID, joining player name, optional clientId if logged in, socketMap
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see addClient
 */

export const addClient = async ({
    gid,
    playerName,
    clientId,
    mySocketId,
}: {
    gid: string;
    playerName: string;
    clientId: string | null;
    mySocketId: string;
}) => {
    console.info(
        `Adding player ${playerName} to game ${gid} with client ID ${clientId}`,
    );

    const myGame = await getGameById(gid);
    if (myGame) {
        // assume only one result, take first one
        const { players, playerToUidMap, playerToSocketIdMap, playerToTokenMap } =
            myGame;
        players.push(playerName);
        playerToUidMap.set(playerName, clientId);
        playerToSocketIdMap.set(playerName, mySocketId);
        playerToTokenMap.set(playerName, generateToken());

        await updateGame(gid, {
            players,
            playerToUidMap,
            playerToSocketIdMap,
            playerToTokenMap,
        });
        const myUpdatedGame = await getGameById(gid);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

/**
 * removes a player from a Game in the database and returns the updated game or null
 * assumes that there is one player other than host
 * @param {Object} { gid, playerName, clientId } the game ID, leaving player name, optional clientId if logged in
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see removePlayer
 */

export const removePlayer = async ({
    gid,
    playerName,
    clientId,
}: {
    gid: string;
    playerName: string;
    clientId: string | null;
}) => {
    console.info(
        `Removing player ${playerName} to game ${gid} with client ID ${clientId}`,
    );

    const myGame = await getGameById(gid);
    if (myGame) {
        // assume only one result, take first one
        const { playerToUidMap, playerToSocketIdMap, playerToTokenMap } = myGame;
        const players = [myGame.players[0]]; // only the host should remain
        playerToUidMap.delete(playerName);
        playerToSocketIdMap.delete(playerName);
        // a deliberately-vacated seat's old reconnection token must stop working
        playerToTokenMap.delete(playerName);

        await updateGame(gid, {
            players,
            playerToUidMap,
            playerToSocketIdMap,
            playerToTokenMap,
        });
        const myUpdatedGame = await getGameById(gid);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

/**
 * takes game ID and returns array of players in the room
 * @param {string} gid the game ID
 * @returns {Array<Object>} an array of objects with {int: playerName}
 * @see getPlayers
 */
export const getPlayers = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        return myGame.players;
    }
    console.error('Game not found');
};

/**
 * adds a spectator to a Game in the database and returns the updated game or null
 * @param {Object} { gid, spectatorName, clientId, mySocketId } the game ID, spectator name, optional clientId if logged in, socketMap
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see addSpectator
 */

export const addSpectator = async ({
    gid,
    spectatorName,
    clientId,
    mySocketId,
}: {
    gid: string;
    spectatorName: string;
    clientId: string | null;
    mySocketId: string;
}) => {
    console.info(
        `Adding spectator ${spectatorName} to game ${gid} with client ID ${clientId}`,
    );

    const myGame = await getGameById(gid);
    if (myGame) {
        // assume only one result, take first one
        const { spectators, spectatorToUidMap, spectatorToSocketIdMap } =
            myGame;
        spectators.push(spectatorName);
        spectatorToUidMap.set(spectatorName, clientId);
        spectatorToSocketIdMap.set(spectatorName, mySocketId);

        await updateGame(gid, {
            spectators,
            spectatorToUidMap,
            spectatorToSocketIdMap,
        });
        const myUpdatedGame = await getGameById(gid);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

/**
 * takes game ID and returns array of spectators in the room
 * @param {string} gid the game ID
 * @returns {Array<Object>} an array of objects with {int: spectatorName}
 * @see getPlayers
 */
export const getSpectators = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        return myGame.spectators;
    }
    console.error('Game not found');
};

/**
 * removes a spectator from a Game in the database and returns the updated game or null
 * @param {Object} { gid, spectatorName, clientId } the game ID, leaving spectator name, optional clientId if logged in
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see removeSpectator
 */

export const removeSpectator = async ({
    gid,
    spectatorName,
    clientId,
}: {
    gid: string;
    spectatorName: string;
    clientId: string | null;
}) => {
    console.info(
        `Removing player ${spectatorName} from game ${gid} with client ID ${clientId}`,
    );

    const myGame = await getGameById(gid);
    if (myGame) {
        // assume only one result, take first one
        const { spectatorToUidMap, spectatorToSocketIdMap } = myGame;
        const spectators = myGame.spectators.filter(
            (eachSpectatorName) => eachSpectatorName !== spectatorName,
        );
        spectatorToUidMap.delete(spectatorName);
        spectatorToSocketIdMap.delete(spectatorName);

        await updateGame(gid, {
            spectators,
            spectatorToUidMap,
            spectatorToSocketIdMap,
        });
        const myUpdatedGame = await getGameById(gid);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

export const getMoveHistory = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        return myGame.moves;
    }
    console.error('Game not found');
};

export const getDeadPieces = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        return myGame.deadPieces;
    }
    console.error('Game not found');
};

/**
 * takes playerName, room number, and turn number and returns turn validity
 * @param {Object} { playerName, gameId, turn } the player name, the game ID, and the global turn
 * @returns {boolean} indicates whether the player made a move during their turn
 * @see isPlayerTurn
 */
export const isPlayerTurn = async ({
    playerName,
    gid,
    turn,
}: {
    playerName: string;
    gid: string;
    turn: number;
}) => {
    const myGame = await getGameById(gid);
    /** assume the first matching game found is the only result, and that it is correct
     * assume that there are only two players, arrange by odd / even
     * */
    if (!myGame) {
        console.error('Game not found.');
        return;
    }
    const playerId = myGame.players.indexOf(playerName);
    return turn % 2 === playerId;
};

export const updateBoard = async (gid: string, board: any) => {
    await updateGame(gid, { $set: { board } });
};

export const updateGame = async (
    gid: string,
    updateFields: Record<string, unknown>,
) => await Game.findByIdAndUpdate(gid, updateFields);

export const winner = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (!myGame) {
        return -1;
    }
    const myBoard = (await myGame.board) as any;

    let flags = 0;
    for (let rowI = 0; rowI < myBoard.length; rowI += 1) {
        const row = myBoard[rowI];
        for (let colI = 0; colI < row.length; colI += 1) {
            const piece = row[colI];
            if (piece === null) {
                // eslint-disable-next-line no-continue
                continue;
            }
            if (piece.name === 'flag') {
                flags += 1;
            }
            if (rowI > 0 && flags < 1) {
                // top half loses (host won)
                console.info('top half loses');
                return 0;
            }
        }
    }
    if (flags < 2) {
        // bottom half loses (guest won)
        console.info('bottom half loses');
        return 1;
    }
    return -1;
};
