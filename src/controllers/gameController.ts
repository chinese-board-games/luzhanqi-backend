import Game from '../models/Game';

/**
 * creates a Game in the database and returns
 * @param {Object} { room, host } the room ID and host player name
 * @returns {Object} the Game object as defined in Game.js
 * @see createGame
 */

export const createGame = async ({
    room,
    host,
    hostId,
    playerToSocketIdMap,
}: {
    room: string;
    host: string;
    hostId: string;
    playerToSocketIdMap: Map<string, string>;
}) => {
    const game = new Game();
    game.room = room;
    game.host = host;
    game.hostId = hostId;
    game.players = [host];
    game.moves = [];
    game.turn = 0;
    game.board = null;
    game.winnerId = null;
    game.playerToSocketIdMap = playerToSocketIdMap;

    const savedGame = await game.save();
    if (savedGame) {
        console.info(`Game ${room} saved in MongoDB`);
        return savedGame;
    } else {
        console.error('Game not saved');
    }
};

export const getGame = async (room: string) => {
    const myGame = await Game.findOne({ room });
    if (myGame) {
        return myGame;
    }
    console.error('Game not found');
};

export const getGameById = async (id: string) => {
    try {
        const myGame = await Game.findById(id);
        if (myGame) {
            return myGame;
        }
    } catch (err) {
        console.error(err);
    }

    console.error('Game not found');
};

/**
 * adds a player to a Game in the database and returns the updated game or null
 * @param {Object} { room, playerName } the room ID and joining player name
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see addPlayer
 */

export const addPlayer = async ({
    room,
    playerName,
    clientId,
    mySocketId,
}: {
    room: string;
    playerName: string;
    clientId: string | null;
    mySocketId: string;
}) => {
    console.info(
        `Adding player ${playerName} to game ${room} with client ID ${clientId}`,
    );

    const myGame = await getGame(room);
    if (myGame) {
        // assume only one result, take first one
        const { players, playerToSocketIdMap } = myGame;
        players.push(playerName);
        playerToSocketIdMap.set(playerName, mySocketId);
        await Game.findOneAndUpdate(
            { room },
            { $set: { clientId }, players, playerToSocketIdMap },
        );
        const myUpdatedGame = await getGame(room);
        console.info(`Updated game: ${myUpdatedGame}`);
        return myUpdatedGame;
    }
    console.error('Game not found');
};

/**
 * takes room and returns array of players in that room
 * @param {string} room the room ID
 * @returns {Array<Object>} an array of objects with {int: playerName}
 * @see getPlayers
 */
export const getPlayers = async (room: string) => {
    const myGame = await getGame(room);
    if (myGame) {
        return myGame.players;
    }
    console.error('Game not found');
};

export const getMoveHistory = async (room: string) => {
    const myGame = await getGame(room);
    if (myGame) {
        return myGame.moves;
    }
    console.error('Game not found');
};

/**
 * takes playerName, room number, and turn number and returns turn validity
 * @param {Object} { playerName, gameId, turn } the player name, the room ID, and the global turn
 * @returns {boolean} indicates whether the player made a move during their turn
 * @see isPlayerTurn
 */
export const isPlayerTurn = async ({
    playerName,
    room,
    turn,
}: {
    playerName: string;
    room: string;
    turn: number;
}) => {
    const myGame = await getGame(room);
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

export const updateBoard = async (room: string, board: any) => {
    await Game.findOneAndUpdate({ room }, { $set: { board } });
};

export const updateGame = async (
    room: string,
    updateFields: Record<string, unknown>,
) => {
    await Game.findOneAndUpdate({ room }, updateFields);
};

export const winner = async (room: any) => {
    const myGame = await Game.findOne({ room });
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
