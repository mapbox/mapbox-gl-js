// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest';
import {createStyle, createStyleSource} from './util';
import styleSpec from '../../../../src/style-spec/reference/latest';

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
        expect(map.getStyle()).toEqual(Object.assign(createStyle(), {
            sources: {geojson: createStyleSource()}
        }));
    });

    test('returns the style with added terrain', async () => {
        const style = createStyle();
        const map = createMap({style});

        await waitFor(map, "load");
        const terrain = {source: "terrain-source-id", exaggeration: 2};
        const terrainSource = {
            "type": "raster-dem",
            "tiles": [
                "https://tiles/{z}-{x}-{y}.terrain.png"
            ]
        };
        map.addSource('terrain-source-id', terrainSource);
        map.setTerrain(terrain);
        expect(map.getStyle()).toEqual(Object.assign(createStyle(), {
            terrain, sources: {'terrain-source-id': terrainSource}
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
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            .entries(styleSpec.fog)
            .reduce<Record<string, any>>((acc, [key, value]: [any, any]) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                acc[key] = value.default;
                return acc;
            }, {});

        const fogWithDefaults = {...fogDefaults, ...fog};
        expect(map.getStyle()).toEqual(Object.assign(createStyle(), {fog: fogWithDefaults}));
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
        expect(map.getStyle()).toEqual(Object.assign(createStyle(), {
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
        expect(map.getStyle()).toEqual(Object.assign(createStyle(), {
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

    test('returns a copy that editing does not change the map', async () => {
        const style = createStyle();
        style['metadata'] = {a: {b: 1}};
        style['sources'] = {geo: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}};
        style['layers'] = [{id: 'circle', type: 'circle', source: 'geo', filter: ['==', ['get', 'a'], 1]}];
        const map = createMap({style});

        await waitFor(map, 'load');
        const before = JSON.stringify(map.getStyle());
        const copy = map.getStyle();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        copy.metadata.a.b = 2;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        copy.sources.geo.data.features.push({});
        copy.layers[0].filter.push('edited');

        expect(JSON.stringify(map.getStyle())).toEqual(before);
    });

    test('updateImport applies an import edited in place', async () => {
        const style = createStyle();
        const data = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': 'red'}}]};
        style['imports'] = [{id: 'basemap', url: '', data}];
        const map = createMap({style});

        await waitFor(map, 'load');
        const basemap = map.getStyle().imports[0];
        basemap.data.layers[0].paint['background-color'] = 'blue';
        map.updateImport('basemap', basemap);

        expect(map.getStyle().imports[0].data.layers[0].paint['background-color']).toEqual('blue');
    });

    test('returns the style with featuresets', async () => {
        const style = createStyle();
        style['featuresets'] = {
            'my-featureset': {
                'selectors': [{'layer': 'background'}]
            }
        };
        style['layers'] = [{'id': 'background', 'type': 'background'}];
        const map = createMap({style});

        await waitFor(map, 'load');
        expect(map.getStyle().featuresets).toEqual({
            'my-featureset': {
                'selectors': [{'layer': 'background'}]
            }
        });
    });
});
