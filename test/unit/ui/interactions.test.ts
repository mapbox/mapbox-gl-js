import {vi, describe, test, afterEach, expect, waitFor, createMap} from '../../util/vitest';
import {mockFetch} from '../../util/network';

import type {Mock} from 'vitest';
import type {Map} from '../../../src/ui/map';
import type {InteractionEvent} from '../../../src/ui/interactions';

const style = {
    "version": 8,
    "imports": [
        {
            "id": "nested",
            "url": "",
            "data": {
                "version": 8,
                "featuresets": {
                    "poi": {
                        "selectors": [
                            {
                                "layer": "poi-label-1",
                                "featureNamespace": "A",
                                "properties": {
                                    "type": ["get", "type"],
                                    "name": ["get", "name"],
                                    "others": ["get", "others"]
                                },
                            }
                        ]
                    }
                },
                "sources": {
                    "geojson": {
                        "type": "geojson",
                        "data": {
                            "type": "FeatureCollection",
                            "features": [
                                {
                                    "type": "Feature",
                                    "properties": {
                                        "filter": "true",
                                        "name": "nest1",
                                        "type": "A",
                                        "others": 5
                                    },
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [0, 0]
                                    },
                                    "id": 11
                                },
                                {
                                    "type": "Feature",
                                    "properties": {
                                        "name": "nest2",
                                        "type": "B",
                                        "others": 4
                                    },
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [0, 0]
                                    },
                                    "id": 12
                                },
                                {
                                    "type": "Feature",
                                    "properties": {
                                        "name": "nest3",
                                        "type": "C",
                                        "others": 4
                                    },
                                    "geometry": {
                                        "type": "Point",
                                        "coordinates": [0.01, 0.01]
                                    },
                                    "id": 13
                                }
                            ]
                        }
                    }
                },
                "layers": [
                    {
                        "id": "bg",
                        "type": "background"
                    },
                    {
                        "id": "poi-label-1",
                        "type": "circle",
                        "source": "geojson"
                    }
                ]
            }
        }
    ],
    "sources": {
        "geojson": {
            "type": "geojson",
            "promoteId": "foo",
            "data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {"filter": "true", "foo": 1},
                        "geometry": {"type": "Point", "coordinates": [0, 0]}
                    },
                    {
                        "type": "Feature",
                        "properties": {"foo": 2},
                        "geometry": {"type": "Point", "coordinates": [0, 0]}
                    },
                    {
                        "type": "Feature",
                        "properties": {"foo": 3},
                        "geometry": {"type": "Point", "coordinates": [0.01, 0.01]}
                    }
                ]
            }
        },
        "geojson2": {
            "type": "geojson",
            "data": {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "id": 4,
                        "properties": {"filter": "true", "foo": "foo-value"},
                        "geometry": {"type": "Point", "coordinates": [0.02, 0.02]},
                    }
                ]
            }
        }
    },
    "featuresets": {
        "circle-2-featureset": {
            "selectors": [
                {
                    "layer": "circle-2",
                    "properties": {
                        "bar": ["get", "foo"],
                        "baz": "constant"
                    },
                    "featureNamespace": "X"
                }
            ]
        }
    },
    "layers": [
        {
            "id": "background",
            "type": "background",
            "paint": {
                "background-color": "green"
            }
        },
        {
            "id": "circle-1",
            "type": "circle",
            "source": "geojson"
        },
        {
            "id": "circle-2",
            "type": "circle",
            "source": "geojson2"
        }
    ]
};

function dispatchEvent(map: Map, type: string, {x, y}: {x: number, y: number}) {
    const canvas = map.getCanvas();
    canvas.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: x, clientY: y}));
}

// Given a map of mocks, return an array of mock names in the order of their invocation.
function getCallSequence(mocks: Record<string, Mock>): string[] {
    const callSequence = Object.entries(mocks).reduce((acc: Record<number, string>, [name, {mock}]) => {
        mock.invocationCallOrder.forEach(order => { acc[order] = name; });
        return acc;
    }, {});
    return Object.values(callSequence);
}

