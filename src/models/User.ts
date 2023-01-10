import { Schema, model } from 'mongoose';

interface IUser extends Document {
    uid: string;
    rank: string;
    games: Array<string>;
}

const UserSchema = new Schema<IUser>(
    {
        rank: String,
        games: [],
    },
    { timestamps: true },
);

const User = model<IUser>('User', UserSchema);

export default User;
