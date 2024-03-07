import {describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest.js';
import {createStyle, createStyleSource} from './util.js';
import {extend} from '../../../../src/util/util.js';
import {getPNGResponse} from '../../../util/network.js';
import styleSpec from '../../../../src/style-spec/reference/latest.js';

describe('Map#getStyle', () => {
    test('returns the style', async () => {
        const style = createStyle();
        const map = createMap({style});

        await waitFor(map, "load");
        expect(map.getStyle()).toEqual(style);
    });

    test('returns the style with added sources', async () => {
        const style = createStyle();
        const map = createMap({style});

        await waitFor(map, "load");
        map.addSource('geojson', createStyleSource());
        expect(map.getStyle()).toEqual(extend(createStyle(), {
            sources: {geojson: createStyleSource()}
        }));
    });

    test('returns the style with added terrain', async () => {
        const style = createStyle();
        vi.spyOn(window, 'fetch').mockImplementation(async () => {
            const res = await getPNGResponse();
            return new window.Response(res);
        });
        const map = createMap({style});

        await waitFor(map, "load");
        const terrain = {source: "terrain-source-id", exaggeration: 2};
        map.addSource('terrain-source-id', {
            "type": "raster-dem",
            "tiles": [
                "https://tiles/{z}-{x}-{y}.terrain.png"
            ]
        });
        map.setTerrain(terrain);
        await waitFor(map, "idle");
        expect(map.getStyle()).toEqual(extend(createStyle(), {
            terrain, 'sources': map.getStyle().sources
        }));
    });

    test('returns the style with added fog', async () => {
        const style = createStyle();
        const map = createMap({style});

        await waitFor(map, "load");
        const fog = {
            "range": [2, 5],
            "color": "blue"
        };
        map.setFog(fog);

        const fogDefaults = Object
            .entries(styleSpec.fog)
            .reduce((acc, [key, value]) => {
                acc[key] = value.default;
                return acc;
            }, {});

        const fogWithDefaults = extend({}, fogDefaults, fog);
        expect(map.getStyle()).toEqual(extend(createStyle(), {fog: fogWithDefaults}));
        expect(map.getFog()).toBeTruthy();
    });

    test('returns the style with removed fog', async () => {
        const style = createStyle();
        style['fog'] = {
            "range": [2, 5],
            "color": "white"
        };
        const map = createMap({style});

        await waitFor(map, "load");
        map.setFog(null);
        expect(map.getStyle()).toEqual(createStyle());
        expect(map.getFog()).toEqual(null);
    });

    test('fires an error on checking if non-existant source is loaded', async () => {
        const style = createStyle();
        const map = createMap({style});

        await waitFor(map, "load");
        await new Promise(resolve => {
            map.on("error", ({error}) => {
                expect(error.message).toMatch(/There is no source with ID/);
                resolve();
            });
            map.isSourceLoaded('geojson');
        });
    });

    test('returns the style with added layers', async () => {
        const style = createStyle();
        const map = createMap({style});
        const layer = {
            id: 'background',
            type: 'background'
        };

        await waitFor(map, "load");
        map.addLayer(layer);
        expect(map.getStyle()).toEqual(extend(createStyle(), {
            layers: [layer]
        }));
    });

    test('a layer can be added even if a map is created without a style', () => {
        const map = createMap({deleteStyle: true});
        const layer = {
            id: 'background',
            type: 'background'
        };
        map.addLayer(layer);
    });

    test('a source can be added even if a map is created without a style', () => {
        const map = createMap({deleteStyle: true});
        const source = createStyleSource();
        map.addSource('fill', source);
    });

    test('returns the style with added source and layer', async () => {
        const style = createStyle();
        const map = createMap({style});
        const source = createStyleSource();
        const layer = {
            id: 'fill',
            type: 'fill',
            source: 'fill'
        };

        await waitFor(map, "load");
        map.addSource('fill', source);
        map.addLayer(layer);
        expect(map.getStyle()).toEqual(extend(createStyle(), {
            sources: {fill: source},
            layers: [layer]
        }));
    });

    test('creates a new Style if diff fails', () => {
        const style = createStyle();
        const map = createMap({style});
        vi.spyOn(map.style, 'setState').mockImplementation(() => {
            throw new Error('Dummy error');
        });
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        const previousStyle = map.style;
        map.setStyle(style);
        expect(map.style && map.style !== previousStyle).toBeTruthy();
    });

    test('creates a new Style if diff option is false', () => {
        const style = createStyle();
        const map = createMap({style});
        vi.spyOn(map.style, 'setState').mockImplementation(() => {
            expect.unreachable();
        });

        const previousStyle = map.style;
        map.setStyle(style, {diff: false});
        expect(map.style && map.style !== previousStyle).toBeTruthy();
    });
});
