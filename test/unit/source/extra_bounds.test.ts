import {describe, test, expect, waitFor} from '../../util/vitest';
import {Evented} from '../../../src/util/evented';
import {RequestManager} from '../../../src/util/mapbox';
import {OverscaledTileID, CanonicalTileID} from '../../../src/source/tile_id';
import {tileCornersToBounds} from '../../../src/geo/projection/globe_util';
import TileBounds from '../../../src/source/tile_bounds';
import VectorTileSource from '../../../src/source/vector_tile_source';
import RasterTileSource from '../../../src/source/raster_tile_source';
import RasterDEMTileSource from '../../../src/source/raster_dem_tile_source';
import RasterArrayTileSource from '../../../src/source/raster_array_tile_source';
import Tiled3DModelSource from '../../../3d-style/source/tiled_3d_model_source';

import type Dispatcher from '../../../src/util/dispatcher';
import type {Map as MapboxMap} from '../../../src/ui/map';

type Bounds = [number, number, number, number];

const worldBounds: Bounds = [-180, -85.051129, 180, 85.051129];
const europe: Bounds = [-18.716583, 34.608345, 48.080292, 73.128931];
const eastAsia: Bounds = [122.871094, 26.431228, 158.730469, 46.800059];

const tileInEastAsia = new OverscaledTileID(8, 0, 8, 217, 98);
const tileInSouthAmerica = new OverscaledTileID(8, 0, 8, 133, 177);

const sourceTypes = [
    ['vector', VectorTileSource],
    ['raster', RasterTileSource],
    ['raster-dem', RasterDEMTileSource],
    ['raster-array', RasterArrayTileSource],
    ['batched-model', Tiled3DModelSource],
] as const;

type SourceClass = typeof sourceTypes[number][1];

async function loadSource(type: string, SourceClass: SourceClass, bounds: Bounds | undefined, extraBounds: Bounds[]) {
    const options = {
        type,
        tiles: ['http://example.com/{z}/{x}/{y}'],
        minzoom: 0,
        maxzoom: 22,
        bounds,
        // eslint-disable-next-line camelcase
        extra_bounds: extraBounds
    };
    const dispatcher = {getActor: () => ({send() {}})} as unknown as Dispatcher;
    const source = new SourceClass('id', options as never, dispatcher, new Evented());

    const metadata = waitFor(source, 'data');
    source.onAdd({
        _requestManager: new RequestManager(),
        _getMapId: () => 1,
        _language: null,
        getWorldview: () => undefined,
        style: {clearSource() {}}
    } as unknown as MapboxMap);
    await metadata;

    return source;
}

describe.each(sourceTypes)('%s source extra_bounds', (type, SourceClass) => {
    test('requests tiles inside any extra_bounds region', async () => {
        const source = await loadSource(type, SourceClass, worldBounds, [europe, eastAsia]);
        expect(source.hasTile(tileInEastAsia)).toBe(true);
    });

    test('skips tiles outside extra_bounds', async () => {
        const source = await loadSource(type, SourceClass, worldBounds, [europe, eastAsia]);
        expect(source.hasTile(tileInSouthAmerica)).toBe(false);
    });

    test('skips tiles outside extra_bounds without bounds', async () => {
        const source = await loadSource(type, SourceClass, undefined, [europe, eastAsia]);
        expect(source.hasTile(tileInSouthAmerica)).toBe(false);
    });

    test('requests tiles everywhere when extra_bounds is empty', async () => {
        const source = await loadSource(type, SourceClass, worldBounds, []);
        expect(source.hasTile(tileInSouthAmerica)).toBe(true);
    });
});

describe('TileBounds extra_bounds', () => {
    function boundsOf(tileID: CanonicalTileID): Bounds {
        const [[west, south], [east, north]] = tileCornersToBounds(tileID).toArray();
        return [west, south, east, north];
    }

    const parent = new CanonicalTileID(9, 255, 170);
    const child = new CanonicalTileID(10, 510, 340);
    const childSibling = new CanonicalTileID(10, 511, 340);
    const outside = new CanonicalTileID(10, 513, 343);

    test('skips tiles inside bounds but outside extra_bounds', () => {
        const tileBounds = new TileBounds({bounds: boundsOf(parent), extra_bounds: [boundsOf(outside)], minzoom: 10, maxzoom: 10}); // eslint-disable-line camelcase
        expect(tileBounds.contains(child)).toBe(false);
    });

    test('skips tiles inside extra_bounds but outside bounds', () => {
        const tileBounds = new TileBounds({bounds: boundsOf(parent), extra_bounds: [boundsOf(outside)], minzoom: 10, maxzoom: 10}); // eslint-disable-line camelcase
        expect(tileBounds.contains(outside)).toBe(false);
    });

    test('a zero-size extra_bounds region selects the tile containing it', () => {
        const center = tileCornersToBounds(child).getCenter();
        const tileBounds = new TileBounds({bounds: boundsOf(parent), extra_bounds: [[center.lng, center.lat, center.lng, center.lat]], minzoom: 10, maxzoom: 10}); // eslint-disable-line camelcase
        expect(tileBounds.contains(child)).toBe(true);
    });

    test('a zero-size extra_bounds region skips neighbouring tiles', () => {
        const center = tileCornersToBounds(child).getCenter();
        const tileBounds = new TileBounds({bounds: boundsOf(parent), extra_bounds: [[center.lng, center.lat, center.lng, center.lat]], minzoom: 10, maxzoom: 10}); // eslint-disable-line camelcase
        expect(tileBounds.contains(childSibling)).toBe(false);
    });
});