describe('Interaction', () => {
    describe('Single Interaction on a layer with two features and one targetless Interaction', async () => {
        const map = createMap({
            style,
            zoom: 10,
            center: [0, 0],
        });

        await waitFor(map, 'load');

        const handler = vi.fn((_: InteractionEvent): boolean | void => {});
        map.addInteraction('click', {
            type: 'click',
            target: {layerId: 'circle-1'},
            handler
        });

        const targetlessHandler = vi.fn((_: InteractionEvent): boolean | void => {});
        map.addInteraction('no-target', {
            type: 'click',
            handler: targetlessHandler
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        const point = map.project({lng: 0, lat: 0});

        test('When handler returns `undefined`, it is called once with the topmost feature. Targetless handler is never called.', () => {
            handler.mockReturnValue(undefined);
            dispatchEvent(map, 'click', point);

            expect(targetlessHandler).toHaveBeenCalledTimes(0);
            expect(handler).toHaveBeenCalledTimes(1);

            const event = handler.mock.calls[0][0];
            expect(event.feature).toMatchObject({id: 2, properties: {foo: 2}});
        });

        test('When handler returns `true`, it is called once with the topmost feature. Targetless handler is never called.', () => {
            handler.mockReturnValue(true);
            dispatchEvent(map, 'click', point);

            expect(targetlessHandler).toHaveBeenCalledTimes(0);
            expect(handler).toHaveBeenCalledTimes(1);

            const event = handler.mock.calls[0][0];
            expect(event.feature).toMatchObject({id: 2, properties: {foo: 2}});
        });

        test('When handler returns `false`, it is called for each feature. Targetless handler is called once.', () => {
            handler.mockReturnValue(false);
            dispatchEvent(map, 'click', point);
            expect(handler).toHaveBeenCalledTimes(2);

            const event1 = handler.mock.calls[0][0];
            expect(event1.feature).toMatchObject({id: 2, properties: {foo: 2}});

            const event2 = handler.mock.calls[1][0];
            expect(event2.feature).toMatchObject({id: 1, properties: {foo: 1, filter: 'true'}});

            expect(targetlessHandler).toHaveBeenCalledTimes(1);
            const event3 = targetlessHandler.mock.calls[0][0];
            expect(event3.feature).toBeFalsy();
        });
    });

    describe('Interactions could target root-level layers and featuresets', async () => {
        const map = createMap({
            style,
            zoom: 10,
            center: [0, 0],
        });

        await waitFor(map, 'load');

        const layerClick = vi.fn((_: InteractionEvent): boolean | void => {});
        map.addInteraction('layer-click', {
            type: 'click',
            target: {layerId: 'circle-1'},
            handler: layerClick
        });

        const featuresetClick = vi.fn((_: InteractionEvent): boolean | void => {});
        map.addInteraction('featureset-click', {
            type: 'click',
            target: {featuresetId: 'circle-2-featureset', importId: ''},
            handler: featuresetClick
        });

        const mapClick = vi.fn((_: InteractionEvent): boolean | void => {});
        map.addInteraction('map-click', {
            type: 'click',
            handler: mapClick
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        test('Click 1, layer1', () => {
            layerClick
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(true);

            const point = map.project({lng: 0, lat: 0});
            dispatchEvent(map, 'click', point);

            expect(layerClick).toHaveBeenCalledTimes(2);
            expect(featuresetClick).toHaveBeenCalledTimes(0);
            expect(mapClick).toHaveBeenCalledTimes(0);

            let event = layerClick.mock.calls[0][0];
            expect(event.feature).toMatchObject({id: 2, properties: {'foo': 2}});

            event = layerClick.mock.calls[1][0];
            expect(event.feature).toMatchObject({id: 1, properties: {'foo': 1, 'filter': 'true'}});
        });

        test('Click 2, root featureset', () => {
            featuresetClick.mockReturnValueOnce(false);

            const point = map.project({lng: 0.02, lat: 0.02});
            dispatchEvent(map, 'click', point);

            expect(layerClick).toHaveBeenCalledTimes(0);
            expect(featuresetClick).toHaveBeenCalledTimes(1);
            expect(mapClick).toHaveBeenCalledTimes(1);

            let event = featuresetClick.mock.calls[0][0];
            expect(event.feature).toMatchObject({id: 4, properties: {bar: 'foo-value', baz: 'constant'}});

            event = mapClick.mock.calls[0][0];
            expect(event.feature).toBeFalsy();
        });

        test('Click 3, map', () => {
            const point = map.project({lng: -0.01, lat: -0.01});
            dispatchEvent(map, 'click', point);

            expect(layerClick).toHaveBeenCalledTimes(0);
            expect(featuresetClick).toHaveBeenCalledTimes(0);
            expect(mapClick).toHaveBeenCalledTimes(1);

            const event = mapClick.mock.calls[0][0];
            expect(event.feature).toBeFalsy();
        });
    });

    describe('Interactions could target root-level layers and featuresets with delegated event listeners like hover', async () => {
        const map = createMap({
            style,
            zoom: 10,
            center: [0, 0],
        });
        const point = map.project({lng: 0.01, lat: 0.01});

        await waitFor(map, 'load');

        const mouseleave = vi.fn((e: InteractionEvent): boolean | void => {
            map.setFeatureState(e.feature, {hover: false});
        });

        map.addInteraction('mouseleave', {
            type: 'mouseleave',
            target: {layerId: 'circle-1'},
            handler: mouseleave
        });

        test('Mouseleave without mouseenter does not work', () => {
            dispatchEvent(map, 'mousemove', point);

            expect(mouseleave).toHaveBeenCalledTimes(0);
        });

        test('Hover with setFeatureState', () => {
            const mouseenter = vi.fn((e: InteractionEvent): boolean | void => {
                map.setFeatureState(e.feature, {hover: true});
            });

            map.addInteraction('mouseenter', {
                type: 'mouseenter',
                target: {layerId: 'circle-1'},
                handler: mouseenter
            });

            // hover events are delegated to `mousemove` and `mouseout`
            dispatchEvent(map, 'mousemove', point);
            dispatchEvent(map, 'mouseout', point);
            dispatchEvent(map, 'mousemove', point);

            expect(mouseenter).toHaveBeenCalledTimes(2);
            expect(mouseleave).toHaveBeenCalledTimes(1);

            let event = mouseenter.mock.calls[0][0];
            expect(event.feature).toMatchObject({
                id: 3,
                namespace: undefined,
                target: {layerId: 'circle-1'},
                properties: {foo: 3},
                state: {} // initial state
            });

            event = mouseleave.mock.calls[0][0];
            expect(event.feature).toMatchObject({
                id: 3,
                namespace: undefined,
                target: {layerId: 'circle-1'},
                properties: {foo: 3},
                state: {hover: true} // state after mousemove
            });

            event = mouseenter.mock.calls[1][0];
            expect(event.feature).toMatchObject({
                id: 3,
                namespace: undefined,
                target: {layerId: 'circle-1'},
                properties: {foo: 3},
                state: {hover: false} // state after mouseleave
            });
        });
    });

    describe('Interactions could target layers and featuresets in imported style with event propagation', async () => {
        const map = createMap({
            style,
            zoom: 10,
            center: [0, 0],
        });

        await waitFor(map, 'load');

        // 2 features with types A and B
        const poiClick = vi.fn((_: InteractionEvent) => false);
        map.addInteraction('poi-click', {
            type: 'click',
            target: {featuresetId: 'poi', importId: 'nested'},
            handler: poiClick
        });

        // 1 feature with type A
        const poiClickTypeA = vi.fn((_: InteractionEvent) => false);
        map.addInteraction('poi-click-type-A', {
            type: 'click',
            target: {featuresetId: 'poi', importId: 'nested'},
            filter: ['==', ['get', 'type'], 'A'],
            handler: poiClickTypeA
        });

        // 1 feature with type B
        const poiClickTypeB = vi.fn((_: InteractionEvent) => false);
        map.addInteraction('poi-click-type-B', {
            type: 'click',
            target: {featuresetId: 'poi', importId: 'nested'},
            filter: ['==', ['get', 'type'], 'B'],
            handler: poiClickTypeB
        });

        const mapClick = vi.fn();
        map.addInteraction('map-click', {
            type: 'click',
            handler: mapClick
        });

        afterEach(() => {
            vi.clearAllMocks();
        });

        test('Click 1 #debug', () => {
            const point = map.project({lng: 0.0, lat: 0.0});
            dispatchEvent(map, 'click', point);

            // Each filtered interaction handler returns false, so each feature is handled by every possible handler.
            expect(poiClick).toHaveBeenCalledTimes(2);
            expect(poiClickTypeA).toHaveBeenCalledTimes(1);
            expect(poiClickTypeB).toHaveBeenCalledTimes(1);

            // When no specific handler handled the interaction, the map itself handles it
            expect(mapClick).toHaveBeenCalledTimes(1);

            // order of calls: B, common with feature B, A, common with featureA, map
            const callSequence = getCallSequence({poiClick, poiClickTypeA, poiClickTypeB, mapClick});

            expect(callSequence).toEqual([
                'poiClickTypeB',
                'poiClick',
                'poiClickTypeA',
                'poiClick',
                'mapClick'
            ]);

            const event = poiClickTypeB.mock.calls[0][0];
            expect(event.feature).toMatchObject({
                id: 12,
                namespace: 'A',
                geometry: {type: 'Point', coordinates: [0, 0]},
                properties: {name: 'nest2', type: 'B', others: 4}
            });
        });

        test('Click 2, poi with type A handles it', () => {
            poiClickTypeA.mockReturnValueOnce(true);

            const point = map.project({lng: 0.0, lat: 0.0});
            dispatchEvent(map, 'click', point);

            // Handling sequence:
            // - poiClickTypeB, because it is rendered top-most, and the poiClickTypeB added latest
            // - poiClick with feature B as argumnent
            // - poiClickTypeA, because it's rendered below
            // - poiClick and mapClick don't receive any more call because poiClickTypeA handled it.
            expect(getCallSequence({poiClick, poiClickTypeA, poiClickTypeB, mapClick})).toEqual([
                'poiClickTypeB',
                'poiClick',
                'poiClickTypeA'
            ]);
        });
    });

    describe('Interactions could target layers and featuresets in imported style with delegated event listeners like hover', async () => {
        const map = createMap({
            style,
            zoom: 10,
            center: [0, 0],
        });

        await waitFor(map, 'load');

        const mouseenter = vi.fn((e: InteractionEvent): boolean | void => {
            map.setFeatureState(e.feature, {hover: true});
        });

        map.addInteraction('mouseenter', {
            type: 'mouseenter',
            target: {featuresetId: 'poi', importId: 'nested'},
            handler: mouseenter
        });

        const mouseleave = vi.fn((e: InteractionEvent): boolean | void => {
            map.setFeatureState(e.feature, {hover: false});
        });

        map.addInteraction('mouseleave', {
            type: 'mouseleave',
            target: {featuresetId: 'poi', importId: 'nested'},
            handler: mouseleave
        });

        test('Hover with setFeatureState', () => {
            const point = map.project({lng: 0.01, lat: 0.01});

            // hover events are delegated to `mousemove` and `mouseout`
            dispatchEvent(map, 'mousemove', point);
            dispatchEvent(map, 'mouseout', point);
            dispatchEvent(map, 'mousemove', point);

            expect(mouseenter).toHaveBeenCalledTimes(2);
            expect(mouseleave).toHaveBeenCalledTimes(1);

            let event = mouseenter.mock.calls[0][0];
            expect(event.feature).toMatchObject({
                id: 13,
                namespace: 'A',
                target: {featuresetId: 'poi', importId: 'nested'},
                properties: {name: 'nest3', type: 'C', others: 4},
                state: {} // initial state
            });

            event = mouseleave.mock.calls[0][0];
            expect(event.feature).toMatchObject({
                id: 13,
                namespace: 'A',
                target: {featuresetId: 'poi', importId: 'nested'},
                properties: {name: 'nest3', type: 'C', others: 4},
                state: {hover: true} // state after mousemove
            });

            event = mouseenter.mock.calls[1][0];
            expect(event.feature).toMatchObject({
                id: 13,
                namespace: 'A',
                target: {featuresetId: 'poi', importId: 'nested'},
                properties: {name: 'nest3', type: 'C', others: 4},
                state: {hover: false} // state after mouseleave
            });
        });
    });

    test('Interaction does not throw before style is loaded', () => {
        mockFetch({
            '/style.json': () => Promise.resolve(new Response(JSON.stringify(style)))
        });

        const map = createMap({
            zoom: 10,
            center: [0, 0],
            style: '/style.json'
        });

        map.addInteraction('layer-click', {
            type: 'click',
            target: {layerId: 'circle-1'},
            handler: vi.fn()
        });

        map.addInteraction('featureset-click', {
            type: 'click',
            target: {featuresetId: 'circle-2-featureset', importId: ''},
            handler: vi.fn()
        });

        map.addInteraction('map-click', {
            type: 'click',
            handler: vi.fn()
        });

        map.addInteraction('poi-click', {
            type: 'click',
            target: {featuresetId: 'poi', importId: 'nested'},
            handler: vi.fn()
        });

        expect(() => {
            const point = map.project({lng: 0.0, lat: 0.0});
            dispatchEvent(map, 'click', point);
        }).not.toThrowError();
    });
});
