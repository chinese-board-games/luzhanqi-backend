import { Schema, model, Types, Model } from 'mongoose';

interface IGameConfig extends Document {
    _id: Types.ObjectId;
    fogOfWar: boolean;
    opponentType: 'human' | 'ai';
}

export type GameConfigData = Pick<
    IGameConfig,
    'fogOfWar' | 'opponentType'
>;

export interface IGame extends Document {
    room: string;
    players: Array<string>;
    playerToSocketIdMap: Map<string, string>;
    playerToUidMap: Map<string, string | null>;
    playerToTokenMap: Map<string, string>;
    spectators: Array<string>;
    spectatorToSocketIdMap: Map<string, string>;
    spectatorToUidMap: Map<string, string | null>;
    moves: Array<{
        source: Array<number>;
        target: Array<number>;
    }>;
    turn: number;
    // 0 waiting for players, 1 setup/placement, 2 gameplay, 3 ended
    phase: number;
    // names of players who have already submitted their setup half-board,
    // since a partial (6-row) board alone can't tell us who submitted it
    playersSubmittedSetup: Array<string>;
    board: Array<
        Array<{
            name: string;
            affiliation: number;
            order: number;
            kills: number;
        }>
    > | null;
    deadPieces: Array<{
        name: string;
        affiliation: number;
        order: number;
        kills: number;
    }>;
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
        playerToTokenMap: Map,
        spectators: [],
        spectatorToUidMap: Map,
        spectatorToSocketIdMap: Map,
        moves: [],
        turn: Number,
        phase: { type: Number, default: 0 },
        playersSubmittedSetup: { type: [String], default: [] },
        board: [],
        deadPieces: [],
        winnerId: String,
        config: new Schema<IGameConfig>({
            fogOfWar: Boolean,
            opponentType: { type: String, default: 'human' },
        }),
    },
    { timestamps: true },
);

const Game = model<IGame, GameModelType>('Game', GameSchema);

export default Game;
