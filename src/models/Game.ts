import { Schema, model } from 'mongoose';

interface IGame extends Document {
    room: string;
    host: string;
    hostId: string | null;
    clientId: string | null;
    players: Array<string>;
    playerToSocketIdMap: Map<string, string>;
    moves: Array<{
        source: Array<number>;
        target: Array<number>;
    }>;
    turn: number;
    board: Array<
        Array<{
            name: string;
            affiliation: number;
            order: number;
            kills: number;
        }>
    > | null;
    winnerId: string | null;
}

const GameSchema = new Schema<IGame>(
    {
        room: String,
        host: String,
        players: [],
        playerToSocketIdMap: Map,
        hostId: String,
        clientId: String,
        moves: [],
        turn: Number,
        board: [],
        winnerId: String,
    },
    { timestamps: true },
);

const Game = model<IGame>('Game', GameSchema);

export default Game;
