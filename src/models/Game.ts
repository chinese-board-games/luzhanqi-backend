import { Schema, model, Types, Model } from 'mongoose';
import { AiWeights } from '../utils/aiConstants';

interface IGameConfig extends Document {
    _id: Types.ObjectId;
    fogOfWar: boolean;
    opponentType: 'human' | 'ai';
    aiSettings?: AiWeights;
    // rule variants - all default false, preserving prior behavior:
    // a non-Engineer attacking a landmine destroys both (mutual destruction)
    landminesSurvive: boolean;
    // bombs move like an ordinary piece (straight lines/railroad only)
    flyingBombs: boolean;
    // capturing the enemy flag ends the game immediately
    captureTheFlag: boolean;
}

export type GameConfigData = Pick<
    IGameConfig,
    | 'fogOfWar'
    | 'opponentType'
    | 'aiSettings'
    | 'landminesSurvive'
    | 'flyingBombs'
    | 'captureTheFlag'
>;

export interface IGame extends Document {
    room: string;
    // short human-shareable code (e.g. "7K4X2P") resolving to this game's
    // real _id, so players don't have to read/type/paste a 24-char ObjectId
    joinCode: string;
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
        joinCode: { type: String, unique: true, sparse: true },
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
            landminesSurvive: { type: Boolean, default: false },
            flyingBombs: { type: Boolean, default: false },
            captureTheFlag: { type: Boolean, default: false },
            aiSettings: {
                type: new Schema(
                    {
                        randomness: Number,
                        positionalDrive: Number,
                        caution: Number,
                        aggression: Number,
                    },
                    { _id: false },
                ),
                required: false,
            },
        }),
    },
    { timestamps: true },
);

const Game = model<IGame, GameModelType>('Game', GameSchema);

export default Game;
