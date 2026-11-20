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

const square = (id: number, west: number, south: number, east: number, north: number) => ({
    id,
    type: 'Feature',
    properties: {},
    geometry: {type: 'Polygon', coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]}
});

const ringsOf = (index: GeoJSONRT, z: number, x: number, y: number): number[][] => (index.getTileRaw(z, x, y).features[0].geometry as Int32Array[]).map(ring => Array.from(ring));

const isClosed = (ring: number[]) => ring[0] === ring[ring.length - 2] && ring[1] === ring.at(-1);

describe('GeoJSONRT', () => {
    test('a polygon covering the whole tile is clipped to a closed ring of the tile corners', () => {
        const index = new GeoJSONRT();
        index.load([square(1, -0.5, 51, 0.5, 52)], {});

        // z10 tile 511/340 lies wholly inside the polygon
        const [ring] = ringsOf(index, 10, 511, 340);

        expect(isClosed(ring)).toBe(true);
        expect(ring.length).toEqual(10);
    });

    test('a polygon clipped on one side keeps a closed ring', () => {
        const index = new GeoJSONRT();
        // western edge inside z10 tile 511/340, the rest extends beyond it
        index.load([square(1, -0.2, 51, 0.5, 52)], {});

        const [ring] = ringsOf(index, 10, 511, 340);

        expect(isClosed(ring)).toBe(true);
    });

    test('a polygon wholly inside the tile is unchanged in shape', () => {
        const index = new GeoJSONRT();
        index.load([square(1, -0.11, 51.49, -0.1, 51.5)], {});

        const [ring] = ringsOf(index, 10, 511, 340);

        expect(isClosed(ring)).toBe(true);
        expect(ring.length).toEqual(10);
    });

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
