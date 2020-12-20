import Board from '../models/Board';

// the player will call this to start a new game
export const newGame = () => {
  const board = new Board();

  // initialize camp locations
  board.camps = [[2, 1], [2, 3], [4, 1], [4, 3], [8, 1], [8, 3],
    [10, 1], [10, 3], [3, 2], [9, 2]];

  // initialize rail tiles
  board.rails = [];
  [0, 4].forEach((y) => {
    for (let x = 1; x < 11; x += 1) {
      board.rails.push([y, x]);
    }
  });
  [1, 5, 7, 11].forEach((y) => {
    for (let x = 1; x < 3; x += 1) {
      board.rails.push([y, x]);
    }
  });

  // initialize empty player positions
  board.playerOnePositions = [];
  board.playerTwoPositionsy = [];
};

// check whether the board is valid
const validate = (board) => true;

// take two arrays provided by players and return a board
const placePieces = (arr1, arr2) => {
  const mountainRow = [null, 'mountain', null, 'mountain', null];
  const board = arr1 + mountainRow + arr2;
  if (!validate(board)) {
    return false;
  }
  return board;
};

// process one player's placement of pieces, return board if complete, else null
export const processPlayerPlacement = (board, arr, player) => {
  let startingBoard = null;
  if (player === 1) {
    board.playerOnePositions = arr;
  } else if (player === 2) {
    board.playerTwoPositions = arr;
  }

  if (board.playerOnePositions.length > 0 && board.playerTwoPositions.length > 0) {
    startingBoard = placePieces(board.playerOnePositions, board.playerTwoPositions);
  }
  return startingBoard;
};

const isRail = (board, y, x) => board.rails.includes([y, x]);

const isCamp = (board, y, x) => board.camps.includes([y, x]);

// TODO: returns the victor, null if neither
const winner = (board) => null;
