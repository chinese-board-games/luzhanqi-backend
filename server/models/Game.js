import mongoose, { Schema } from 'mongoose';

const GameSchema = new Schema({
  room: String,
  host: String,
  players: [],
  moves: [],
}, { timestamps: true });

const GameModel = mongoose.model('Game', GameSchema);

export default GameModel;
