"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var Schema = _mongoose["default"].Schema;
var Piece = new Schema({
  name: String,
  rank: String,
  visible: Boolean,
  affiliation: String,
  imageURL: String
});
var _default = Piece;
exports["default"] = _default;