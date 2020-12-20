"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var Schema = _mongoose["default"].Schema;
var Board = new Schema({
  name: String,
  positions: Array,
  playerOnePositions: Array,
  playerTwoPositions: Array
});
var _default = Board;
exports["default"] = _default;