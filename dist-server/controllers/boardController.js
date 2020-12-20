"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.processPlayerPlacement = exports.newGame = void 0;

var _graphql = require("graphql");

var _Board = _interopRequireDefault(require("../models/Board"));

var _sampleBoard = _interopRequireDefault(require("./sampleBoard"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// the player will call this to start a new game
var newGame = function newGame() {
  var board = new _Board["default"](); // initialize camp locations

  board.camps = [[2, 1], [2, 3], [4, 1], [4, 3], [8, 1], [8, 3], [10, 1], [10, 3], [3, 2], [9, 2]]; // initialize rail tiles

  board.rails = [];
  [0, 4].forEach(function (y) {
    for (var x = 1; x < 11; x += 1) {
      board.rails.push([y, x]);
    }
  });
  [1, 5, 7, 11].forEach(function (y) {
    for (var x = 1; x < 3; x += 1) {
      board.rails.push([y, x]);
    }
  }); // initialize empty player positions

  board.playerOnePositions = [];
  board.playerTwoPositionsy = [];
}; // check whether the board is valid


exports.newGame = newGame;

var validateSide = function validateSide(arr, board) {
  for (var y = 0; y < 5; y += 1) {
    for (var x = 0; x < 5; x += 1) {
      // the position is not in a camp
      if (!board.camps.includes([y, x])) {
        // validate piece placement
        if (arr[y][x] == null) {
          return false;
        } // validate landmine placement


        if ((arr[y] !== 4 || arr[y] !== 5) && arr[y][x].name === 'landmine') {
          return false;
        } // validate bomb placement


        if (arr[y] === 0 && arr[y][x].name === 'bomb') {
          return false;
        } // validate flag placement


        if (arr[5][1].name !== 'flag' && arr[5][3].name !== 'flag') {
          return false;
        }
      }
    }
  }

  return true;
}; // take two arrays provided by players and return a board


var placePieces = function placePieces(arr1, arr2) {
  var mountainRow = [null, 'mountain', null, 'mountain', null];
  var board = arr1.reverse() + mountainRow + arr2;
  return board;
}; // process one player's placement of pieces, return board if complete, else null


var processPlayerPlacement = function processPlayerPlacement(board, arr, player) {
  var startingBoard = null;

  if (!validateSide(arr)) {
    return null;
  }

  if (validateSide(arr, board)) {
    if (player === 1) {
      board.playerOnePositions = arr;
    } else if (player === 2) {
      board.playerTwoPositions = arr;
    }
  } else {
    // invalid piece placement
    return null;
  }

  if (board.playerOnePositions.length > 0 && board.playerTwoPositions.length > 0) {
    startingBoard = placePieces(board.playerOnePositions, board.playerTwoPositions);
  }

  return startingBoard;
};

exports.processPlayerPlacement = processPlayerPlacement;

var isRail = function isRail(board, y, x) {
  return board.rails.includes([y, x]);
};

var isCamp = function isCamp(board, y, x) {
  return board.camps.includes([y, x]);
}; // TODO: returns the victor, null if neither


var winner = function winner(board) {
  return null;
};

console.log(validateSide(_sampleBoard["default"]));