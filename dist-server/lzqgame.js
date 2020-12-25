"use strict";

var _gameController = require("./controllers/gameController");

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var io;
var gameSocket;

exports.initGame = function (sio, socket) {
  io = sio;
  gameSocket = socket;
  gameSocket.emit('connected', {
    message: 'You are connected!'
  }); // Host events

  gameSocket.on('hostCreateNewGame', hostCreateNewGame);
  gameSocket.on('hostRoomFull', hostPrepareGame); // Player Events

  gameSocket.on('playerJoinGame', playerJoinGame);
  gameSocket.on('playerAnswer', playerAnswer);
  gameSocket.on('playerRestart', playerRestart);
  gameSocket.on('makeMove', playerMakeMove);
};
/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */


function hostCreateNewGame(_x) {
  return _hostCreateNewGame.apply(this, arguments);
}
/*
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */


function _hostCreateNewGame() {
  _hostCreateNewGame = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_ref) {
    var playerName, thisGameId, myGame;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            playerName = _ref.playerName;
            // Create a unique Socket.IO Room
            // eslint-disable-next-line no-bitwise
            thisGameId = (Math.random() * 100000 | 0).toString();
            _context.next = 4;
            return (0, _gameController.createGame)({
              room: thisGameId,
              host: playerName
            });

          case 4:
            myGame = _context.sent;
            console.log(myGame);

            if (!myGame) {
              _context.next = 19;
              break;
            }

            _context.t0 = this;
            _context.t1 = thisGameId;
            _context.t2 = this.id;
            _context.next = 12;
            return (0, _gameController.getPlayers)(thisGameId);

          case 12:
            _context.t3 = _context.sent;
            _context.t4 = {
              gameId: _context.t1,
              mySocketId: _context.t2,
              players: _context.t3
            };

            _context.t0.emit.call(_context.t0, 'newGameCreated', _context.t4);

            console.log("New game created with ID: ".concat(thisGameId, " at socket: ").concat(this.id)); // Join the Room and wait for the players

            this.join(thisGameId);
            _context.next = 20;
            break;

          case 19:
            console.error('Game was not created.');

          case 20:
          case "end":
            return _context.stop();
        }
      }
    }, _callee, this);
  }));
  return _hostCreateNewGame.apply(this, arguments);
}

function hostPrepareGame(gameId) {
  var sock = this;
  var data = {
    mySocketId: sock.id,
    gameId: gameId,
    turn: 0
  };
  console.log("All players present. Preparing game ".concat(data.gameId));
  io["in"](data.gameId).emit('beginNewGame', data);
}
/**
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */


function playerJoinGame(_x2) {
  return _playerJoinGame.apply(this, arguments);
}

function _playerJoinGame() {
  _playerJoinGame = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(data) {
    var sock, myUpdatedGame;
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            console.log("Player ".concat(data.playerName, " attempting to join game: ").concat(data.joinRoomId)); // A reference to the player's Socket.IO socket object

            sock = this; //   Look up the room ID in the Socket.IO adapter rooms Set.
            //   const isRoom = await io.of('/').adapter.allRooms().has(data.joinRoomId);
            // If the room exists...
            //   if (isRoom) {

            console.log("Room: ".concat(data.joinRoomId)); // attach the socket id to the data object.

            data.mySocketId = sock.id; // Join the room

            sock.join(data.joinRoomId);
            console.log("Player ".concat(data.playerName, " joining game: ").concat(data.joinRoomId));
            _context2.next = 8;
            return (0, _gameController.addPlayer)({
              room: data.joinRoomId,
              playerName: data.playerName
            });

          case 8:
            myUpdatedGame = _context2.sent;

            if (!myUpdatedGame) {
              _context2.next = 16;
              break;
            }

            _context2.next = 12;
            return (0, _gameController.getPlayers)(data.joinRoomId);

          case 12:
            data.players = _context2.sent;
            io.sockets["in"](data.joinRoomId).emit('playerJoinedRoom', data);
            _context2.next = 18;
            break;

          case 16:
            console.error('Player could not be added to given game');
            sock.emit('error', "".concat(data.playerName, " could not be added to game: ").concat(data.joinRoomId));

          case 18:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2, this);
  }));
  return _playerJoinGame.apply(this, arguments);
}

function playerMakeMove(_x3) {
  return _playerMakeMove.apply(this, arguments);
}
/**
 * A player has tapped a word in the word list.
 * @param data gameId
 */


function _playerMakeMove() {
  _playerMakeMove = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(data) {
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return (0, _gameController.isPlayerTurn)(data);

          case 2:
            if (!_context3.sent) {
              _context3.next = 9;
              break;
            }

            // move validation function
            data.turn += 1;
            console.log("Someone made a move, the turn is now ".concat(data.turn));
            console.log("Sending back gameState on ".concat(data.gameId));
            io.sockets["in"](data.gameId).emit('playerMadeMove', data);
            _context3.next = 10;
            break;

          case 9:
            this.emit('error', 'It is not your turn.');

          case 10:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3, this);
  }));
  return _playerMakeMove.apply(this, arguments);
}

function playerAnswer(data) {
  // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);
  // The player's answer is attached to the data object.  \
  // Emit an event with the answer so it can be checked by the 'Host'
  io.sockets["in"](data.gameId).emit('hostCheckAnswer', data);
}
/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */


function playerRestart(data) {
  // console.log('Player: ' + data.playerName + ' ready for new game.');
  // Emit the player's data back to the clients in the game room.
  data.playerId = this.id;
  io.sockets["in"](data.gameId).emit('playerJoinedRoom', data);
}