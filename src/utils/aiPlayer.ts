import { getSuccessors } from './getSuccessors';
import { pieces, Piece } from './piece';
import { Board } from './board';

export type AiMove = { source: [number, number]; target: [number, number] };

// tunable weights for the heuristic move scorer
const ADVANCE_WEIGHT = 0.15;
const EXPOSURE_WEIGHT = 0.5;
const JITTER = 1.5;
const TOP_MARGIN = 1;
const CAPTURE_BONUS = 1;
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
function estimateHiddenTargetScore(sourceName: string, sourceOrder: number): number {
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
    return pWin * (sourceOrder * 0.6 + CAPTURE_BONUS) - pDie * sourceOrder;
}

// deterministic outcome of attacking a target whose identity is known
// (fog off, or a revealed flag) - mirrors pieceMovement's combat rules
function evaluateKnownTarget(source: Piece, target: Piece): number {
    if (
        source.name === 'bomb' ||
        source.name === target.name ||
        target.name === 'bomb' ||
        (source.name !== 'engineer' && target.name === 'landmine')
    ) {
        return 0; // mutual destruction, roughly neutral
    }
    if (
        source.order > target.order ||
        (source.name === 'engineer' && target.name === 'landmine')
    ) {
        return target.name === 'flag' ? WIN_GAME_SCORE : target.order + CAPTURE_BONUS;
    }
    return -source.order; // source loses
}

function computeThreatenedSquares(board: Board, aiPlayerIndex: number): Set<string> {
    const threatened = new Set<string>();
    for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            const piece = board[r][c];
            if (piece && piece.affiliation !== aiPlayerIndex) {
                getSuccessors(board, r, c, piece.affiliation).forEach(
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
 * @see chooseAiMove
 */
export function chooseAiMove(fogBoard: Board, aiPlayerIndex: number): AiMove | null {
    const enemyHQRow = aiPlayerIndex === 0 ? 0 : 11;
    const threatenedSquares = computeThreatenedSquares(fogBoard, aiPlayerIndex);

    const candidates: { move: AiMove; score: number }[] = [];
    for (let r = 0; r < 12; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            const piece = fogBoard[r][c];
            if (!piece || piece.affiliation !== aiPlayerIndex) {
                continue;
            }
            const destinations = getSuccessors(fogBoard, r, c, aiPlayerIndex);
            destinations.forEach(([tr, tc]) => {
                const target = fogBoard[tr][tc];
                let score: number;
                if (target === null) {
                    score = ADVANCE_WEIGHT * -Math.abs(tr - enemyHQRow);
                    if (threatenedSquares.has(`${tr},${tc}`)) {
                        score -= piece.order * EXPOSURE_WEIGHT;
                    }
                } else if (target.name === 'enemy') {
                    score = estimateHiddenTargetScore(piece.name, piece.order);
                } else {
                    score = evaluateKnownTarget(piece, target);
                }
                score += (Math.random() - 0.5) * JITTER;
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
