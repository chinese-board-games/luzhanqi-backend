import { Schema, model } from 'mongoose';

interface IGame extends Document {
    room: string;
    players: Array<string>;
    playerToSocketIdMap: Map<string, string>;
    playerToUidMap: Map<string, string | null>;
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
        players: [],
        playerToUidMap: Map,
        playerToSocketIdMap: Map,
        moves: [],
        turn: Number,
        board: [],
        winnerId: String,
    },
    { timestamps: true },
);

const Game = model<IGame>('Game', GameSchema);

export default Game;
