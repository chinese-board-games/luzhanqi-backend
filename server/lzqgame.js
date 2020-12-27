/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-use-before-define */
const {
  createGame, addPlayer, getPlayers, isPlayerTurn,
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

/*
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
 * A player clicked the 'START GAME' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
async function playerJoinGame(data) {
  console.log(`Player ${data.playerName} attempting to join game: ${data.joinRoomId}`);

  // A reference to the player's Socket.IO socket object
  const sock = this;

  //   Look up the room ID in the Socket.IO adapter rooms Set.
  //   const isRoom = await io.of('/').adapter.allRooms().has(data.joinRoomId);

  // If the room exists...
  //   if (isRoom) {
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
  } else {
    console.error('Player could not be added to given game');
    sock.emit('error', `${data.playerName} could not be added to game: ${data.joinRoomId}`);
  }

//   } else {
  // Otherwise, send an error message back to the player.
  // this.emit('error', { message: 'This room does not exist.' });
//   }
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
 * A player has tapped a word in the word list.
 * @param data gameId
 */
function playerAnswer(data) {
  // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

  // The player's answer is attached to the data object.  \
  // Emit an event with the answer so it can be checked by the 'Host'
  io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
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
