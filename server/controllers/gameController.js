import Game from '../models/Game';

export const createGame = async ({
  room, host,
}) => {
  const game = await new Game();
  game.room = room;
  game.host = host;
  game.players = [host];
  game.moves = [];
  game.turn = 0;
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

export const addPlayer = async (data) => {
  const { room, playerName } = data;
  try {
    const myGame = await Game.find({ room });
    if (myGame.length > 0) {
    // assume only one result, take first one
      const playerArray = myGame[0].players;
      playerArray.push(playerName);
      await Game.findOneAndUpdate({ room }, { ...myGame, players: playerArray }).then(() => {
        console.log(`${playerName} added to game ${room}`);
      });
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

// takes room and returns array of players in that room
export const getPlayers = async (room) => {
  const myGame = await Game.find({ room });
  if (myGame) {
    return myGame[0].players;
  }
  throw Error;
};
