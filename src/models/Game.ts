import { Schema, model, Types, Model } from 'mongoose';

interface IGameConfig extends Document {
    _id: Types.ObjectId;
    fogOfWar: boolean;
}

export type GameConfigData = Pick<IGameConfig, 'fogOfWar'>;

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
    config: IGameConfig;
}

type GameDocumentOverrides = {
    config: Types.Subdocument<Types.ObjectId> & IGameConfig;
};

// eslint-disable-next-line @typescript-eslint/ban-types
type GameModelType = Model<IGame, {}, GameDocumentOverrides>;

const GameSchema = new Schema<IGame, GameModelType>(
    {
        room: String,
        players: [],
        playerToUidMap: Map,
        playerToSocketIdMap: Map,
        moves: [],
        turn: Number,
        board: [],
        winnerId: String,
        config: new Schema<IGameConfig>({
            fogOfWar: Boolean,
        }),
    },
    { timestamps: true },
);

const Game = model<IGame, GameModelType>('Game', GameSchema);

export default Game;
