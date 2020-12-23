"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMove = exports.addPlayer = exports.createGame = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

var _Game = _interopRequireDefault(require("../models/Game"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var db = _mongoose["default"].connection;

var createGame = function createGame(_ref) {
  var room = _ref.room,
      host = _ref.host,
      players = _ref.players,
      moves = _ref.moves;
  var game = new _Game["default"]();
  game.room = room;
  game.host = host;
  game.players = players;
  game.moves = moves;
  game.save().then(function () {
    console.log("Game ".concat(room, " saved in MongoDB"));
  })["catch"](function (err) {
    throw err;
  });
};

exports.createGame = createGame;

var addPlayer = function addPlayer(data) {
  var room = data.room,
      playerName = data.playerName;

  var myGame = _Game["default"].find({
    room: room
  });

  var playerArray = myGame.players;
  playerArray.push(playerName);

  _Game["default"].findOneAndUpdate({
    room: room
  }, _objectSpread(_objectSpread({}, myGame), {}, {
    players: playerArray
  })).then(function () {
    console.log("".concat(playerName, " added to game ").concat(room));
  });
};

exports.addPlayer = addPlayer;

var makeMove = function makeMove(data) {};

exports.makeMove = makeMove;