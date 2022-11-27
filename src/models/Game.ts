import { Schema, model } from 'mongoose';

interface IGame extends Document {
    room: string;
    host: string;
    players: Array<string>;
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
}

const GameSchema = new Schema<IGame>(
    {
        room: String,
        host: String,
        players: [],
        moves: [],
        turn: Number,
        board: [],
    },
    { timestamps: true },
);

const Game = model<IGame>('Game', GameSchema);

export default Game;
