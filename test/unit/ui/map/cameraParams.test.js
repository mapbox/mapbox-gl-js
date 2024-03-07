import {describe, test, expect, createMap, vi, waitFor} from '../../../util/vitest.js';
import {MAX_MERCATOR_LATITUDE} from '../../../../src/geo/mercator_coordinate.js';
import {fixedLngLat, fixedNum} from '../../../util/fixed.js';

describe('Map#cameraParams', () => {
    describe('uses zero values for zoom and coordinates', () => {
        function getInitialMap() {
            return createMap({
                zoom: 0,
                center: [0, 0],
                style: {
                    version: 8,
                    sources: {},
                    layers: [],
                    center: [
                        -73.9749,
                        40.7736
                    ],
                    zoom: 4
                }
            });
        }

        test('should use these values instead of defaults from style', async () => {
            const map = getInitialMap();

            await waitFor(map, "load");
            expect(map.getZoom()).toEqual(0);
            expect(map.getCenter()).toEqual({lat: 0, lng: 0});
        });

        test('after setStyle should still use these values', async () => {
            const map = getInitialMap();

            await waitFor(map, "load");
            map.setStyle({
                version: 8,
                sources: {},
                layers: [],
                center: [
                    24.9384,
                    60.169
                ],
                zoom: 3
            });
            expect(map.getZoom()).toEqual(0);
            expect(map.getCenter()).toEqual({lat: 0, lng: 0});
        });
    });

    test('#setMinPitch', async () => {
        const map = createMap({pitch: 20});

        const onPitchStart = vi.fn();
        const onPitch = vi.fn();
        const onPitchEnd = vi.fn();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMinPitch(10);

        expect(onPitchStart).toHaveBeenCalledTimes(1);
        expect(onPitch).toHaveBeenCalledTimes(1);
        expect(onPitchEnd).toHaveBeenCalledTimes(1);

        map.setPitch(0);

        expect(onPitchStart).toHaveBeenCalledTimes(2);
        expect(onPitch).toHaveBeenCalledTimes(2);
        expect(onPitchEnd).toHaveBeenCalledTimes(2);

        expect(map.getPitch()).toEqual(10);
    });

    test('unset minPitch', () => {
        const map = createMap({minPitch: 20});
        map.setMinPitch(null);
        map.setPitch(0);
        expect(map.getPitch()).toEqual(0);
    });

    test('#getMinPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMinPitch()).toEqual(0);
        map.setMinPitch(10);
        expect(map.getMinPitch()).toEqual(10);
    });

    test('ignore minPitchs over maxPitch', () => {
        const map = createMap({pitch: 0, maxPitch: 10});
        expect(() => {
            map.setMinPitch(20);
        }).toThrowError();
        map.setPitch(0);
        expect(map.getPitch()).toEqual(0);
    });

    test('#setMaxPitch', async () => {
        const map = createMap({pitch: 0});

        const onPitchStart = vi.fn();
        const onPitch = vi.fn();
        const onPitchEnd = vi.fn();

        map.on('pitchstart', onPitchStart);
        map.on('pitch', onPitch);
        map.on('pitchend', onPitchEnd);

        map.setMaxPitch(10);

        expect(onPitchStart).toHaveBeenCalledTimes(1);
        expect(onPitch).toHaveBeenCalledTimes(1);
        expect(onPitchEnd).toHaveBeenCalledTimes(1);

        map.setPitch(20);

        expect(onPitchStart).toHaveBeenCalledTimes(2);
        expect(onPitch).toHaveBeenCalledTimes(2);
        expect(onPitchEnd).toHaveBeenCalledTimes(2);

        expect(map.getPitch()).toEqual(10);
    });

    test('unset maxPitch', () => {
        const map = createMap({maxPitch:10});
        map.setMaxPitch(null);
        map.setPitch(20);
        expect(map.getPitch()).toEqual(20);
    });

    test('#getMaxPitch', () => {
        const map = createMap({pitch: 0});
        expect(map.getMaxPitch()).toEqual(85);
        map.setMaxPitch(10);
        expect(map.getMaxPitch()).toEqual(10);
    });

    test('ignore maxPitchs over minPitch', () => {
        const map = createMap({minPitch:10});
        expect(() => {
            map.setMaxPitch(0);
        }).toThrowError();
        map.setPitch(10);
        expect(map.getPitch()).toEqual(10);
    });

    test('throw on maxPitch smaller than minPitch at init', () => {
        expect(() => {
            createMap({minPitch: 10, maxPitch: 5});
        }).toThrowError(`maxPitch must be greater than or equal to minPitch`);
    });

    test('throw on maxPitch smaller than minPitch at init with falsey maxPitch', () => {
        expect(() => {
            createMap({minPitch: 1, maxPitch: 0});
        }).toThrowError(`maxPitch must be greater than or equal to minPitch`);
    });

    test('throw on maxPitch greater than valid maxPitch at init', () => {
        expect(() => {
            createMap({maxPitch: 90});
        }).toThrowError(`maxPitch must be less than or equal to 85`);
    });

    test('throw on minPitch less than valid minPitch at init', () => {
        expect(() => {
            createMap({minPitch: -10});
        }).toThrowError(`minPitch must be greater than or equal to 0`);
    });

    test('#setMinZoom', async () => {
        const map = createMap({zoom:5});

        const onZoomStart = vi.fn();
        const onZoom = vi.fn();
        const onZoomEnd = vi.fn();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMinZoom(3.5);

        expect(onZoomStart).toHaveBeenCalledTimes(1);
        expect(onZoom).toHaveBeenCalledTimes(1);
        expect(onZoomEnd).toHaveBeenCalledTimes(1);

        map.setZoom(1);

        expect(onZoomStart).toHaveBeenCalledTimes(2);
        expect(onZoom).toHaveBeenCalledTimes(2);
        expect(onZoomEnd).toHaveBeenCalledTimes(2);

        expect(map.getZoom()).toEqual(3.5);
    });

    test('unset minZoom', () => {
        const map = createMap({minZoom:5});
        map.setMinZoom(null);
        map.setZoom(1);
        expect(map.getZoom()).toEqual(1);
    });

    test('#getMinZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMinZoom()).toEqual(-2);
        map.setMinZoom(10);
        expect(map.getMinZoom()).toEqual(10);
    });

    test('ignore minZooms over maxZoom', () => {
        const map = createMap({zoom:2, maxZoom:5});
        expect(() => {
            map.setMinZoom(6);
        }).toThrowError();
        map.setZoom(0);
        expect(map.getZoom()).toEqual(0);
    });

    test('#setMaxZoom', async () => {
        const map = createMap({zoom:0});

        const onZoomStart = vi.fn();
        const onZoom = vi.fn();
        const onZoomEnd = vi.fn();

        map.on('zoomstart', onZoomStart);
        map.on('zoom', onZoom);
        map.on('zoomend', onZoomEnd);

        map.setMaxZoom(3.5);

        expect(onZoomStart).toHaveBeenCalledTimes(1);
        expect(onZoom).toHaveBeenCalledTimes(1);
        expect(onZoomEnd).toHaveBeenCalledTimes(1);

        map.setZoom(4);

        expect(onZoomStart).toHaveBeenCalledTimes(2);
        expect(onZoom).toHaveBeenCalledTimes(2);
        expect(onZoomEnd).toHaveBeenCalledTimes(2);

        expect(map.getZoom()).toEqual(3.5);
    });

    test('unset maxZoom', () => {
        const map = createMap({maxZoom:5});
        map.setMaxZoom(null);
        map.setZoom(6);
        expect(map.getZoom()).toEqual(6);
    });

    test('#getMaxZoom', () => {
        const map = createMap({zoom: 0});
        expect(map.getMaxZoom()).toEqual(22);
        map.setMaxZoom(10);
        expect(map.getMaxZoom()).toEqual(10);
    });

    test('ignore maxZooms over minZoom', () => {
        const map = createMap({minZoom:5});
        expect(() => {
            map.setMaxZoom(4);
        }).toThrowError();
        map.setZoom(5);
        expect(map.getZoom()).toEqual(5);
    });

    test('throw on maxZoom smaller than minZoom at init', () => {
        expect(() => {
            createMap({minZoom:10, maxZoom:5});
        }).toThrowError(`maxZoom must be greater than or equal to minZoom`);
    });

    test('throw on maxZoom smaller than minZoom at init with falsey maxZoom', () => {
        expect(() => {
            createMap({minZoom:1, maxZoom:0});
        }).toThrowError(`maxZoom must be greater than or equal to minZoom`);
    });

    describe('#cameraForBounds', () => {
        test('crossing globe-mercator threshold globe -> mercator does not affect cameraForBounds result', () => {
            const map = createMap();
            map.setProjection('globe');
            const bb = [[-133, 16], [-132, 18]];

            let transform;

            map.setZoom(0);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("globe");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -132.5, lat: 17.0027});
            expect(fixedNum(transform.zoom, 3)).toEqual(6.071);

            map.setZoom(10);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("mercator");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -132.5, lat: 17.0027});
            expect(fixedNum(transform.zoom, 3)).toEqual(6.071);
        });

        test('crossing globe-mercator threshold mercator -> globe does not affect cameraForBounds result', () => {
            const map = createMap();
            map.setProjection('globe');
            const bb = [[-133, 16], [-68, 50]];

            let transform;

            map.setZoom(10);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("mercator");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(0.75);

            map.setZoom(0);
            map._updateProjectionTransition();

            expect(map.transform.projection.name).toEqual("globe");

            transform = map.cameraForBounds(bb);
            expect(fixedLngLat(transform.center, 4)).toEqual({lng: -100.5, lat: 34.716});
            expect(fixedNum(transform.zoom, 3)).toEqual(0.75);
        });
    });

    describe('#getBounds', () => {
        test('default bounds', () => {
            const map = createMap({zoom: 0});
            expect(parseFloat(map.getBounds().getCenter().lng.toFixed(10))).toEqual(-0);
            expect(parseFloat(map.getBounds().getCenter().lat.toFixed(10))).toEqual(0);

            expect(toFixed(map.getBounds().toArray())).toEqual(toFixed([
                [ -70.31249999999976, -57.326521225216965 ],
                [ 70.31249999999977, 57.32652122521695 ] ]));
        });

        test('rotated bounds', () => {
            const map = createMap({zoom: 1, bearing: 45});
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));

            map.setBearing(135);
            expect(
                toFixed([[-49.718445552178764, -44.44541580601936], [49.7184455522, 44.445415806019355]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('padded bounds', () => {
            const map = createMap({zoom: 1, bearing: 45});

            map.setPadding({
                left: 100,
                right: 10,
                top: 10,
                bottom: 10
            });

            expect(
                toFixed([[-33.5599507477, -31.7907658998], [33.5599507477, 31.7907658998]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('bounds cut off at poles (#10261)', () => {
            const map = createMap({zoom: 2, center: [0, 90], pitch: 80});
            const bounds = map.getBounds();
            expect(bounds.getNorth().toFixed(6)).toBe(MAX_MERCATOR_LATITUDE.toString());
            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -23.3484820899, 77.6464759596 ], [ 23.3484820899, 85.0511287798 ]])
            );

            map.setBearing(180);
            map.setCenter({lng: 0, lat: -90});

            const sBounds = map.getBounds();
            expect(sBounds.getSouth().toFixed(6)).toBe((-MAX_MERCATOR_LATITUDE).toString());
            expect(toFixed(sBounds.toArray())).toStrictEqual(
                toFixed([[ -23.3484820899, -85.0511287798 ], [ 23.3484820899, -77.6464759596]])
            );
        });

        test('on globe', () => {
            const map = createMap({zoom: 0, projection: 'globe'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -73.8873304141, -73.8873304141, ], [ 73.8873304141, 73.8873304141]])
            );

            map.jumpTo({zoom: 0, center: [0, 90]});
            bounds = map.getBounds();
            expect(bounds.getNorth()).toBe(90);
            expect(toFixed(bounds.toArray())).toStrictEqual(toFixed([[ -180, 11.1637985859 ], [ 180, 90 ]]));

            map.jumpTo({zoom: 0, center: [0, -90]});
            bounds = map.getBounds();
            expect(bounds.getSouth()).toBe(-90);
            expect(toFixed(bounds.toArray())).toStrictEqual(toFixed([[ -180, -90 ], [ 180, -11.1637985859]]));

            map.jumpTo({zoom: 2, center: [0, 45], bearing: 0, pitch: 20});
            bounds = map.getBounds();
            expect(bounds.getNorth()).not.toBe(90);

            map.jumpTo({zoom: 2, center: [0, -45], bearing: 180, pitch: -20});
            bounds = map.getBounds();
            expect(bounds.getSouth()).not.toBe(-90);
        });

        test('on Albers', () => {
            const map = createMap({projection: 'albers'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-65.1780745470", "-85.0511290000", ],
                [ "51.0506680427", "79.9819510537" ]
            ]);

            map.jumpTo({zoom: 0, center: [-96, 37.5]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-180.0000000000", "-45.1620125974" ],
                [ "21.1488460355", "85.0511290000" ]
            ]);

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-108.2217655978", "34.8501901832" ],
                [ "-88.9997447442", "49.1066330318" ]
            ]);

            map.jumpTo({zoom: 3.3, center: [-99, 42], bearing: 24});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-108.2217655978", "34.8501901832" ],
                [ "-88.9997447442", "49.1066330318" ]
            ]);

            map.setPitch(50);
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-106.5868397979", "34.9358140751" ],
                [ "-77.8438130022", "58.8683265070" ]
            ]);
        });

        test('on Winkel Tripel', () => {
            const map = createMap({projection: 'winkelTripel'});

            let bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-89.7369085165", "-57.5374138724" ],
                [ "89.7369085165", "57.5374138724" ]
            ]);

            map.jumpTo({zoom: 2, center: [-20, -70]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-58.0047683883", "-82.4864361385" ],
                [ "7.3269895739", "-57.3283436312" ]
            ]);

            map.jumpTo({zoom: 2, center: [-70, -20]});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-92.4701297641", "-34.6981068954" ],
                [ "-51.1668245330", "-5.6697541071" ]
            ]);

            map.jumpTo({pitch: 50, bearing: -20});
            bounds = map.getBounds();
            expect(toFixed(bounds.toArray())).toStrictEqual([
                [ "-111.9596616309", "-38.1908385183" ],
                [ "-52.4906377771", "22.9304574207" ]
            ]);
        });

        function toFixed(bounds) {
            const n = 10;
            return [
                [normalizeFixed(bounds[0][0], n), normalizeFixed(bounds[0][1], n)],
                [normalizeFixed(bounds[1][0], n), normalizeFixed(bounds[1][1], n)]
            ];
        }

        function normalizeFixed(num, n) {
            // workaround for "-0.0000000000" ≠ "0.0000000000"
            return parseFloat(num.toFixed(n)).toFixed(n);
        }
    });

    test('initial bounds in constructor options', () => {
        const container = window.document.createElement('div');
        Object.defineProperty(container, 'offsetWidth', {value: 512});
        Object.defineProperty(container, 'offsetHeight', {value: 512});

        const bounds = [[-133, 16], [-68, 50]];
        const map = createMap({container, bounds});

        expect(fixedLngLat(map.getCenter(), 4)).toEqual({lng: -100.5, lat: 34.7171});
        expect(fixedNum(map.getZoom(), 3)).toEqual(2.113);
    });

    test('initial bounds options in constructor options', () => {
        const bounds = [[-133, 16], [-68, 50]];

        const map = (fitBoundsOptions, skipCSSStub) => {
            const container = window.document.createElement('div');
            Object.defineProperty(container, 'offsetWidth', {value: 512});
            Object.defineProperty(container, 'offsetHeight', {value: 512});
            return createMap({skipCSSStub, container, bounds, fitBoundsOptions});
        };

        const unpadded = map(undefined, false);
        const padded = map({padding: 100}, true);

        expect(unpadded.getZoom() > padded.getZoom()).toBeTruthy();
    });

    describe('#setMaxBounds', () => {
        test('constrains map bounds', () => {
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-130.4297000000, 7.0136641176], [-61.5234400000, 60.2398142283]])
            ).toEqual(toFixed(map.getBounds().toArray()));
        });

        test('when no argument is passed, map bounds constraints are removed', () => {
            const map = createMap({zoom:0});
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(
                toFixed([[-166.28906999999964, -27.6835270554], [-25.664070000000066, 73.8248206697]])
            ).toEqual(toFixed(map.setMaxBounds(null).setZoom(0).getBounds().toArray()));
        });

        test('should not zoom out farther than bounds', () => {
            const map = createMap();
            map.setMaxBounds([[-130.4297, 50.0642], [-61.52344, 24.20688]]);
            expect(map.setZoom(0).getZoom()).not.toEqual(0);
        });

        test('throws on invalid bounds', () => {
            const map = createMap({zoom:0});
            expect(() => {
                map.setMaxBounds([-130.4297, 50.0642], [-61.52344, 24.20688]);
            }).toThrowError(Error);
            expect(() => {
                map.setMaxBounds(-130.4297, 50.0642, -61.52344, 24.20688);
            }).toThrowError(Error);
        });

        function toFixed(bounds) {
            const n = 9;
            return [
                [bounds[0][0].toFixed(n), bounds[0][1].toFixed(n)],
                [bounds[1][0].toFixed(n), bounds[1][1].toFixed(n)]
            ];
        }
    });

    describe('#getMaxBounds', () => {
        test('returns null when no bounds set', () => {
            const map = createMap({zoom:0});
            expect(map.getMaxBounds()).toEqual(null);
        });

        test('returns bounds', () => {
            const map = createMap({zoom:0});
            const bounds = [[-130.4297, 50.0642], [-61.52344, 24.20688]];
            map.setMaxBounds(bounds);
            expect(map.getMaxBounds().toArray()).toEqual(bounds);
        });
    });

    describe('#snapToNorth', () => {
        test('snaps when less than < 7 degrees', async () => {
            // t.setTimeout(10000);
            const map = createMap();
            await waitFor(map, "load");
            map.setBearing(6);
            expect(map.getBearing()).toEqual(6);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(0);
        });

        test('does not snap when > 7 degrees', async () => {
            // t.setTimeout(2000);
            const map = createMap();
            await waitFor(map, "load");
            map.setBearing(8);
            expect(map.getBearing()).toEqual(8);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(8);
        });

        test('snaps when < bearingSnap', async () => {
            // t.setTimeout(2000);
            const map = createMap({"bearingSnap": 12});
            await waitFor(map, "load");
            map.setBearing(11);
            expect(map.getBearing()).toEqual(11);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(0);
        });

        test('does not snap when > bearingSnap', async () => {
            // t.setTimeout(2000);
            const map = createMap({"bearingSnap": 10});
            await waitFor(map, "load");
            map.setBearing(11);
            expect(map.getBearing()).toEqual(11);
            map.snapToNorth();
            await waitFor(map, "idle");
            expect(map.getBearing()).toEqual(11);
        });
    });
});
