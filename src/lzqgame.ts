import type { Socket } from 'socket.io';
import { getGameById } from './controllers/gameController';
import { getSuccessors } from './utils';
import { hostCreateNewGame, hostPrepareGame } from './host';
import {
    playerJoinRoom,
    playerLeaveRoom,
    playerRestart,
    playerMakeMove,
    playerForfeit,
    playerInitialBoard,
} from './player';
import { spectateRoom, spectatorLeaveRoom } from './spectator';

let gameSocket: Socket;

export const initGame = (socket: Socket) => {
    gameSocket = socket;
    gameSocket.emit('connected', { message: 'You are connected!' });
    socket.on;
    // Host events
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);

    // Player Events
    gameSocket.on('playerJoinRoom', playerJoinRoom);
    gameSocket.on('playerLeaveRoom', playerLeaveRoom);
    gameSocket.on('playerRestart', playerRestart);
    gameSocket.on('playerMakeMove', playerMakeMove);
    gameSocket.on('playerForfeit', playerForfeit);
    gameSocket.on('playerInitialBoard', playerInitialBoard);

    // Spectator Events
    gameSocket.on('spectateRoom', spectateRoom);
    gameSocket.on('spectatorLeaveRoom', spectatorLeaveRoom);

    // Utility Events
    gameSocket.on('pieceSelection', pieceSelection);
};

async function pieceSelection(
    this: Socket,
    {
        board,
        piece,
        playerName,
        room: gid,
    }: {
        board: [][];
        piece: number[];
        playerName: string;
        room: string;
    },
) {
    console.info(`pieceSelection from ${playerName} on socket ${this.id}`);
    const myGame = await getGameById(gid);
    if (!myGame) {
        console.error('Game not found.');
        this.emit('error', [`$Game not found: ${gid}`]);
        return;
    }
    const playerIndex = myGame.players.indexOf(playerName);

    const successors = getSuccessors(board, piece[0], piece[1], playerIndex);
    this.emit('pieceSelected', successors);
}
