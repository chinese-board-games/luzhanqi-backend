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
        res.status(200).send('Game not found');
    }
});

export default games;
