import {vi, describe, test, afterEach, expect, waitFor, createMap} from '../../util/vitest';

import type {Map} from '../../../src/ui/map';

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
                                "properties": {
                                    "type": [
                                        "get",
                                        "type"
                                    ],
                                    "name": [
                                        "get",
                                        "name"
                                    ],
                                    "others": [
                                        "get",
                                        "others"
                                    ]
                                },
                                "featureNamespace": "A"
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
                                        "coordinates": [
                                            0,
                                            0
                                        ]
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
                                        "coordinates": [
                                            0,
                                            0
                                        ]
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
                                        "coordinates": [
                                            0.01,
                                            0.01
                                        ]
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
                        "properties": {
                            "filter": "true",
                            "foo": 1
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                0,
                                0
                            ]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "foo": 2
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                0,
                                0
                            ]
                        }
                    },
                    {
                        "type": "Feature",
                        "properties": {
                            "foo": 3
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                0.01,
                                0.01
                            ]
                        }
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
                        "properties": {
                            "filter": "true",
                            "foo": "foo-value"
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                0.02,
                                0.02
                            ]
                        },
                        "id": 4
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

function dispatchEvent(map: Map, type: string, lnglat: {lng: number, lat: number}) {
    const p = map.project(lnglat);
    const canvas = map.getCanvas();
    canvas.dispatchEvent(new MouseEvent(type, {bubbles: true, clientX: p.x, clientY: p.y}));
}

describe('Interaction 1', async () => {
    const map = createMap({
        style,
        zoom: 10,
        center: [0, 0],
    });

    await waitFor(map, 'load');

    const layer1Click = vi.fn();
    map.addInteraction('circle-1', {
        type: 'click',
        featureset: {layerId: 'circle-1'},
        handler: layer1Click
    });

    const featuresetClick = vi.fn();
    map.addInteraction('circle-2-featureset', {
        type: 'click',
        featureset: {featuresetId: 'circle-2-featureset', importId: ''},
        handler: featuresetClick
    });

    const mapClick = vi.fn();
    map.addInteraction('map-click', {
        type: 'click',
        handler: mapClick
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test('Click 1, layer1', () => {
        layer1Click
            .mockReturnValueOnce(false)
            .mockReturnValueOnce(true);

        dispatchEvent(map, 'click', {lng: 0, lat: 0});

        expect(layer1Click).toHaveBeenCalledTimes(2);
        expect(featuresetClick).toHaveBeenCalledTimes(0);
        expect(mapClick).toHaveBeenCalledTimes(0);

        let event = layer1Click.mock.calls[0][0];
        expect(event.feature).toMatchObject({id: 2, properties: {'foo': 2}});

        event = layer1Click.mock.calls[1][0];
        expect(event.feature).toMatchObject({id: 1, properties: {'foo': 1, 'filter': 'true'}});
    });

    test('Click 2, root featureset', () => {
        featuresetClick.mockReturnValueOnce(false);

        dispatchEvent(map, 'click', {lng: 0.02, lat: 0.02});

        expect(layer1Click).toHaveBeenCalledTimes(0);
        expect(featuresetClick).toHaveBeenCalledTimes(1);
        expect(mapClick).toHaveBeenCalledTimes(1);

        let event = featuresetClick.mock.calls[0][0];
        expect(event.feature).toMatchObject({id: 4, properties: {'bar': 'foo-value', 'baz': 'constant'}});

        event = mapClick.mock.calls[0][0];
        expect(event.feature).toBeFalsy();
    });

    test('Click 3, map', () => {
        dispatchEvent(map, 'click', {lng: -0.01, lat: -0.01});

        expect(layer1Click).toHaveBeenCalledTimes(0);
        expect(featuresetClick).toHaveBeenCalledTimes(0);
        expect(mapClick).toHaveBeenCalledTimes(1);

        const event = mapClick.mock.calls[0][0];
        expect(event.feature).toBeFalsy();
    });
});
