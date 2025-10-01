// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import assert from 'assert';
import {describe, test, expect, waitFor, vi, createMap, doneAsync} from '../../../util/vitest';
import {getRequestBody, mockFetch} from '../../../util/network';
import {performanceEvent_} from '../../../../src/util/mapbox';

function createStyleJSON(properties) {
    return Object.assign({
        "version": 8,
        "sources": {},
        "layers": []
    }, properties);
}

describe('Map', () => {
    describe('Metrics', () => {
        test('disable performance metrics collection', async () => {
            const fetchSpy = vi.spyOn(window, 'fetch');
            const map = createMap({performanceMetricsCollection: false});
            await waitFor(map, "idle");
            map.triggerRepaint();
            await waitFor(map, "idle");
            expect(map._fullyLoaded).toBeTruthy();
            expect(map._loaded).toBeTruthy();
            expect(fetchSpy).not.toHaveBeenCalled();
        });

        test('default performance metrics collection', async () => {
            const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() => {
                return Promise.resolve(new Response(JSON.stringify({})));
            });
            const map = createMap({
                performanceMetricsCollection: true,
                accessToken: 'access-token'
            });
            await waitFor(map, "idle");
            map.triggerRepaint();
            await waitFor(map, "idle");
            expect(map._fullyLoaded).toBeTruthy();
            expect(map._loaded).toBeTruthy();

            async function getEventNames() {
                const events = await Promise.all(fetchSpy.mock.calls.map(async ([arg]: [any]) => {
                    const requestBody = await getRequestBody(arg);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                    return JSON.parse(requestBody.slice(1, requestBody.length - 1));
                }));

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                return events.map(e => e.event);
            }
            expect(await getEventNames()).toEqual([
                'style.load',
                'gljs.performance'
            ]);
            performanceEvent_.pendingRequest = null;
        });

        test('performance metrics event stores explicit projection', async () => {
            const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() => {
                return Promise.resolve(new Response(JSON.stringify({})));
            });
            const map = createMap({
                performanceMetricsCollection: true,
                projection: 'globe',
                zoom: 20,
                accessToken: 'access-token'
            });

            await waitFor(map, "idle");
            map.triggerRepaint();
            await waitFor(map, "idle");
            expect(map._fullyLoaded).toBeTruthy();
            expect(map._loaded).toBeTruthy();
            const reqBody = await getRequestBody(fetchSpy.mock.calls[1][0]);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
            const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));
            const checkMetric = (data, metricName, metricValue) => {
                for (const metric of data) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (metric.name === metricName) {
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        expect(metric.value).toEqual(metricValue);
                        return;
                    }
                }
                assert(false);
            };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            checkMetric(performanceEvent.attributes, 'projection', 'globe');
            performanceEvent_.pendingRequest = null;
        });

        describe('Style loading event', () => {
            function getStyleLoadEventChecker(payload) {
                return async (request, doneRef) => {
                    const reqBody = await getRequestBody(request);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                    const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                    if (performanceEvent.event !== 'style.load') {
                        return new Response(JSON.stringify({}));
                    }

                    expect(performanceEvent).toEqual(payload);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    doneRef.resolve();

                    return new Response(JSON.stringify({}));
                };
            }

            test('should not add imported styles for standard-like style', () => {
                const {wait, withAsync} = doneAsync();

                mockFetch({
                    '/style.json': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            schema: {
                                showPlaceLabels: {
                                    default: true,
                                    type: "boolean"
                                },
                            }
                        })));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(getStyleLoadEventChecker({
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: new URL('/style.json', location.href).toString(),
                        skuId: undefined,
                        skuToken: undefined,
                        userId: undefined
                    }))
                });

                createMap({
                    performanceMetricsCollection: true,
                    style: '/style.json',
                    accessToken: 'access-token'
                });

                return wait;
            });

            test('should strip query parameters from URLs', () => {
                const {wait, withAsync} = doneAsync();

                mockFetch({
                    '/standard.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://api.mapbox.com/styles/v1/mapbox/standard': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/style.json': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            imports: [
                                {
                                    id: 'other',
                                    url: '/standard.json?sensitive=true&security=true'
                                },
                                {
                                    id: 'basemap',
                                    url: 'mapbox://styles/mapbox/standard?some_param=42'
                                }
                            ]
                        })));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(getStyleLoadEventChecker({
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: new URL('/style.json', location.href).toString(),
                        importedStyles: [
                            new URL('/standard.json', location.href).toString(),
                            'mapbox://styles/mapbox/standard?some_param=42'
                        ]
                    }))
                });

                createMap({
                    performanceMetricsCollection: true,
                    style: '/style.json?secret=true',
                    accessToken: 'access-token'
                });

                return wait;
            });

            test('should send style load event with style', async () => {
                const {wait, withAsync} = doneAsync();

                mockFetch({
                    'https://localhost:8080/style.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(getStyleLoadEventChecker({
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'https://localhost:8080/style.json'
                    })),
                });

                createMap({
                    performanceMetricsCollection: true,
                    style: 'https://localhost:8080/style.json',
                    accessToken: 'access-token'
                });

                return wait;
            });

            test('should send style load event with imported style', async () => {
                const {wait, withAsync} = doneAsync();

                mockFetch({
                    '/standard.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(getStyleLoadEventChecker({
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'json://1187918353',
                        importedStyles: [
                            new URL('/standard.json', location.href).toString()
                        ]
                    })),
                });

                createMap({
                    performanceMetricsCollection: true,
                    style: {
                        version: 8,
                        imports: [
                            {
                                id: 'basemap',
                                url: '/standard.json'
                            }
                        ],
                        layers: [],
                        sources: {}
                    },
                    accessToken: 'access-token'
                });

                return wait;
            });

            test('should send style load event with nested imported style', async () => {
                const {wait, withAsync} = doneAsync();

                mockFetch({
                    '/standard.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/standard-2.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/supplement.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/roads.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(getStyleLoadEventChecker({
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'json://4028586463',
                        importedStyles: [
                            'json://2572277275',
                            'json://978922503',
                            new URL('/standard-2.json', location.href).toString(),
                            new URL('/roads.json', location.href).toString(),
                            'json://3288768429',
                            new URL('/standard.json', location.href).toString(),
                        ]
                    })),
                });

                createMap({
                    performanceMetricsCollection: true,
                    style: {
                        version: 8,
                        imports: [
                            {
                                id: 'supplement',
                                url: '/supplement.json',
                                data: {
                                    version: 8,
                                    layers: [],
                                    sources: {},
                                    imports: [
                                        {
                                            id: 'inner',
                                            url: '/inner.json',
                                            data: {
                                                version: 8,
                                                layers: [],
                                                sources: {},
                                                imports: [
                                                    {
                                                        id: 'basemap-2',
                                                        url: '/standard-2.json'
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                id: 'roads',
                                url: '/roads.json'
                            },
                            {
                                id: 'wrapper',
                                url: '/non-standard.json',
                                data: {
                                    version: 8,
                                    layers: [],
                                    sources: {},
                                    imports: [
                                        {
                                            id: 'basemap',
                                            url: '/standard.json'
                                        }
                                    ]
                                }
                            }
                        ],
                        layers: [],
                        sources: {}
                    },
                    accessToken: 'access-token'
                });

                return wait;
            });

            test('should send style load events in sequence after style URL switch',  async () => {
                const {wait, withAsync} = doneAsync();

                let styleLoadEventCounter = 0;
                let mapInstanceId = null;

                const expected = [
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'mapbox://styles/mapbox/standard',
                    },
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 1,
                        style: new URL('/another.json', location.href).toString(),
                    }
                ];

                mockFetch({
                    'https://api.mapbox.com/styles/v1/mapbox/standard': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            layers: [
                                {
                                    id: 'background',
                                    type: 'background',
                                    paint: {
                                        'background-color': '#000'
                                    }
                                }
                            ]
                        })));
                    },
                    '/another.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(async (request, doneRef) => {
                        const reqBody = await getRequestBody(request);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                        const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (performanceEvent.event !== 'style.load') {
                            return new Response(JSON.stringify({}));
                        }

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId = reqBody.mapInstanceId;

                        const index = styleLoadEventCounter++;

                        expect(performanceEvent).toEqual({
                            ...expected[index],
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            mapInstanceId: mapInstanceId || expected[index].mapInstanceId
                        });

                        assert(styleLoadEventCounter <= expected.length, 'More then expected "style.load" events');

                        if (styleLoadEventCounter === expected.length) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            doneRef.resolve();
                        }

                        return new Response(JSON.stringify({}));
                    }),
                });

                const map = createMap({
                    performanceMetricsCollection: true,
                    style: 'mapbox://styles/mapbox/standard',
                    accessToken: 'access-token'
                });

                await waitFor(map, 'load');

                map.setStyle('/another.json');

                return wait;
            });

            test('should send style load events in sequence after style JSON switch', async () => {
                const {wait, withAsync} = doneAsync();

                let styleLoadEventCounter = 0;
                let mapInstanceId = null;

                const expected = [
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'mapbox://styles/mapbox/standard',
                    },
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 1,
                        style: 'json://684132956',
                        importedStyles: [
                            new URL('/standard-2.json', location.href).toString(),
                            new URL('/standard-3.json', location.href).toString()
                        ]
                    }
                ];

                mockFetch({
                    'https://api.mapbox.com/styles/v1/mapbox/standard': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/standard-2.json': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            imports: [
                                {
                                    id: 'inner',
                                    url: '/standard-3.json'
                                }
                            ]
                        })));
                    },
                    '/standard-3.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(async (request, doneRef) => {
                        const reqBody = await getRequestBody(request);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                        const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (performanceEvent.event !== 'style.load') {
                            return new Response(JSON.stringify({}));
                        }

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId = reqBody.mapInstanceId;

                        const index = styleLoadEventCounter++;

                        expect(performanceEvent).toEqual({
                            ...expected[index],
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            mapInstanceId: mapInstanceId || expected[index].mapInstanceId
                        });

                        assert(styleLoadEventCounter <= expected.length, 'More then expected "style.load" events');

                        if (styleLoadEventCounter === expected.length) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            doneRef.resolve();
                        }

                        return new Response(JSON.stringify({}));
                    }),
                });

                const map = createMap({
                    performanceMetricsCollection: true,
                    style: 'mapbox://styles/mapbox/standard',
                    accessToken: 'access-token'
                });

                await waitFor(map, 'load');

                map.setStyle({
                    version: 8,
                    imports: [
                        {
                            id: 'basemap',
                            url: '/standard-2.json'
                        }
                    ],
                    layers: [],
                    sources: {}
                });

                return wait;
            });

            test('should send second event after switch from standard-like style to import', async () => {
                const {wait, withAsync} = doneAsync();

                let styleLoadEventCounter = 0;
                let mapInstanceId = null;

                const expected = [
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 0,
                        style: 'mapbox://styles/mapbox/standard',
                    },
                    {
                        event: 'style.load',
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        created: expect.any(String),
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId: expect.any(String),
                        eventId: 1,
                        style: new URL('/another.json', location.href).toString(),
                        importedStyles: [
                            new URL('/second.json', location.href).toString(),
                            new URL('/inner.json', location.href).toString()
                        ]
                    }
                ];

                mockFetch({
                    'https://api.mapbox.com/styles/v1/mapbox/standard': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            schema: {
                                showPlaceLabels: {
                                    default: true,
                                    type: "boolean"
                                },
                            }
                        })));
                    },
                    '/inner.json': () => {
                        return new Response(JSON.stringify(createStyleJSON()));
                    },
                    '/second.json': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            imports: [
                                {
                                    id: 'inner',
                                    url: '/inner.json'
                                },
                            ]
                        })));
                    },
                    '/another.json': () => {
                        return new Response(JSON.stringify(createStyleJSON({
                            imports: [
                                {
                                    id: 'second',
                                    url: '/second.json'
                                }
                            ]
                        })));
                    },
                    'https://events.mapbox.com/events/v2': withAsync(async (request, doneRef) => {
                        const reqBody = await getRequestBody(request);
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                        const performanceEvent = JSON.parse(reqBody.slice(1, reqBody.length - 1));

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        if (performanceEvent.event !== 'style.load') {
                            return new Response(JSON.stringify({}));
                        }

                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        mapInstanceId = reqBody.mapInstanceId;

                        const index = styleLoadEventCounter++;

                        expect(performanceEvent).toEqual({
                            ...expected[index],
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                            mapInstanceId: mapInstanceId || expected[index].mapInstanceId
                        });

                        assert(styleLoadEventCounter <= expected.length, 'More then expected "style.load" events');

                        if (styleLoadEventCounter === expected.length) {
                            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                            doneRef.resolve();
                        }

                        return new Response(JSON.stringify({}));
                    }),
                });

                const map = createMap({
                    performanceMetricsCollection: true,
                    style: 'mapbox://styles/mapbox/standard',
                    accessToken: 'access-token'
                });

                await waitFor(map, 'load');

                map.setStyle('/another.json');

                return wait;
            });
        });

        test('sends appearance event', async () => {
            const fetchSpy = vi.spyOn(window, 'fetch').mockImplementation(() => {
                return Promise.resolve(new Response(JSON.stringify({})));
            });
            const map = createMap({
                accessToken: 'access-token',
                style: {
                    version: 8,
                    sources: {
                        "fake": {
                            "type": "geojson",
                            "data": {
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [-77.0323, 38.9131]
                                },
                                "properties": {
                                    "title": "Mapbox DC",
                                    "marker-symbol": "monument"
                                }
                            }
                        }
                    },
                    layers: [
                        {
                            id: 'layer-with-appearances',
                            source: 'fake',
                            type: 'symbol',
                            layout: {
                                "icon-image": "charging-station",
                                "icon-size": 1.2
                            },
                            appearances: [
                                {
                                    "condition": ["==", ["feature-state", "availability"], "partial"],
                                    "properties": {
                                        "icon-image": ["image", "charging-station", {"params": {"fill": "orange"}}],
                                        "icon-size": 1.1
                                    }
                                },
                                {
                                    "condition": ["==", ["feature-state", "availability"], "none"],
                                    "properties": {
                                        "icon-image": ["image", "charging-station", {"params": {"fill": "red"}}],
                                        "icon-size": 1
                                    }
                                }
                            ]
                        }
                    ]
                }
            });
            await waitFor(map, "idle");
            map.triggerRepaint();
            await waitFor(map, "idle");
            expect(map._fullyLoaded).toBeTruthy();
            expect(map._loaded).toBeTruthy();

            async function getEventNames() {
                const events = await Promise.all(fetchSpy.mock.calls.map(async ([arg]: [any]) => {
                    const requestBody = await getRequestBody(arg);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call
                    return JSON.parse(requestBody.slice(1, requestBody.length - 1));
                }));

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                return events.map(e => e.event);
            }
            expect(await getEventNames()).toEqual([
                'style.load',
                'metrics'
            ]);
            performanceEvent_.pendingRequest = null;
        });
    });
});
