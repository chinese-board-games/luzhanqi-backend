import mongoose from 'mongoose';
import Game from '../models/Game';

const db = mongoose.connection;

export const createGame = ({
  room, host, players, moves,
}) => {
  const game = new Game();
  game.room = room;
  game.host = host;
  game.players = players;
  game.moves = moves;
  game.save().then(() => {
    console.log(`Game ${room} saved in MongoDB`);
  }).catch((err) => {
    throw err;
  });
};

export const addPlayer = (data) => {
  const { room, playerName } = data;
  const myGame = Game.find({ room });
  const playerArray = myGame.players;
  playerArray.push(playerName);
  Game.findOneAndUpdate({ room }, { ...myGame, players: playerArray }).then(() => {
    console.log(`${playerName} added to game ${room}`);
  });
};

export const makeMove = (data) => {

};
