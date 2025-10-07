import User from '../models/User';
import { isEmpty } from 'lodash';
import { getGameById } from './gameController';

// create a user in the mongodb database

export const createUser = async (uid: string) => {
    const user = new User();
    user.uid = uid;
    user.games = [];
    user.rank = 1;
    let updatedUser = null;
    await user
        .save()
        .then(() => {
            console.info(`User ${uid} saved in MongoDB`);
            updatedUser = user;
        })
        .catch((err) => {
            console.error(err);
        });
    return updatedUser;
};

export const getUser = async (uid: string) => {
    const myUser = await User.findOne({ uid });
    if (!isEmpty(myUser)) {
        return myUser;
    }
    console.error('User not found');
};

// adds a Game gid to a User's games list (idempotent)
export const addGame = async (uid: string, gameId: string) => {
    const myUser = await getUser(uid);
    if (myUser) {
        console.info(`Adding game ${gameId} to ${uid}`);
        const myGame = await getGameById(gameId);
        if (myGame) {
            if (myUser.games.includes(gameId)) {
                console.info(
                    `Attempted to add Game ${gameId} to User ${uid} when Game already in games list.`,
                );
                return myUser;
            }
            myUser.games.push(gameId);
            await myUser.save();
            return myUser;
        } else {
            console.error('Game not found');
        }
    } else {
        console.error('User not found');
    }
};

export const removeGame = async (uid: string, gameId: string) => {
    const myUser = await getUser(uid);
    if (myUser) {
        console.info(`Removing game ${typeof gameId} ${gameId} from ${uid}`);
        if (myUser.games.includes(uid)) {
            myUser.games = myUser.games.filter((game) => game !== gameId);
            await myUser.save();
        }
        return myUser;
    }
    console.error('User not found');
};

export const getGames = async (uid: string) => {
    const myUser = await getUser(uid);
    if (myUser) {
        return myUser.games;
    }
    console.error('User not found');
};

export const getRank = async (uid: string) => {
    const myUser = await getUser(uid);
    if (myUser) {
        return myUser.rank;
    }
    console.error('User not found');
};

export const setRank = async (uid: string, rank: number) => {
    const myUser = await getUser(uid);
    if (myUser) {
        myUser.rank = rank;
        await myUser.save();
        return myUser;
    }
    console.error('User not found');
};
