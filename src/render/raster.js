// @flow

function computeRasterColorMix(colorRampRes: number, [mixR, mixG, mixB, mixA]: [number, number, number, number], [min, max]: [number, number]): [number, number, number, number] {
    if (min === max) return [0, 0, 0, 0];

    // Together with the `offset`, the mix vector transforms the encoded integer
    // input into a numeric value. To minimize work, we modify this vector to
    // perform extra steps on the CPU, before rendering.
    //
    // To a first cut, we map `min` to the texture coordinate 0, and `max` to texture
    // coordinate 1. However, this would align the samples with the *edges* of
    // tabulated texels rather than the centers. This  makes it difficult to precisely
    // position values relative to the tabulated colors.
    //
    // Therefore given color map resolution N, we actually map `min` to 1 / 2N and
    // `max` to 1 - 1 / 2N. When you work out a few lines of algebra, the scale factor
    // below is the result.
    //
    // Similarly, computerRasterColorOffset contains the counterpart of this equation
    // by which the constant offset is adjusted.
    const factor = 255 * (colorRampRes - 1) / (colorRampRes * (max - min));

    return [
        mixR * factor,
        mixG * factor,
        mixB * factor,
        mixA * factor
    ];
}

function computeRasterColorOffset(colorRampRes: number, offset: number, [min, max]: [number, number]): number {
    if (min === max) return 0;

    // See above for an explanation.
    return 0.5 / colorRampRes + (offset - min) * (colorRampRes - 1) / (colorRampRes * (max - min));
}

export {computeRasterColorMix, computeRasterColorOffset};
