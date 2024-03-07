import {describe, test, expect, waitFor, vi, createMap} from '../../../util/vitest.js';
import {getPNGResponse} from '../../../util/network.js';

describe('Map#properties', () => {
    describe('#setLayoutProperty', () => {
        // t.setTimeout(2000);
        test('sets property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "geojson": {
                            "type": "geojson",
                            "data": {
                                "type": "FeatureCollection",
                                "features": []
                            }
                        }
                    },
                    "layers": [{
                        "id": "symbol",
                        "type": "symbol",
                        "source": "geojson",
                        "layout": {
                            "text-transform": "uppercase"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.style.dispatcher.broadcast = function(key, value) {
                expect(key).toEqual('updateLayers');
                expect(value.layers.map((layer) => { return layer.id; })).toEqual(['symbol']);
            };

            map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            map.style.update({});
            expect(map.getLayoutProperty('symbol', 'text-transform')).toEqual('lowercase');
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setLayoutProperty('symbol', 'text-transform', 'lowercase');
            }).toThrowError(Error);
        });

        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");

            await new Promise(resolve => {
                map.once("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });
                map.setLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });

        test('fires a data event on background layer', async () => {
            // background layers do not have a source
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.once("data", (e) => {
                    if (e.dataType === 'style') {
                        resolve();
                    }
                });

                map.setLayoutProperty('background', 'visibility', 'visible');
            });
        });

        test('fires a data event on sky layer', async () => {
            // sky layers do not have a source
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "sky",
                        "type": "sky",
                        "layout": {
                            "visibility": "none"
                        },
                        "paint": {
                            "sky-type": "atmosphere",
                            "sky-atmosphere-sun": [0, 0]
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.once("data", (e) => {
                    if (e.dataType === 'style') {
                        resolve();
                    }
                });

                map.setLayoutProperty('sky', 'visibility', 'visible');
            });
        });

        test('sets visibility on background layer', async () => {
            // background layers do not have a source
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setLayoutProperty('background', 'visibility', 'visible');
            expect(map.getLayoutProperty('background', 'visibility')).toEqual('visible');
        });

        test('sets visibility on raster layer', async () => {
            vi.spyOn(window, 'fetch').mockImplementation(async () => {
                const res = await getPNGResponse();
                return new window.Response(res);
            });
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "mapbox://mapbox.satellite": {
                            "type": "raster",
                            "tiles": ["http://example.com/{z}/{x}/{y}.png"]
                        }
                    },
                    "layers": [{
                        "id": "satellite",
                        "type": "raster",
                        "source": "mapbox://mapbox.satellite",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setLayoutProperty('satellite', 'visibility', 'visible');
            expect(map.getLayoutProperty('satellite', 'visibility')).toEqual('visible');
            await waitFor(map, "idle");
        });

        test('sets visibility on video layer', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "drone": {
                            "type": "video",
                            "urls": [],
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "shore",
                        "type": "raster",
                        "source": "drone",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setLayoutProperty('shore', 'visibility', 'visible');
            expect(map.getLayoutProperty('shore', 'visibility')).toEqual('visible');
        });

        test('sets visibility on image layer', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {
                        "image": {
                            "type": "image",
                            "url": "",
                            "coordinates": [
                                [-122.51596391201019, 37.56238816766053],
                                [-122.51467645168304, 37.56410183312965],
                                [-122.51309394836426, 37.563391708549425],
                                [-122.51423120498657, 37.56161849366671]
                            ]
                        }
                    },
                    "layers": [{
                        "id": "image",
                        "type": "raster",
                        "source": "image",
                        "layout": {
                            "visibility": "none"
                        }
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setLayoutProperty('image', 'visibility', 'visible');
            expect(map.getLayoutProperty('image', 'visibility')).toEqual('visible');
        });
    });

    describe('#getLayoutProperty', () => {
        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });

                map.getLayoutProperty('non-existant', 'text-transform', 'lowercase');
            });
        });
    });

    describe('#setPaintProperty', () => {
        // t.setTimeout(2000);
        test('sets property', async () => {
            const map = createMap({
                style: {
                    "version": 8,
                    "sources": {},
                    "layers": [{
                        "id": "background",
                        "type": "background"
                    }]
                }
            });

            await waitFor(map, "style.load");
            map.setPaintProperty('background', 'background-color', 'red');
            expect(map.getPaintProperty('background', 'background-color')).toEqual('red');
        });

        test('throw before loaded', () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            expect(() => {
                map.setPaintProperty('background', 'background-color', 'red');
            }).toThrowError(Error);
        });

        test('fires an error if layer not found', async () => {
            const map = createMap({
                style: {
                    version: 8,
                    sources: {},
                    layers: []
                }
            });

            await waitFor(map, "style.load");
            await new Promise(resolve => {
                map.on("error", ({error}) => {
                    expect(error.message).toMatch(/does not exist in the map\'s style/);
                    resolve();
                });

                map.setPaintProperty('non-existant', 'background-color', 'red');
            });
        });
    });
});
