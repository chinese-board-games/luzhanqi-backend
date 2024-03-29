import Game, { GameConfigData } from '../models/Game';

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
    gameConfig = { fogOfWar: true },
}: {
    host: string;
    playerToUidMap: Map<string, string | null>;
    playerToSocketIdMap: Map<string, string>;
    gameConfig: GameConfigData;
}) => {
    const game = new Game({
        players: [host],
        playerToUidMap,
        playerToSocketIdMap,
        moves: [],
        turn: 0,
        board: null,
        winnerId: null,
        config: gameConfig,
    });

    const savedGame = await game.save();
    if (savedGame) {
        console.info(`Game ${game._id.toString()} saved in MongoDB`);
        return savedGame;
    } else {
        console.error('Game not saved');
    }
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
        const { players, playerToUidMap, playerToSocketIdMap } = myGame;
        players.push(playerName);
        playerToUidMap.set(playerName, clientId);
        playerToSocketIdMap.set(playerName, mySocketId);

        await updateGame(gid, { players, playerToUidMap, playerToSocketIdMap });
        const myUpdatedGame = await getGameById(gid);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

/**
 * removes a player from a Game in the database and returns the updated game or null
 * assumes that there is one player other than host
 * @param {Object} { gid, playerName, clientId } the game ID, joining player name, optional clientId if logged in
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see addClient
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
        const { playerToUidMap, playerToSocketIdMap } = myGame;
        const players = [myGame.players[0]]; // only the host should remain
        playerToUidMap.delete(playerName);
        playerToSocketIdMap.delete(playerName);

        await updateGame(gid, { players, playerToUidMap, playerToSocketIdMap });
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

export const getMoveHistory = async (gid: string) => {
    const myGame = await getGameById(gid);
    if (myGame) {
        return myGame.moves;
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
