const Game = require('../models/Game');

/**
 * creates a Game in the database and returns
 * @param {Object} { room, host } the room ID and host player name
 * @returns {Object} the Game object as defined in Game.js
 * @see createGame
 */

const createGame = async ({
  room, host,
}) => {
  const game = await new Game();
  game.room = room;
  game.host = host;
  game.players = [host];
  game.moves = [];
  game.turn = 0;
  game.board = new Array(13).fill(null).map(() => (new Array(5).fill(null)));
  let updatedGame = null;
  await game.save().then(() => {
    console.log(`Game ${room} saved in MongoDB`);
    console.log(game);
    updatedGame = game;
  }).catch((err) => {
    console.error(err);
  });
  return updatedGame;
};

/**
 * adds a player to a Game in the database and returns the updated game or null
 * @param {Object} { room, playerName } the room ID and joining player name
 * @returns {Object} the updated Game object as defined in Game.js on success
 * @returns {null} on failure
 * @see addPlayer
 */

const addPlayer = async ({ room, playerName }) => {
  try {
    const myGame = await Game.find({ room });
    if (myGame.length > 0) {
    // assume only one result, take first one
      const playerArray = myGame[0].players;
      playerArray.push(playerName);
      await Game.findOneAndUpdate({ room }, { ...myGame, players: playerArray });
      const myUpdatedGame = await Game.find({ room });
      return myUpdatedGame;
    }
    console.error('Game not found');
    return null;
  } catch (error) {
    console.error(error);
    return null;
  }
};

/**
 * takes room and returns array of players in that room
 * @param {string} room the room ID
 * @returns {Array<Object>} an array of objects with {int: playerName}
 * @see getPlayers
 */
const getPlayers = async (room) => {
  const myGame = await Game.find({ room });
  if (myGame) {
    return myGame[0].players;
  }
  throw Error;
};

/**
 * takes playerName, room number, and turn number and returns turn validity
 * @param {Object} { playerName, gameId, turn } the player name, the room ID, and the global turn
 * @returns {boolean} indicates whether the player made a move during their turn
 * @see isPlayerTurn
 */
const isPlayerTurn = async ({ playerName, gameId, turn }) => {
  const myGame = await Game.find({ room: gameId });
  /** assume the first matching game found is the only result, and that it is correct
   * assume that there are only two players, arrange by odd / even
   * */
  const playerId = myGame[0].players.indexOf(playerName);
  return turn % 2 === playerId;
};

module.exports = {
  createGame, addPlayer, getPlayers, isPlayerTurn,
};
