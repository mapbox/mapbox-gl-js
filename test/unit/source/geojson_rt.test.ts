// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import GeoJSONRT from '../../../src/source/geojson_rt';

// z10 tiles containing [-0.1, 51.5] and [10, 51.5] respectively
const tileA = {uid: 1, canonical: {z: 10, x: 511, y: 340}};
const tileB = {uid: 2, canonical: {z: 10, x: 540, y: 340}};

const point = (id: number, lng: number, lat: number) => ({
    id,
    type: 'Feature',
    properties: {},
    geometry: {type: 'Point', coordinates: [lng, lat]}
});

describe('GeoJSONRT', () => {
    test('removing a feature that was never added', () => {
        const index = new GeoJSONRT();
        const cache = {1: tileA};

        index.load([{id: 99, type: 'Feature', properties: {}, geometry: null}], cache);

        expect(index.getFeatures()).toEqual([]);
        expect(cache).toEqual({1: tileA});
    });

    test('removing a feature invalidates the tiles it was in', () => {
        const index = new GeoJSONRT();
        const cache = {1: tileA, 2: tileB};
        index.load([point(1, -0.1, 51.5)], {});

        index.load([{id: 1, type: 'Feature', properties: {}, geometry: null}], cache);

        expect(index.getFeatures()).toEqual([]);
        expect(cache).toEqual({2: tileB});
    });

    test('moving a feature invalidates the tiles at both its old and new position', () => {
        const index = new GeoJSONRT();
        const cache = {1: tileA, 2: tileB};
        index.load([point(1, -0.1, 51.5)], {});

        index.load([point(1, 10, 51.5)], cache);

        expect(cache).toEqual({});
    });

    test('adding a feature invalidates only the tiles it lands in', () => {
        const index = new GeoJSONRT();
        const cache = {1: tileA, 2: tileB};

        index.load([point(1, 10, 51.5)], cache);

        expect(cache).toEqual({1: tileA});
    });
});
