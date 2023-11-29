import io from './server';
import type { Socket } from 'socket.io';
import { getPlayers, getGameById } from './controllers/gameController';
import {
    addSpectator,
    getSpectators,
    removeSpectator,
} from './controllers/gameController';
import { addGame } from './controllers/userController';

/**
 * A user clicked the 'Spectate Game' button.
 * Attempt to connect them to the room that matches
 * the gameId entered by the user.
 * @param data Contains data entered via spectator's input - spectatorName and gameId.
 */
export async function spectateRoom(
    this: Socket,
    data: {
        spectatorName: string;
        clientId: string | null;
        joinRoomId: string;
        mySocketId: string;
        spectators: string[];
        players: string[];
    },
) {
    console.info(
        `Spectator ${data.spectatorName} attempting to join room: ${data.joinRoomId} with client ID: ${data.clientId} on socket id: ${this.id}`,
    );

    const existingGame = await getGameById(data.joinRoomId);

    if (!existingGame?.players) {
        this.emit('error', [
            'This game does not exist. Please enter a valid room ID.',
        ]);
    } else if (existingGame.moves.length) {
        this.emit('error', [
            'Unable to spectate game that has already started.',
        ]);
    } else if (
        existingGame.spectators?.length &&
        existingGame.spectators.includes(data.spectatorName)
    ) {
        this.emit('error', [
            'There is already a spectator by that name. Please choose another name.',
        ]);
    } else {
        console.info(`Room: ${data.joinRoomId}`);
        // attach the socket id to the data object.
        data.mySocketId = this.id;

        // Join the room
        this.join(data.joinRoomId);

        console.info(
            `Spectator ${data.spectatorName} joining game: ${data.joinRoomId} at socket: ${this.id}`,
        );

        const myUpdatedGame = await addSpectator({
            gid: data.joinRoomId,
            spectatorName: data.spectatorName,
            clientId: data.clientId,
            mySocketId: data.mySocketId,
        });
        if (myUpdatedGame) {
            // add the Game _id to the player's User document if they are logged in
            data.clientId &&
                (await addGame(data.clientId, myUpdatedGame._id.toString()));

            const spectators = await getSpectators(data.joinRoomId);
            const players = await getPlayers(data.joinRoomId);

            if (!spectators) {
                console.error('Could not spectate given game');
                this.emit('error', [
                    `${data.spectatorName} could not spectate game: ${data.joinRoomId}`,
                ]);
                return;
            }
            data.spectators = spectators;
            data.players = existingGame.players;
            this.emit('youAreSpectatingTheRoom');
            io.sockets.in(data.joinRoomId).emit('spectatorJoinedRoom', data);
        } else {
            console.error('Could not spectate given game');
            this.emit('error', [
                `${data.spectatorName} could not spectate game: ${data.joinRoomId}`,
            ]);
        }
    }
}

/**
 * The spectator wants to leave the game. Remove only the spectator.
 * @param roomId The room ID
 */
export async function spectatorLeaveRoom(
    this: Socket,
    data: {
        spectatorName: string;
        uid: string | null;
        leaveRoomId: string;
        spectators: string[];
    },
) {
    console.info(
        `Player with name: ${data.spectatorName} leaving room ${data.leaveRoomId}`,
    );
    // clean up by removing the spectator from DB
    const existingSpectators = await getSpectators(data.leaveRoomId);

    if (!existingSpectators) {
        this.emit('error', [
            'Attempting to leave room that does not exist or does not contain spectators.',
        ]);
        return;
    }
    console.info(`Room: ${data.leaveRoomId}`);

    // Leave the room
    this.leave(data.leaveRoomId);

    console.info(
        `Player ${data.spectatorName} leaving room: ${data.leaveRoomId} at socket: ${this.id}`,
    );

    const myUpdatedGame = await removeSpectator({
        gid: data.leaveRoomId,
        spectatorName: data.spectatorName,
        clientId: data.uid,
    });
    if (myUpdatedGame) {
        const spectators = await getSpectators(data.leaveRoomId);
        if (spectators?.includes(data.spectatorName)) {
            console.error('Spectator could not be removed from given room');
            this.emit('error', [
                `${data.spectatorName} could not be removed from room: ${data.leaveRoomId}`,
            ]);
            return;
        }
        data.spectators = spectators || [];
        this.emit('youHaveLeftTheRoom');
        io.sockets.in(data.leaveRoomId).emit('spectatorLeftRoom', data);
    } else {
        console.error(
            `Spectator ${data.spectatorName} could not be removed from given room`,
        );
        this.emit('error', [
            `Spectator ${data.spectatorName} could not be removed from room: ${data.leaveRoomId}`,
        ]);
    }
}
