const mongoose = 'mongoose';

const { Schema } = mongoose;

const Board = new Schema({
  name: String,
  positions: Array,
  playerOnePositions: Array,
  playerTwoPositions: Array,
});

export default Board;
