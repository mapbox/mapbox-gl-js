import {describe, test, expect} from '../../../util/vitest';
import tileTransform, {getNorthOffset} from '../../../../src/geo/projection/tile_transform';
import {getProjection} from '../../../../src/geo/projection/index';
import MercatorCoordinate from '../../../../src/geo/mercator_coordinate';
import EXTENT from '../../../../src/style-spec/data/extent';

function northOffsetAt(projectionName: 'mercator' | 'albers', lng: number, lat: number): number {
    const z = 10;
    const {x, y} = MercatorCoordinate.fromLngLat({lng, lat});
    const id = {z, x: Math.floor(x * (1 << z)), y: Math.floor(y * (1 << z))};
    return getNorthOffset(tileTransform(id, getProjection({name: projectionName})), EXTENT / 2, EXTENT / 2);
}

describe('getNorthOffset', () => {
    test('is zero in mercator', () => {
        expect(northOffsetAt('mercator', 20, 45)).toEqual(0);
    });

    test('is zero on the Albers central meridian', () => {
        expect(northOffsetAt('albers', -96, 45)).toBeCloseTo(0, 0);
    });

    test('follows the converging Albers meridians away from the central meridian', () => {
        // Albers rotates meridians by n * (lng - lng0), with n ≈ 0.603 for the default parallels.
        expect(northOffsetAt('albers', 20, 45)).toBeCloseTo(-0.603 * 116, 0);
        expect(northOffsetAt('albers', -120, 45)).toBeCloseTo(0.603 * 24, 0);
    });
});
