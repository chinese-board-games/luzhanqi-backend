/* eslint-disable @typescript-eslint/no-this-alias */
import { isEqual, cloneDeep } from 'lodash';
import type { Server, Socket } from 'socket.io';
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
import { getSuccessors } from './utils';
import { Board, Piece } from './types';

let io: Server;
let gameSocket: Socket;

export const initGame = (sio: Server, socket: Socket) => {
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
const hostCreateNewGame = async ({ playerName }: { playerName: string }) => {
    // Create a unique Socket.IO Room
    // eslint-disable-next-line no-bitwise
    const gameId = ((Math.random() * 100000) | 0).toString();
    const myGame = await createGame({
        room: gameId,
        host: playerName,
    });
    if (myGame) {
        gameSocket.emit('newGameCreated', {
            gameId: gameId,
            mySocketId: gameSocket.id,
            players: await getPlayers(gameId),
        });
        console.log(
            `New game created with ID: ${gameId} at socket: ${gameSocket.id}`,
        );

        // Join the Room and wait for the players
        gameSocket.join(gameId);
    } else {
        console.error('Game was not created.');
    }
};

/**
 * Two players have joined. Alert the host!
 * @param gameId The game ID / room ID
 */
const hostPrepareGame = (gameId: string) => {
    const data = {
        mySocketId: gameSocket.id,
        gameId,
        turn: 0,
    };
    console.log(`All players present. Preparing game ${data.gameId}`);
    io.in(data.gameId).emit('beginNewGame', data);
};

/**
 * A player clicked the 'Join Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the player.
 * @param data Contains data entered via player's input - playerName and gameId.
 */
const playerJoinGame = async (data: {
    playerName: string;
    joinRoomId: string;
    mySocketId: string;
    players: string[];
}) => {
    console.log(
        `Player ${data.playerName} attempting to join game: ${data.joinRoomId}`,
    );

    const existingPlayers = await getPlayers(data.joinRoomId);
    if (!existingPlayers) {
        gameSocket.emit(
            'error',
            'This game does not exist. Please enter a valid game ID.',
        );
    } else if (existingPlayers.includes(data.playerName)) {
        gameSocket.emit(
            'error',
            'There is already a player in this game by that name. Please choose another.',
        );
    } else {
        console.log(`Room: ${data.joinRoomId}`);
        // attach the socket id to the data object.
        data.mySocketId = gameSocket.id;

        // Join the room
        gameSocket.join(data.joinRoomId);

        console.log(
            `Player ${data.playerName} joining game: ${data.joinRoomId}`,
        );

        const myUpdatedGame = await addPlayer({
            room: data.joinRoomId,
            playerName: data.playerName,
        });
        if (myUpdatedGame) {
            const players = await getPlayers(data.joinRoomId);
            if (!players) {
                console.error('Player could not be added to given game');
                gameSocket.emit(
                    'error',
                    `${data.playerName} could not be added to game: ${data.joinRoomId}`,
                );
                return;
            }
            data.players = players;
            gameSocket.emit('youHaveJoinedTheRoom', data);
            io.sockets.in(data.joinRoomId).emit('playerJoinedRoom', data);
        } else {
            console.error('Player could not be added to given game');
            gameSocket.emit(
                'error',
                `${data.playerName} could not be added to game: ${data.joinRoomId}`,
            );
        }
    }
};

const playerInitialBoard = async ({
    playerName,
    myPositions,
    room,
}: {
    playerName: string;
    myPositions: [][];
    room: string;
}) => {
    let myGame = await getGame(room);
    if (!myGame) {
        console.error('Game not found.');
        gameSocket.emit('error', `$Game not found: ${room}`);
        return;
    }
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
        gameSocket.emit('halfBoardReceived');
    } else if (myGame.board.length === 6) {
        // only half of the board is filled
        let completeGameBoard;
        if (playerIndex === 0) {
            // the host
            completeGameBoard = myGame.board.concat(myPositions);
        } else if (playerIndex === 1) {
            // the guest
            completeGameBoard = myPositions
                .reverse()
                .concat(myGame.board as [][]);
        }
        await updateBoard(room, completeGameBoard);
        myGame = await getGame(room);
        io.sockets.in(room).emit('boardSet', myGame);
    }
};

const pieceSelection = async ({
    board,
    piece,
    playerName,
    room,
}: {
    board: [][];
    piece: number[];
    playerName: string;
    room: string;
}) => {
    const myGame = await getGame(room);
    if (!myGame) {
        console.error('Game not found.');
        gameSocket.emit('error', `$Game not found: ${room}`);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);

    const successors = getSuccessors(board, piece[0], piece[1], playerIndex);
    gameSocket.emit('pieceSelected', successors);
};

// returns a new board
const pieceMovement = (board: Board, source: Piece, target: Piece) => {
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

const playerMakeMove = async ({
    playerName,
    room,
    turn,
    pendingMove,
}: {
    playerName: string;
    room: string;
    turn: number;
    pendingMove: {
        source: Piece;
        target: Piece;
    };
}) => {
    // TODO: add move validation function
    if (
        await isPlayerTurn({
            playerName,
            room,
            turn,
        })
    ) {
        let myGame = await getGame(room);
        if (!myGame) {
            console.error('Game not found.');
            gameSocket.emit('error', `$Game not found: ${room}`);
            return;
        }
        const myBoard = myGame.board;
        const { source, target } = pendingMove;
        const newBoard = pieceMovement(myBoard as Board, source, target);
        if (isEqual(newBoard, myBoard)) {
            gameSocket.emit('error', 'No move made.');
        } else {
            turn += 1;
            await updateBoard(room, newBoard);
            const moveHistory = await getMoveHistory(room);
            if (!moveHistory) {
                console.error('Move history not found.');
                gameSocket.emit('error', `$Move history not found: ${room}`);
                return;
            }
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
        gameSocket.emit('error', 'It is not your turn.');
    }
};

/**
 * The game is over, and a player has clicked a button to restart the game.
 * @param data
 */
const playerRestart = (data: { gameId: string; playerId: string }) => {
    // Emit the player's data back to the clients in the game room.
    data.playerId = gameSocket.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom', data);
};
