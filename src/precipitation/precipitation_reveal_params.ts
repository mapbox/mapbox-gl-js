export type PrecipitationRevealParams = {
    revealStart: number;
    revealRange: number;
};

export function createDefaultRevealParams(): PrecipitationRevealParams {
    return {
        revealStart: 11.0,
        revealRange: 2.0
    };
}
