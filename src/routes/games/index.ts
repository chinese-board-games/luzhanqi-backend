// router for the game
// Path: src\routes\games\index.ts

import { Router } from 'express';
// import functions from the controller
import { getGameById } from '../../controllers/gameController';

const games = Router();

// start urls with "games/"

games.get('/:gameId', async (req, res) => {
    const myGame = await getGameById(req.params.gameId);
    if (myGame) {
        res.status(200).send(myGame);
    } else {
        res.status(404).send('Game not found');
    }
});

// updates a Game's playerToUidMap with a playerName -> Firebase uid
games.post('/:gameId/:playerName/:uid', async (req, res) => { 
    const { gameId, playerName, uid } = req.params;
    const myGame = await getGameById(gameId);
    if (myGame) {
        myGame.playerToUidMap.set(playerName, uid);
        myGame.save();
        res.status(200).send(myGame);
    } else {
        res.status(404).send('Game not found');
    }
})

export default games;
