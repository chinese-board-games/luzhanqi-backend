/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-use-before-define */
const {
  createGame, addPlayer, getPlayers, isPlayerTurn, getGame, updateBoard,
} = require('./controllers/gameController');

let io;
let gameSocket;

exports.initGame = function (sio, socket) {
  io = sio;
  gameSocket = socket;
  gameSocket.emit('connected', { message: 'You are connected!' });

  // Host events
  gameSocket.on('hostCreateNewGame', hostCreateNewGame);
  gameSocket.on('hostRoomFull', hostPrepareGame);

  // Player Events
  gameSocket.on('playerJoinGame', playerJoinGame);
  gameSocket.on('playerRestart', playerRestart);
  gameSocket.on('makeMove', playerMakeMove);
  gameSocket.on('playerInitialBoard', playerInitialBoard);
};

/* *******************************
   *                             *
   *       HOST FUNCTIONS        *
   *                             *
   ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
async function hostCreateNewGame({ playerName }) {
  // Create a unique Socket.IO Room
  // eslint-disable-next-line no-bitwise
  const thisGameId = ((Math.random() * 100000) | 0).toString();
  const myGame = await createGame({
    room: thisGameId,
    host: playerName,
  });
  console.log(myGame);
  if (myGame) {
    this.emit('newGameCreated', {
      gameId: thisGameId,
      mySocketId: this.id,
      players: await getPlayers(thisGameId),
    });
    console.log(`New game created with ID: ${thisGameId} at socket: ${this.id}`);

    // Join the Room and wait for the players
    this.join(thisGameId);
  } else {
    console.error('Game was not created.');
  }
}

/**
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
function hostPrepareGame(gameId) {
  const sock = this;
  const data = {
    mySocketId: sock.id,
    gameId,
    turn: 0,
  };
  console.log(`All players present. Preparing game ${data.gameId}`);
  io.in(data.gameId).emit('beginNewGame', data);
}

/**
 * A player clicked the 'Join Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
async function playerJoinGame(data) {
  console.log(`Player ${data.playerName} attempting to join game: ${data.joinRoomId}`);

  // A reference to the player's Socket.IO socket object
  const sock = this;

  const existingPlayers = await getPlayers(data.joinRoomId);

  if (existingPlayers.includes(data.playerName)) {
    sock.emit('error', 'There is already a player in this game by that name. Please choose another.');
  } else {
    console.log(`Room: ${data.joinRoomId}`);
    // attach the socket id to the data object.
    data.mySocketId = sock.id;

    // Join the room
    sock.join(data.joinRoomId);

    console.log(`Player ${data.playerName} joining game: ${data.joinRoomId}`);

    const myUpdatedGame = await addPlayer({
      room: data.joinRoomId,
      playerName: data.playerName,
    });
    if (myUpdatedGame) {
      data.players = await getPlayers(data.joinRoomId);
      io.sockets.in(data.joinRoomId).emit('playerJoinedRoom', data);
      sock.emit('youHaveJoinedTheRoom');
    } else {
      console.error('Player could not be added to given game');
      sock.emit('error', `${data.playerName} could not be added to game: ${data.joinRoomId}`);
    }
  }
}

async function playerInitialBoard({ playerName, myPositions, room }) {
  // A reference to the player's Socket.IO socket object
  const sock = this;

  console.log('Positions follow');
  console.log(myPositions);
  let myGame = await getGame(room);
  const playerIndex = myGame.players.indexOf(playerName);
  if (myGame.board === null) {
    let halfGameBoard;
    if (playerIndex === 0) { // the host
      console.log('Confirmed host');
      halfGameBoard = myPositions;
    } else if (playerIndex === 1) { // the guest
      halfGameBoard = myPositions.reverse();
    }
    console.log('Awaiting updateBoard');
    console.log('room');
    console.log(room);
    console.log('halfGameBoard');
    console.log(halfGameBoard);
    await updateBoard(room, halfGameBoard);
    sock.emit('halfBoardReceived');
  } else if (myGame.board.length === 6) { // only half of the board is filled
    let completeGameBoard;
    if (playerIndex === 0) { // the host
      completeGameBoard = myGame.board.concat(myPositions);
    } else if (playerIndex === 1) { // the guest
      completeGameBoard = myPositions.reverse().concat(myGame.board);
    }
    await updateBoard(room, completeGameBoard);
    myGame = await getGame(room);
    io.sockets.in(room).emit('boardSet', myGame);
  }
}

async function playerMakeMove(data) {
  if (await isPlayerTurn(data)) { // move validation function
    data.turn += 1;
    console.log(`Someone made a move, the turn is now ${data.turn}`);
    console.log(`Sending back gameState on ${data.gameId}`);
    io.sockets.in(data.gameId).emit('playerMadeMove', data);
  } else {
    this.emit('error', 'It is not your turn.');
  }
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
  // console.log('Player: ' + data.playerName + ' ready for new game.');

  // Emit the player's data back to the clients in the game room.
  data.playerId = this.id;
  io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}
