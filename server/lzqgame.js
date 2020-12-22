/* eslint-disable no-console */
/* eslint-disable func-names */
/* eslint-disable no-use-before-define */

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(':memory:', ((err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the in-memory SQlite database.');
  return null;
}));

db.run(
  `CREATE TABLE players (
    playername TEXT,
    game TEXT
    );`,
);

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
function hostCreateNewGame({ playerName }) {
  // Create a unique Socket.IO Room
  // eslint-disable-next-line no-bitwise
  const thisGameId = ((Math.random() * 100000) | 0).toString();
  db.serialize(() => {
    // db.run(
    //   `CREATE TABLE players${thisGameId} (playername TEXT);`,
    // );
    db.run(
      'INSERT INTO players (playername, game) VALUES (?, ?);', [playerName, thisGameId],
    );
    // db.run(
    //   `INSERT INTO players${thisGameId} (playerName) VALUES ('${playerName}');`,
    // );
    // db.all(`SELECT playername FROM players${thisGameId}`, [], (err, rows) => {
    db.all('SELECT playername FROM players WHERE game=?', [thisGameId], (err, rows) => {
      // Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client
      this.emit('newGameCreated', {
        gameId: thisGameId,
        mySocketId: this.id,
        players: rows,
      });
      console.log(`New game created with ID: ${thisGameId} at socket: ${this.id}`);

      // Join the Room and wait for the players
      this.join(thisGameId);
    });
  });
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
function playerJoinGame(data) {
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
  db.serialize(() => {
    db.run(
      'INSERT INTO players (playerName, game) VALUES (?, ?);', [data.playerName, data.joinRoomId],
    );
    db.all('SELECT playername FROM players WHERE game=?', [data.joinRoomId], (err, rows) => {
      // Emit an event notifying the clients that the player has joined the room.
      data.players = rows;
      io.sockets.in(data.joinRoomId).emit('playerJoinedRoom', data);
    });
  });

//   } else {
  // Otherwise, send an error message back to the player.
  // this.emit('error', { message: 'This room does not exist.' });
//   }
}

function playerMakeMove(data) {
  if (true) { // move validation function
    data.turn += 1;
    console.log(`Someone made a move, the turn is now ${data.turn}`);
  }
  console.log(`Sending back gameState on ${data.gameId}`);
  io.sockets.in(data.gameId).emit('playerMadeMove', data);
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
