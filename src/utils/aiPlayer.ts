import { getSuccessors } from './getSuccessors';
import { pieces, Piece } from './piece';
import { Board } from './board';
import { AiWeights, DEFAULT_AI_WEIGHTS } from './aiConstants';

export type AiMove = { source: [number, number]; target: [number, number] };
export type AiRulesConfig = { landminesSurvive?: boolean; flyingBombs?: boolean };

// fixed (non-tunable) constants for the heuristic move scorer
const TOP_MARGIN = 1;
const WIN_GAME_SCORE = 1000;

// counts of remaining army pieces by rank, derived once from the static
// piece table (deliberately NOT adjusted for pieces already seen dead -
// a fogged player never legitimately knows the enemy's own losses either)
const ORDER_COUNTS: Record<number, number> = {};
Object.values(pieces).forEach(({ count, order }) => {
    if (order === -1) {
        return;
    }
    ORDER_COUNTS[order] = (ORDER_COUNTS[order] || 0) + count;
});
const BOMB_COUNT = pieces.bomb.count;
const LANDMINE_COUNT = pieces.landmine.count;

const countInOrderRange = (minOrder: number, maxOrder: number): number => {
    let total = 0;
    for (let order = minOrder; order <= maxOrder; order += 1) {
        total += ORDER_COUNTS[order] || 0;
    }
    return total;
};

// expected value of attacking a still-hidden 'enemy' square, based only on
// the static prior over what the opponent's remaining army could be
function estimateHiddenTargetScore(
    sourceName: string,
    sourceOrder: number,
    aggression: number,
): number {
    if (sourceName === 'bomb') {
        // a bomb always mutually destroys whatever it attacks, so this is a
        // guaranteed trade for a random enemy piece - modestly good odds
        return 1;
    }

    const isEngineer = sourceName === 'engineer';
    const winCount =
        countInOrderRange(0, sourceOrder - 1) + (isEngineer ? LANDMINE_COUNT : 0);
    const mutualCount =
        (ORDER_COUNTS[sourceOrder] || 0) + BOMB_COUNT + (isEngineer ? 0 : LANDMINE_COUNT);
    const dieCount = countInOrderRange(sourceOrder + 1, 9);
    const total = winCount + mutualCount + dieCount;
    if (total === 0) {
        return 0;
    }

    const pWin = winCount / total;
    const pDie = dieCount / total;
    // winning captures a piece somewhere below our own rank (rough estimate);
    // dying loses a piece worth our own rank; mutual trades are roughly neutral
    return pWin * (sourceOrder * 0.6 + aggression) - pDie * sourceOrder;
}

// deterministic outcome of attacking a target whose identity is known
// (fog off, or a revealed flag) - mirrors pieceMovement's combat rules
function evaluateKnownTarget(
    source: Piece,
    target: Piece,
    aggression: number,
    landminesSurvive: boolean,
): number {
    if (source.name !== 'engineer' && target.name === 'landmine') {
        // under landminesSurvive the mine stays and only the attacker dies -
        // strictly worse than the default mutual destruction (source.order
        // would also be lost as a mutual trade there, but at least the mine
        // goes with it)
        return landminesSurvive ? -source.order : 0;
    }
    if (source.name === 'bomb' || source.name === target.name || target.name === 'bomb') {
        return 0; // mutual destruction, roughly neutral
    }
    if (
        source.order > target.order ||
        (source.name === 'engineer' && target.name === 'landmine')
    ) {
        return target.name === 'flag' ? WIN_GAME_SCORE : target.order + aggression;
    }
    return -source.order; // source loses
}

function computeThreatenedSquares(
    board: Board,
    aiPlayerIndex: number,
    rules: AiRulesConfig,
): Set<string> {
    const threatened = new Set<string>();
    for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            const piece = board[r][c];
            if (piece && piece.affiliation !== aiPlayerIndex) {
                getSuccessors(board, r, c, piece.affiliation, rules).forEach(
                    ([tr, tc]) => threatened.add(`${tr},${tc}`),
                );
            }
        }
    }
    return threatened;
}

/**
 * Picks a move for the AI opponent using simple heuristics, respecting fog
 * of war - it only ever sees `fogBoard`, the same view emplaceBoardFog
 * would send a real player, never the true identity of enemy pieces.
 *
 * `weights` lets a game tune how the AI plays (see aiConstants.ts for the
 * meaning of each setting and their defaults). `rules` mirrors the game's
 * rule-variant config so the AI evaluates moves the same way the server
 * will actually resolve them.
 * @see chooseAiMove
 */
export function chooseAiMove(
    fogBoard: Board,
    aiPlayerIndex: number,
    weights: AiWeights = DEFAULT_AI_WEIGHTS,
    rules: AiRulesConfig = {},
): AiMove | null {
    const { randomness, positionalDrive, caution, aggression } = weights;
    const enemyHQRow = aiPlayerIndex === 0 ? 0 : 11;
    const threatenedSquares = computeThreatenedSquares(fogBoard, aiPlayerIndex, rules);

    const candidates: { move: AiMove; score: number }[] = [];
    for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            const piece = fogBoard[r][c];
            if (!piece || piece.affiliation !== aiPlayerIndex) {
                continue;
            }
            const destinations = getSuccessors(fogBoard, r, c, aiPlayerIndex, rules);
            destinations.forEach(([tr, tc]) => {
                const target = fogBoard[tr][tc];
                let score: number;
                if (target === null) {
                    score = positionalDrive * -Math.abs(tr - enemyHQRow);
                    if (threatenedSquares.has(`${tr},${tc}`)) {
                        score -= piece.order * caution;
                    }
                } else if (target.name === 'enemy') {
                    score = estimateHiddenTargetScore(piece.name, piece.order, aggression);
                } else {
                    score = evaluateKnownTarget(
                        piece,
                        target,
                        aggression,
                        !!rules.landminesSurvive,
                    );
                }
                score += (Math.random() - 0.5) * randomness;
                candidates.push({ move: { source: [r, c], target: [tr, tc] }, score });
            });
        }
    }

    if (candidates.length === 0) {
        return null;
    }
    candidates.sort((a, b) => b.score - a.score);
    const topScore = candidates[0].score;
    const topCandidates = candidates.filter((c) => c.score >= topScore - TOP_MARGIN);
    return topCandidates[Math.floor(Math.random() * topCandidates.length)].move;
}
