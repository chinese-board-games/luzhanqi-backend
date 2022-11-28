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
}: {
    room: string;
    host: string;
}) => {
    const game = await new Game();
    game.room = room;
    game.host = host;
    game.players = [host];
    game.moves = [];
    game.turn = 0;
    game.board = null;
    let updatedGame = null;
    await game
        .save()
        .then(() => {
            console.log(`Game ${room} saved in MongoDB`);
            updatedGame = game;
        })
        .catch((err) => {
            console.error(err);
        });
    return updatedGame;
};

export const getGame = async (room: string) => {
    const myGame = await Game.find({ room });
    if (myGame) {
        return myGame[0];
    }
    throw Error('Game not found');
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
}: {
    room: string;
    playerName: string;
}) => {
    const myGame = await getGame(room);
    if (myGame) {
        // assume only one result, take first one
        const playerArray = myGame.players;
        playerArray.push(playerName);
        await Game.findOneAndUpdate(
            { room },
            { ...myGame, players: playerArray },
        );
        const myUpdatedGame = await getGame(room);
        return myUpdatedGame;
    }
    throw Error('Game not found');
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
    throw Error;
};

export const getMoveHistory = async (room: string) => {
    const myGame = await getGame(room);
    if (myGame) {
        return myGame.moves;
    }
    throw Error;
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