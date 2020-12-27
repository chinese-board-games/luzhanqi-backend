const mongoose = require('mongoose');

const { Schema } = mongoose;

const PieceSchema = new Schema({
  name: String,
  rank: String,
  visible: Boolean,
  affiliation: String,
  imageURL: String,
});

const PieceModel = mongoose.model('Game', PieceSchema);

module.exports = PieceModel;
