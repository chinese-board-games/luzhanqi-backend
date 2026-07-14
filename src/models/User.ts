import { Schema, model } from 'mongoose';

interface IUser extends Document {
    uid: string;
    rank: number;
    games: Array<string>;
    // games this user has dismissed from their "rejoin" prompt - still
    // shown in their full game history, just no longer nagging them
    archivedGames: Array<string>;
}

const UserSchema = new Schema<IUser>(
    {
        uid: String,
        rank: Number,
        games: [],
        archivedGames: { type: [String], default: [] },
    },
    { timestamps: true },
);

const User = model<IUser>('User', UserSchema);

export default User;
