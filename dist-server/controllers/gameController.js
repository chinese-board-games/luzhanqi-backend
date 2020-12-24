"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPlayers = exports.addPlayer = exports.createGame = void 0;

var _Game = _interopRequireDefault(require("../models/Game"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var createGame = /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_ref) {
    var room, host, game, updatedGame;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            room = _ref.room, host = _ref.host;
            _context.next = 3;
            return new _Game["default"]();

          case 3:
            game = _context.sent;
            game.room = room;
            game.host = host;
            game.players = [host];
            game.moves = [];
            game.turn = 0;
            updatedGame = null;
            _context.next = 12;
            return game.save().then(function () {
              console.log("Game ".concat(room, " saved in MongoDB"));
              console.log(game);
              updatedGame = game;
            })["catch"](function (err) {
              console.error(err);
            });

          case 12:
            return _context.abrupt("return", updatedGame);

          case 13:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function createGame(_x) {
    return _ref2.apply(this, arguments);
  };
}();

exports.createGame = createGame;

var addPlayer = /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(data) {
    var room, playerName, myGame, playerArray, myUpdatedGame;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            room = data.room, playerName = data.playerName;
            _context2.prev = 1;
            _context2.next = 4;
            return _Game["default"].find({
              room: room
            });

          case 4:
            myGame = _context2.sent;

            if (!(myGame.length > 0)) {
              _context2.next = 14;
              break;
            }

            // assume only one result, take first one
            playerArray = myGame[0].players;
            playerArray.push(playerName);
            _context2.next = 10;
            return _Game["default"].findOneAndUpdate({
              room: room
            }, _objectSpread(_objectSpread({}, myGame), {}, {
              players: playerArray
            })).then(function () {
              console.log("".concat(playerName, " added to game ").concat(room));
            });

          case 10:
            _context2.next = 12;
            return _Game["default"].find({
              room: room
            });

          case 12:
            myUpdatedGame = _context2.sent;
            return _context2.abrupt("return", myUpdatedGame);

          case 14:
            console.error('Game not found');
            return _context2.abrupt("return", null);

          case 18:
            _context2.prev = 18;
            _context2.t0 = _context2["catch"](1);
            console.error(_context2.t0);
            return _context2.abrupt("return", null);

          case 22:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, null, [[1, 18]]);
  }));

  return function addPlayer(_x2) {
    return _ref3.apply(this, arguments);
  };
}(); // takes room and returns array of players in that room


exports.addPlayer = addPlayer;

var getPlayers = /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(room) {
    var myGame;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return _Game["default"].find({
              room: room
            });

          case 2:
            myGame = _context3.sent;

            if (!myGame) {
              _context3.next = 5;
              break;
            }

            return _context3.abrupt("return", myGame[0].players);

          case 5:
            throw Error;

          case 6:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));

  return function getPlayers(_x3) {
    return _ref4.apply(this, arguments);
  };
}();

exports.getPlayers = getPlayers;