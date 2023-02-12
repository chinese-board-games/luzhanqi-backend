import { Schema, model } from 'mongoose';

interface IUser extends Document {
    uid: string;
    rank: number;
    games: Array<string>;
}

const UserSchema = new Schema<IUser>(
    {
        uid: String,
        rank: Number,
        games: [],
    },
    { timestamps: true },
);

const User = model<IUser>('User', UserSchema);

export default User;
