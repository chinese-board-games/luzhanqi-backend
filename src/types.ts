type Piece = {
    0: number;
    1: number;
    name: string;
    affiliation: number;
    order: number;
    kills: number;
    length: number;
};

type Board = (Piece | null)[][];

export { Piece, Board };
