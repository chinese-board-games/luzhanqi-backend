import io from './server';
import type { Socket } from 'socket.io';
import Game, { GameConfigData } from './models/Game';
import { createGame, getPlayers } from './controllers/gameController';
import { addGame } from './controllers/userController';

/* *******************************
 *                             *
 *       HOST FUNCTIONS        *
 *                             *
 ******************************* */

/**
 * The 'START' button was clicked and 'hostCreateNewGame' event occurred.
 */
export async function hostCreateNewGame(
    this: Socket,
    {
        playerName,
        hostId,
        gameConfig,
    }: {
        playerName: string;
        hostId: string | null;
        gameConfig: GameConfigData;
    },
) {
    const myGame = await createGame({
        host: playerName,
        playerToUidMap: new Map([[playerName, hostId]]),
        playerToSocketIdMap: new Map([[playerName, this.id]]),
        gameConfig,
    });
    if (myGame) {
        // MongoDB ObjectIds are BSON by default, ensure roomIds are always strings
        const string_gid = myGame._id.toString();
        this.emit('newGameCreated', {
            gameId: string_gid,
            mySocketId: this.id,
            players: await getPlayers(string_gid),
        });
        console.info(
            `New game created with ID: ${string_gid} at socket: ${this.id}`,
        );

        // Join the room and wait for the players
        this.join(string_gid);
        // Add the Game _id to the host's User document if they are logged in
        hostId && (await addGame(hostId, string_gid));
    } else {
        console.error('Game was not created.');
    }
}

/**
 * Two players have joined. Alert the host!
 * @param roomId The room ID
 */
export async function hostPrepareGame(
    this: Socket,
    gid: string,
    gameConfig: GameConfigData | null,
) {
    const data = {
        mySocketId: this.id,
        roomId: gid,
        turn: 0,
    };
    if (gameConfig) {
        await Game.findByIdAndUpdate(
            gid,
            { $set: { config: gameConfig } },
            { new: true },
        );
    }
    console.info(`All players present. Preparing game for room ${gid}`);
    io.sockets.in(gid).emit('beginNewGame', data);
}
