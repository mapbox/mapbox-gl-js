// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, createMap, createStyleJSON} from '../../../util/vitest';
import {getPNGResponse, mockFetch} from '../../../util/network';

function createMaskedStyle(rasterPaint: Record<string, string>) {
    return createStyleJSON({
        imports: [{
            id: 'basemap',
            url: 'mapbox://styles/mapbox/standard',
            data: createStyleJSON({
                sources: {water: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}},
                featuresets: {water: {selectors: [{layer: 'water'}]}},
                layers: [{id: 'water', type: 'fill', source: 'water'}]
            })
        }],
        sources: {
            water: {type: 'geojson', data: {type: 'FeatureCollection', features: []}},
            raster: {type: 'raster', tiles: ['https://example.com/tiles/{z}/{x}/{y}.png']}
        },
        layers: [
            {id: 'mask-water', type: 'fill', source: 'water', paint: {'fill-opacity': 0}},
            {id: 'raster', type: 'raster', source: 'raster', paint: rasterPaint}
        ]
    });
}

async function createMaskedMap(rasterPaint: Record<string, string>) {
    mockFetch({
        'https://example.com/tiles/0/0/0.png': async () => new Response(await getPNGResponse())
    });
    const map = createMap({style: createMaskedStyle(rasterPaint)});
    await waitFor(map, 'load');
    return map;
}

describe('Map#raster-mask', () => {
    test('#removeLayer keeps a layer used by raster-mask', async () => {
        const map = await createMaskedMap({'raster-mask': 'mask-water'});
        map.on('error', () => {});

        map.removeLayer('mask-water');

        expect(map.getLayer('mask-water')).toBeTruthy();
    });

    test('#removeLayer fires an error for a layer used by raster-mask', async () => {
        const map = await createMaskedMap({'raster-mask': 'mask-water'});
        const error = new Promise(resolve => { map.once('error', e => resolve(e.error.message)); });

        map.removeLayer('mask-water');

        expect(await error).toBe('Layer "mask-water" cannot be removed while layer "raster" uses it in "raster-mask".');
    });

    test('#removeLayer removes a mask layer once the raster layer using it is removed', async () => {
        const map = await createMaskedMap({'raster-mask': 'mask-water'});

        map.removeLayer('raster');
        map.removeLayer('mask-water');

        expect(map.getLayer('mask-water')).toBeUndefined();
    });

    test('#removeLayer removes a layer whose id is only used as a featureset of an import', async () => {
        const map = await createMaskedMap({'raster-mask': 'mask-water', 'raster-mask-import': 'basemap'});

        map.removeLayer('mask-water');

        expect(map.getLayer('mask-water')).toBeUndefined();
    });

    test('#removeImport keeps an import used by raster-mask-import', async () => {
        const map = await createMaskedMap({'raster-mask': 'water', 'raster-mask-import': 'basemap'});
        map.on('error', () => {});

        map.removeImport('basemap');

        expect(map.style.getFragmentStyle('basemap')).toBeTruthy();
    });

    test('#removeImport fires an error for an import used by raster-mask-import', async () => {
        const map = await createMaskedMap({'raster-mask': 'water', 'raster-mask-import': 'basemap'});
        const error = new Promise(resolve => { map.once('error', e => resolve(e.error.message)); });

        map.removeImport('basemap');

        expect(await error).toBe('Import "basemap" cannot be removed while layer "raster" uses it in "raster-mask-import".');
    });
});
