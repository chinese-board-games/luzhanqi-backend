const mongoose = require('mongoose');

const { Schema } = mongoose;

const PieceSchema = new Schema({
    name: String,
    affiliation: String,
    order: Number,
    kills: Number,
});

const PieceModel = mongoose.model('Game', PieceSchema);

module.exports = PieceModel;
