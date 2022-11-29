/* eslint-disable @typescript-eslint/no-this-alias */
import {
    createGame,
    addPlayer,
    getPlayers,
    isPlayerTurn,
    getMoveHistory,
    getGame,
    updateBoard,
    updateGame,
    winner,
} from './controllers/gameController';
import { isEqual, cloneDeep } from 'lodash';
import { generateAdjList, getSuccessors } from './utils';

let io;
let gameSocket;
const adjacencyList = generateAdjList();

export const initGame = (sio, socket) => {
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

    // Utility Events
    gameSocket.on('pieceSelection', pieceSelection);
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
    const sock = this;
    const thisGameId = ((Math.random() * 100000) | 0).toString();
    const myGame = await createGame({
        room: thisGameId,
        host: playerName,
    });
    if (myGame) {
        sock.emit('newGameCreated', {
            gameId: thisGameId,
            mySocketId: this.id,
            players: await getPlayers(thisGameId),
        });
        console.log(
            `New game created with ID: ${thisGameId} at socket: ${sock.id}`,
        );

        // Join the Room and wait for the players
        sock.join(thisGameId);
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
    console.log(
        `Player ${data.playerName} attempting to join game: ${data.joinRoomId}`,
    );

    // A reference to the player's Socket.IO socket object
    const sock = this;

    const existingPlayers = await getPlayers(data.joinRoomId);

    if (existingPlayers.includes(data.playerName)) {
        sock.emit(
            'error',
            'There is already a player in this game by that name. Please choose another.',
        );
    } else {
        console.log(`Room: ${data.joinRoomId}`);
        // attach the socket id to the data object.
        data.mySocketId = sock.id;

        // Join the room
        sock.join(data.joinRoomId);

        console.log(
            `Player ${data.playerName} joining game: ${data.joinRoomId}`,
        );

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
            sock.emit(
                'error',
                `${data.playerName} could not be added to game: ${data.joinRoomId}`,
            );
        }
    }
}

async function playerInitialBoard({ playerName, myPositions, room }) {
    // A reference to the player's Socket.IO socket object
    const sock = this;

    let myGame = await getGame(room);
    const playerIndex = myGame.players.indexOf(playerName);
    if (myGame.board === null) {
        let halfGameBoard;
        if (playerIndex === 0) {
            // the host
            console.log('Confirmed host');
            halfGameBoard = myPositions;
        } else if (playerIndex === 1) {
            // the guest
            halfGameBoard = myPositions.reverse();
        }
        await updateBoard(room, halfGameBoard);
        sock.emit('halfBoardReceived');
    } else if (myGame.board.length === 6) {
        // only half of the board is filled
        let completeGameBoard;
        if (playerIndex === 0) {
            // the host
            completeGameBoard = myGame.board.concat(myPositions);
        } else if (playerIndex === 1) {
            // the guest
            completeGameBoard = myPositions.reverse().concat(myGame.board);
        }
        await updateBoard(room, completeGameBoard);
        myGame = await getGame(room);
        io.sockets.in(room).emit('boardSet', myGame);
    }
}

async function pieceSelection({ board, piece, playerName, room }) {
    const sock = this;
    let myGame = await getGame(room);
    const playerIndex = myGame.players.indexOf(playerName);
    const successors = getSuccessors(
        board,
        adjacencyList,
        piece[0],
        piece[1],
        playerIndex,
    );
    sock.emit('pieceSelected', successors);
}

// TODO: this is a utility function to determine which pieces die (if any) on movement
// returns a new board
const pieceMovement = (board, source, target) => {
    // copy the board
    board = cloneDeep(board);

    if (!source.length || !target.length) {
        return board;
    }
    const sourcePiece = board[source[0]][source[1]];
    const targetPiece = board[target[0]][target[1]];

    // there is no piece at the source tile (not a valid move)
    if (
        sourcePiece === null ||
        sourcePiece.name === 'landmine' ||
        sourcePiece.name === 'flag'
    ) {
        return board;
    }

    // pieces are of same affiliation
    if (targetPiece && sourcePiece.affiliation === targetPiece.affiliation) {
        return board;
    }

    if (
        targetPiece &&
        (sourcePiece.name === 'bomb' ||
            sourcePiece.name === targetPiece.name ||
            targetPiece.name === 'bomb' ||
            (sourcePiece.name !== 'engineer' &&
                targetPiece.name === 'landmine'))
    ) {
        // remove both pieces
        board[target[0]][target[1]] = null;
        board[source[0]][source[1]] = null;
    } else if (
        targetPiece === null ||
        sourcePiece.order > targetPiece.order ||
        (sourcePiece.name === 'engineer' && targetPiece.name === 'landmine')
    ) {
        // both pieces die
        // place source piece on target tile, remove source piece from source tile
        board[target[0]][target[1]] = sourcePiece;
        board[source[0]][source[1]] = null;
    } else {
        // kill source piece only
        board[source[0]][source[1]] = null;
    }
    return board;
};

async function playerMakeMove({ playerName, room, turn, pendingMove }) {
    // TODO: add move validation function
    if (
        await isPlayerTurn({
            playerName,
            room,
            turn,
        })
    ) {
        let myGame = await getGame(room);
        const myBoard = myGame.board;
        const { source, target } = pendingMove;
        const newBoard = pieceMovement(myBoard, source, target);
        if (isEqual(newBoard, myBoard)) {
            this.emit('error', 'No move made.');
        } else {
            turn += 1;
            await updateBoard(room, newBoard);
            const moveHistory = await getMoveHistory(room);
            await updateGame(room, {
                turn,
                moves: [...moveHistory, pendingMove],
            });
            myGame = await getGame(room);
            console.log(`Someone made a move, the turn is now ${turn}`);
            console.log(`Sending back gameState on ${room}`);
            io.sockets.in(room).emit('playerMadeMove', myGame);
            const endGame = await winner(room);
            if (endGame !== -1) {
                io.sockets.in(room).emit('endGame', endGame);
            }
        }
    } else {
        this.emit('error', 'It is not your turn.');
    }
}

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
function playerRestart(data) {
    // Emit the player's data back to the clients in the game room.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
}
