import mongoose from 'mongoose';

const { Schema } = mongoose;

const Piece = new Schema({
  name: String,
  rank: String,
  visible: Boolean,
  affiliation: String,
  imageURL: String,
});

export default Piece;
