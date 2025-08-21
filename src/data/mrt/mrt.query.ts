import {mercatorXfromLng, mercatorYfromLat} from '../../geo/mercator_coordinate';

import type {MapboxRasterTile, TBandViewRGBA} from './mrt.esm';

const NO_DATA_VALUE = 4294967295;

/**
 * Get the data value of a point in the layer.
 *
 * (0, 0) corresponds to the top left point, excluding the buffer. For a
 * tile with a 1px buffer, (-1, -1) represents the top left pixel outside
 * the tile bounding box.
 *
 * The function will return a plain JS array for scaled values and a typed
 * array of appropriate type for unscaled (raw) values.
 */
export function getPointXY([x, y]: [number, number], bandView: TBandViewRGBA, {scaled = true} = {}) {
    if (!bandView) {
        throw new Error('bandView is undefined');
    }

    const {data, tileSize, buffer, offset, scale, dimension} = bandView;

    if (
        x < -buffer ||
        x > tileSize + buffer ||
        y < -buffer ||
        y > tileSize + buffer
    ) {
        throw new Error(
            `Point (${x}, ${y}) out of bounds for tileSize=${tileSize}, buffer=${buffer}`
        );
    }

    const width = tileSize + 2 * buffer;
    const pointIndex = (y + buffer) * width + (x + buffer);
    const untypedData = new Uint32Array(data.buffer);

    if (untypedData[pointIndex] === NO_DATA_VALUE) {
        return null;
    }

    let output: unknown[] = [];
    if (scaled) {
        output = [];
    } else {
        const Ctor = bandView.data.constructor;
        // @ts-expect-error This expression is not constructable.
        output = new Ctor(dimension);
    }

    for (let i = 0; i < dimension; i++) {
        const rawValue = data[dimension * pointIndex + i];
        const scaledValue = rawValue * scale + offset;
        // round to 12 decimal digits https://mapbox.atlassian.net/browse/RASTER-2768
        output[i] = Math.round(1e12 * scaledValue) / 1e12;
    }

    return output;
}

export function getPointLonLat([lon, lat]: [number, number], tile: MapboxRasterTile, bandView: TBandViewRGBA, {scaled = true} = {}) {
    const {tileSize, buffer} = bandView;

    // From https://github.com/mapbox/tilebelt/blob/876af65cfc68f152aeed2e514289e401c5d95196/index.js#L271-L281
    // pointToTileFraction except *unwrapped* so that we can correctly sample from
    // buffered tiles without incorrectly wrapping. This requires additionally
    // inputting the known tile XYZ.
    const {x, y, z} = tile;

    if (!isFinite(x) || !isFinite(y) || !isFinite(z)) {
        throw new Error('Invalid MRT header');
    }

    const z2 = 2 ** z;
    const xMerc = z2 * mercatorXfromLng(lon);
    const yMerc = z2 * mercatorYfromLat(lat);

    // Apply clamp boundary conditions
    const pixelX = Math.min(
        Math.max(-buffer, Math.floor((xMerc - x) * tileSize)),
        tileSize - 1 + buffer
    );
    const pixelY = Math.min(
        Math.max(-buffer, Math.floor((yMerc - y) * tileSize)),
        tileSize - 1 + buffer
    );

    return getPointXY([pixelX, pixelY], bandView, {scaled});
}
