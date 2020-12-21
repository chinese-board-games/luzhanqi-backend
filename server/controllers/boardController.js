import { validate } from 'graphql';
import Board from '../models/Board';
import sampleBoard from './sampleBoard';

// the player will call this to start a new game
export const generateEmptyBoard = () => {
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
  return board;
};

// check whether the board is valid
const validateSide = (arr, board) => {
  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 5; x += 1) {
      // the position is not in a camp
      if (!board.camps.includes([y, x])) {
        // validate piece placement
        if (arr[y][x] == null) {
          return false;
        }
        // validate landmine placement
        if ((arr[y] !== 4 || arr[y] !== 5) && arr[y][x].name === 'landmine') {
          return false;
        }
        // validate bomb placement
        if (arr[y] === 0 && arr[y][x].name === 'bomb') {
          return false;
        }
        // validate flag placement
        if (arr[5][1].name !== 'flag' && arr[5][3].name !== 'flag') {
          return false;
        }
      }
    }
  }

  return true;
};

// take two arrays provided by players and return a board
const placePieces = (arr1, arr2) => {
  const mountainRow = [null, 'mountain', null, 'mountain', null];
  const boardArr = arr1.reverse() + mountainRow + arr2;
  return boardArr;
};

// process one player's placement of pieces, return board if complete, else null
export const processPlayerPlacement = (board, arr, player) => {
  let startingBoard = null;
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

const isRail = (board, y, x) => board.rails.includes([y, x]);

const isCamp = (board, y, x) => board.camps.includes([y, x]);

// TODO: returns the victor, null if neither
const winner = (board) => null;

// console.log(validateSide(sampleBoard));
