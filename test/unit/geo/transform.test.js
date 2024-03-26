import {describe, test, expect} from "../../util/vitest.js";
import Point from '@mapbox/point-geometry';
import Transform from '../../../src/geo/transform.js';
import LngLat, {LngLatBounds} from '../../../src/geo/lng_lat.js';
import {OverscaledTileID, CanonicalTileID} from '../../../src/source/tile_id.js';
import {fixedNum, fixedLngLat, fixedCoord, fixedPoint, fixedVec3, fixedVec4} from '../../util/fixed.js';
import {FreeCameraOptions} from '../../../src/ui/free_camera.js';
import MercatorCoordinate, {mercatorZfromAltitude, altitudeFromMercatorZ, MAX_MERCATOR_LATITUDE} from '../../../src/geo/mercator_coordinate.js';
import {vec3, quat} from 'gl-matrix';
import {degToRad, radToDeg} from '../../../src/util/util.js';

describe('transform', () => {
    test('creates a transform', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        expect(transform.unmodified).toEqual(true);
        expect(transform.tileSize).toEqual(512);
        expect(transform.worldSize).toEqual(512);
        expect(transform.width).toEqual(500);
        expect(transform.minZoom).toEqual(0);
        expect(transform.minPitch).toEqual(0);
        expect(transform.bearing).toEqual(0);
        expect(transform.bearing = 1).toEqual(1);
        expect(transform.bearing).toEqual(1);
        expect(transform.bearing = 0).toEqual(0);
        expect(transform.unmodified).toEqual(false);
        expect(transform.minZoom = 10).toEqual(10);
        expect(transform.maxZoom = 10).toEqual(10);
        expect(transform.minZoom).toEqual(10);
        expect(transform.center).toEqual({lng: 0, lat: 0});
        expect(transform.maxZoom).toEqual(10);
        expect(transform.minPitch = 10).toEqual(10);
        expect(transform.maxPitch = 10).toEqual(10);
        expect(transform.size.equals(new Point(500, 500))).toEqual(true);
        expect(transform.centerPoint.equals(new Point(250, 250))).toEqual(true);
        expect(transform.scaleZoom(0)).toEqual(-Infinity);
        expect(transform.scaleZoom(10)).toEqual(3.3219280948873626);
        expect(transform.point).toEqual(new Point(262144, 262144));
        expect(transform.height).toEqual(500);
        expect(fixedLngLat(transform.pointLocation(new Point(250, 250)))).toEqual({lng: 0, lat: -0});
        expect(fixedCoord(transform.pointCoordinate(new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(fixedPoint(transform.locationPoint(new LngLat(0, 0)))).toEqual({x: 250, y: 250});
        expect(transform.locationCoordinate(new LngLat(0, 0))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(fixedLngLat(transform.pointLocation3D(new Point(250, 250)))).toEqual({lng: 0, lat: -0});
        expect(fixedCoord(transform.pointCoordinate3D(new Point(250, 250)))).toEqual({x: 0.5, y: 0.5, z: 0});
        expect(fixedPoint(transform.locationPoint3D(new LngLat(0, 0)))).toEqual({x: 250, y: 250});
    });

    test('does not throw on bad center', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.center = {lng: 50, lat: -90};
    });

    test('setLocationAt', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint({lng: 13, lat: 10}, new Point(15, 45));
        expect(fixedLngLat(transform.pointLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('setLocationAt tilted', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        transform.pitch = 50;
        expect(transform.center).toEqual({lng: 0, lat: 0});
        transform.setLocationAtPoint({lng: 13, lat: 10}, new Point(15, 45));
        expect(fixedLngLat(transform.pointLocation(new Point(15, 45)))).toEqual({lng: 13, lat: 10});
    });

    test('has a default zoom', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        expect(transform.tileZoom).toEqual(0);
        expect(transform.tileZoom).toEqual(transform.zoom);
    });

    test('set fov', () => {
        const transform = new Transform();
        transform.fov = 10;
        expect(radToDeg(transform._fov)).toEqual(10);
        transform.fov = 10;
        expect(radToDeg(transform._fov)).toEqual(10);
    });

    test('maxBounds constrain zoom and center', () => {
        const transform = new Transform();
        transform.center = new LngLat(0, 0);
        transform.zoom = 10;
        transform.resize(500, 500);
        transform.setMaxBounds(LngLatBounds.convert([-5, -5, 5, 5]));
        transform.zoom = 0;
        expect(transform.zoom).toEqual(5.135709286104402);

        transform.center = new LngLat(-50, -30);
        expect(transform.center).toStrictEqual(new LngLat(0, -0.0063583052861417855));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        expect(transform.center).toStrictEqual(new LngLat(-4.828338623046875, -4.828969771321582));
    });

    describe('maxBounds should not jump to the wrong side when crossing 180th meridian (#10447)', () => {
        test(' to the East', () => {
            const transform = new Transform();
            transform.zoom = 6;
            transform.resize(500, 500);
            transform.setMaxBounds(LngLatBounds.convert([160, -55, 190, -23]));

            transform.center = new LngLat(-170, -40);

            expect(transform.center.lng < 190).toBeTruthy();
            expect(transform.center.lng > 175).toBeTruthy();
        });

        test('to the West', () => {
            const transform = new Transform();
            transform.zoom = 6;
            transform.resize(500, 500);
            transform.setMaxBounds(LngLatBounds.convert([-190, -55, -160, -23]));

            transform.center = new LngLat(170, -40);

            expect(transform.center.lng > -190).toBeTruthy();
            expect(transform.center.lng < -175).toBeTruthy();
        });

        test('longitude 0 - 360', () => {
            const transform = new Transform();
            transform.zoom = 6;
            transform.resize(500, 500);
            transform.setMaxBounds(LngLatBounds.convert([0, -90, 360, 90]));

            transform.center = new LngLat(-155, 0);

            expect(transform.center).toStrictEqual(new LngLat(205, 0));
        });

        test('longitude -360 - 0', () => {
            const transform = new Transform();
            transform.zoom = 6;
            transform.resize(500, 500);
            transform.setMaxBounds(LngLatBounds.convert([-360, -90, 0, 90]));

            transform.center = new LngLat(160, 0);
            expect(transform.center.lng.toFixed(10)).toBe('-200.0000000000');
        });
    }
    );

    test('maxBounds snaps in the correct direction (no forcing to other edge when width < 360)', () => {
        const transform = new Transform();
        transform.zoom = 6;
        transform.resize(500, 500);
        transform.setMaxBounds(new LngLatBounds([-160, -20], [160, 20]));

        transform.center = new LngLat(170, 0);
        expect(transform.center.lng > 150).toBeTruthy();
        expect(transform.center.lng < 160).toBeTruthy();

        transform.center = new LngLat(-170, 0);
        expect(transform.center.lng > -160).toBeTruthy();
        expect(transform.center.lng < -150).toBeTruthy();
    }
    );

    test('maxBounds works with unwrapped values across the 180th meridian (#6985)', () => {
        const transform = new Transform();
        transform.zoom = 6;
        transform.resize(500, 500);
        transform.setMaxBounds(new LngLatBounds([160, -20], [-160, 20]));  //East bound is "smaller"

        const wrap = val => ((val + 360) % 360);

        transform.center = new LngLat(170, 0);
        expect(wrap(transform.center.lng)).toBe(170);

        transform.center = new LngLat(-170, 0);
        expect(wrap(transform.center.lng)).toBe(wrap(-170));

        transform.center = new LngLat(150, 0);
        let lng = wrap(transform.center.lng);
        expect(lng > 160).toBeTruthy();
        expect(lng < 180).toBeTruthy();

        transform.center = new LngLat(-150, 0);
        lng = wrap(transform.center.lng);
        expect(lng < 360 - 160).toBeTruthy();
        expect(lng > 360 - 180).toBeTruthy();
    }
    );

    describe('_minZoomForBounds respects maxBounds', () => {
        test('it returns 0 when lngRange is undefined', () => {
            const transform = new Transform();
            transform.center = new LngLat(0, 0);
            transform.zoom = 10;
            transform.resize(500, 500);

            expect(transform._minZoomForBounds()).toEqual(0);
        });

        test('it results in equivalent minZoom as _constrain()', () => {
            const transform = new Transform();
            transform.center = new LngLat(0, 0);
            transform.zoom = 10;
            transform.resize(500, 500);
            transform.setMaxBounds(LngLatBounds.convert([-5, -5, 5, 5]));

            const preComputedMinZoom = transform._minZoomForBounds();
            transform.zoom = 0;
            const constrainedMinZoom = transform.zoom;

            expect(preComputedMinZoom).toEqual(constrainedMinZoom);
        });
    });

    test('mapbox-gl-js-internal#373', () => {
        const options = {
            minzoom: 3,
            maxzoom: 22,
            tileSize: 512
        };

        const transform = new Transform();
        transform.resize(512, 512);
        transform.center = {lng: -0.01, lat: 0.01};
        transform.zoom = 3;
        transform.pitch = 65;
        transform.bearing = 45;

        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(3, 0, 3, 3, 3),
            new OverscaledTileID(3, 0, 3, 3, 4),
            new OverscaledTileID(3, 0, 3, 4, 3),
            new OverscaledTileID(3, 0, 3, 4, 4),
            new OverscaledTileID(3, 0, 3, 4, 2),
            new OverscaledTileID(3, 0, 3, 5, 3),
            new OverscaledTileID(3, 0, 3, 5, 2),
            new OverscaledTileID(3, 0, 3, 4, 1),
            new OverscaledTileID(3, 0, 3, 6, 3),
            new OverscaledTileID(3, 0, 3, 5, 1),
            new OverscaledTileID(3, 0, 3, 6, 2)]);
    });

    describe('pointCoordinate retains direction when point is offscreen', () => {
        function assertDueNorth(m1, m2) {
            const dx = m2.x - m1.x;
            const dy = m2.y - m1.y;
            const l = Math.sqrt(dx * dx + dy * dy);
            const ndx = dx / l;
            const ndy = dy / l;
            expect(Math.abs(ndx) < 1e-10).toBeTruthy();
            expect(Math.abs(ndy + 1) < 1e-10).toBeTruthy();
        }

        test('no pitch', () => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 0;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth({x: 0.5, y: 0.5, z : 0}, coord);
        });

        test('high pitch', () => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 80;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth({x: 0.5, y: 0.5, z : 0}, coord);
        });

        test('medium pitch', () => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 70;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth({x: 0.5, y: 0.5, z : 0}, coord);
        });
    });

    describe('getBounds (#10261)', () => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 2;
        transform.pitch = 80;

        test('Looking at North Pole', () => {
            transform.center = {lng: 0, lat: 90};
            expect(transform.center).toEqual({lng: 0, lat: 79.3677012485858});
            const bounds = transform.getBounds();

            // Bounds stops at the edge of the map
            expect(bounds.getNorth().toFixed(6)).toBe(`${MAX_MERCATOR_LATITUDE}`);
            // Top corners of bounds line up with side of view
            expect(transform.locationPoint(bounds.getNorthWest()).x.toFixed(10)).toBe('-0.0000000000');
            expect(transform.locationPoint(bounds.getNorthEast()).x.toFixed(10)).toBe(transform.width.toFixed(10));
            // Bottom of bounds lines up with bottom of view
            expect(transform.locationPoint(bounds.getSouthEast()).y.toFixed(10)).toBe(transform.height.toFixed(10));
            expect(transform.locationPoint(bounds.getSouthWest()).y.toFixed(10)).toBe(transform.height.toFixed(10));

            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -56.6312307639145, 62.350646608460806 ], [ 56.63123076391412, 85.0511287798 ]])
            );
        });
        test('Looking at South Pole', () => {
            transform.bearing = 180;
            transform.center = {lng: 0, lat: -90};

            expect(transform.center).toEqual({lng: 0, lat: -79.3677012485858});
            const bounds = transform.getBounds();

            // Bounds stops at the edge of the map
            expect(bounds.getSouth().toFixed(6)).toBe((-MAX_MERCATOR_LATITUDE).toFixed(6));
            // Top corners of bounds line up with side of view
            expect(transform.locationPoint(bounds.getSouthEast()).x.toFixed(10)).toBe('-0.0000000000');
            expect(transform.locationPoint(bounds.getSouthWest()).x.toFixed(10)).toBe(transform.width.toFixed(10));
            // Bottom of bounds lines up with bottom of view
            expect(transform.locationPoint(bounds.getNorthEast()).y.toFixed(10)).toBe(transform.height.toFixed(10));
            expect(transform.locationPoint(bounds.getNorthWest()).y.toFixed(10)).toBe(transform.height.toFixed(10));

            expect(toFixed(bounds.toArray())).toStrictEqual(
                toFixed([[ -56.6312307639145, -85.0511287798], [ 56.63123076391412, -62.350646608460806]])
            );
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

    describe('coveringTiles', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform();
        transform.resize(200, 200);

        // make slightly off center so that sort order is not subject to precision issues
        transform.center = {lng: -0.01, lat: 0.01};

        transform.zoom = 0;
        expect(transform.coveringTiles(options)).toEqual([]);

        transform.zoom = 1;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);

        transform.zoom = 2.4;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(2, 0, 2, 1, 1),
            new OverscaledTileID(2, 0, 2, 2, 1),
            new OverscaledTileID(2, 0, 2, 1, 2),
            new OverscaledTileID(2, 0, 2, 2, 2)]);

        transform.zoom = 10;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 11;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 5.1;
        transform.pitch = 60.0;
        transform.bearing = 32.0;
        transform.center = new LngLat(56.90, 48.20);
        transform.resize(1024, 768);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(5, 0, 5, 21, 11),
            new OverscaledTileID(5, 0, 5, 20, 11),
            new OverscaledTileID(5, 0, 5, 21, 10),
            new OverscaledTileID(5, 0, 5, 20, 10),
            new OverscaledTileID(5, 0, 5, 21, 12),
            new OverscaledTileID(5, 0, 5, 22, 11),
            new OverscaledTileID(5, 0, 5, 20, 12),
            new OverscaledTileID(5, 0, 5, 22, 10),
            new OverscaledTileID(5, 0, 5, 21, 9),
            new OverscaledTileID(5, 0, 5, 20, 9),
            new OverscaledTileID(5, 0, 5, 22, 9),
            new OverscaledTileID(5, 0, 5, 23, 10),
            new OverscaledTileID(5, 0, 5, 21, 8),
            new OverscaledTileID(5, 0, 5, 20, 8),
            new OverscaledTileID(5, 0, 5, 23, 9),
            new OverscaledTileID(5, 0, 5, 22, 8),
            new OverscaledTileID(5, 0, 5, 23, 8),
            new OverscaledTileID(5, 0, 5, 21, 7),
            new OverscaledTileID(5, 0, 5, 20, 7),
            new OverscaledTileID(5, 0, 5, 24, 9),
            new OverscaledTileID(5, 0, 5, 22, 7)
        ]);

        transform.zoom = 8;
        transform.pitch = 60;
        transform.bearing = 45.0;
        transform.center = new LngLat(25.02, 60.15);
        transform.resize(300, 50);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(8, 0, 8, 145, 74),
            new OverscaledTileID(8, 0, 8, 145, 73),
            new OverscaledTileID(8, 0, 8, 146, 74)
        ]);

        transform.resize(50, 300);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(8, 0, 8, 145, 74),
            new OverscaledTileID(8, 0, 8, 145, 73),
            new OverscaledTileID(8, 0, 8, 146, 74),
            new OverscaledTileID(8, 0, 8, 146, 73)
        ]);

        transform.zoom = 2;
        transform.pitch = 0;
        transform.bearing = 0;
        transform.resize(300, 300);
        test('calculates tile coverage at w > 0', () => {
            transform.center = {lng: 630.02, lat: 0.01};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });

        test('calculates tile coverage at w = -1', () => {
            transform.center = {lng: -360.01, lat: 0.02};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });

        test('calculates tile coverage across meridian', () => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.02};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, -1, 1, 1, 1),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
        });

        test(
            'only includes tiles for a single world, if renderWorldCopies is set to false',
            () => {
                transform.zoom = 1;
                transform.center = {lng: -180.01, lat: 0.01};
                transform.renderWorldCopies = false;
                expect(transform.coveringTiles(options)).toEqual([
                    new OverscaledTileID(1, 0, 1, 0, 0),
                    new OverscaledTileID(1, 0, 1, 0, 1)
                ]);
            }
        );

        test('mapbox-gl-js-internal#86', () => {
            transform.renderWorldCopies = true;
            transform.maxPitch = 85;
            transform.zoom = 1.28;
            transform.bearing = -81.6;
            transform.pitch = 81;
            transform.center = {lng: -153.3, lat: 0.0};
            transform.resize(2759, 1242);
            expect(transform.coveringTiles({tileSize: 512})).toEqual([
                new OverscaledTileID(1, 0, 1, 0, 1),
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(0, -1, 0, 0, 0),
                new OverscaledTileID(1, 0, 1, 1, 1),
                new OverscaledTileID(1, 0, 1, 1, 0),
                new OverscaledTileID(1, 1, 1, 0, 1),
                new OverscaledTileID(1, 1, 1, 0, 0),
                new OverscaledTileID(0, -2, 0, 0, 0),
                new OverscaledTileID(0, -3, 0, 0, 0)
            ]);
        });

        test('Extend tile coverage for shadow casters', () => {
            transform.resize(512, 512);
            transform.center = new LngLat(-146.2148, 73.1277);
            transform.zoom = 5.08;
            transform.pitch = 76.5;
            transform.bearing = 0.0;

            const visibleTiles = transform.coveringTiles({tileSize: 512});

            expect(visibleTiles).toStrictEqual([
                new OverscaledTileID(5, 0, 5, 3, 6),
                new OverscaledTileID(5, 0, 5, 2, 6),
                new OverscaledTileID(5, 0, 5, 3, 7),
                new OverscaledTileID(5, 0, 5, 2, 7),
                new OverscaledTileID(4, 0, 4, 1, 2),
                new OverscaledTileID(4, 0, 4, 2, 2),
                new OverscaledTileID(4, 0, 4, 0, 2),
                new OverscaledTileID(3, 0, 3, 0, 0),
                new OverscaledTileID(3, 0, 3, 1, 0)
            ]);

            const shadowCasterTiles = transform.extendTileCoverForShadows(visibleTiles, [0.25, -0.433, -0.866], 5);

            expect(shadowCasterTiles).toStrictEqual([
                new OverscaledTileID(3, -1, 3, 7, 0),
                new OverscaledTileID(3, -1, 3, 7, 1),
                new OverscaledTileID(5, 0, 5, 1, 8),
                new OverscaledTileID(5, 0, 5, 2, 8),
                new OverscaledTileID(5, 0, 5, 3, 8)
            ]);
        });
    });

    test('coveringTiles with fog culling enabled', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform();
        transform.resize(200, 200);
        transform.center = {lng: -0.01, lat: 0.01};
        transform.zoom = 0;
        transform.fogCullDistSq = 1.5;
        transform.pitch = 85.0;
        expect(transform.coveringTiles(options)).toEqual([]);

        transform.zoom = 1;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);

        transform.zoom = 2.4;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(2, 0, 2, 1, 2),
            new OverscaledTileID(2, 0, 2, 2, 2)]);

        transform.zoom = 10;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 11;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 5.1;
        transform.bearing = 32.0;
        transform.center = new LngLat(56.90, 48.20);
        transform.resize(1024, 768);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(5, 0, 5, 21, 11),
            new OverscaledTileID(5, 0, 5, 20, 11),
            new OverscaledTileID(5, 0, 5, 20, 10),
            new OverscaledTileID(5, 0, 5, 21, 12),
            new OverscaledTileID(5, 0, 5, 20, 12)
        ]);

        transform.zoom = 8;
        transform.pitch = 60;
        transform.bearing = 45.0;
        transform.center = new LngLat(25.02, 60.15);
        transform.resize(300, 50);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(8, 0, 8, 145, 74)
        ]);

        transform.resize(50, 300);
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(8, 0, 8, 145, 74),
            new OverscaledTileID(8, 0, 8, 145, 73)
        ]);
    });

    const createCollisionElevation = (elevation) => {
        return {
            isDataAvailableAtPoint(_) {
                return true;
            },
            getAtPointOrZero(p) {
                if (p.x === 0.5 && p.y === 0.5)
                    return 0;
                return elevation * this.exaggeration();
            },
            getAtPoint(p) {
                return this.getAtPointOrZero(p);
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = elevation * this.exaggeration();
                }
                return true;
            },
            getMinElevationBelowMSL: () => 0,
            _exaggeration: 1,
            exaggeration() {
                return this._exaggeration;
            }
        };
    };

    const createCollisionElevationNoData = () => {
        return {
            isDataAvailableAtPoint(_) {
                return false;
            },
            getAtPointOrZero() {
                return 0.0;
            },
            getAtPoint(p, x) {
                return x;
            },
            getForTilePoints() {
                return true;
            },
            getMinElevationBelowMSL: () => 0,
            exaggeration: () => 1,
            visibleDemTiles: () => []
        };
    };

    const createConstantElevation = (elevation) => {
        return {
            isDataAvailableAtPoint(_) {
                return true;
            },
            getAtPointOrZero(_) {
                return elevation * this.exaggeration();
            },
            getAtPoint(_) {
                return this.getAtPointOrZero();
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = elevation * this.exaggeration();
                }
                return true;
            },
            getMinElevationBelowMSL: () => 0,
            _exaggeration: 1,
            exaggeration() {
                return this._exaggeration;
            },
            getMinMaxForVisibleTiles: () => null
        };
    };

    const createRampElevation = (scale) => {
        return {
            isDataAvailableAtPoint(_) {
                return true;
            },
            getAtPointOrZero(p) {
                return scale * (p.x + p.y - 1.0);
            },
            getAtPoint(p) {
                return this.getAtPointOrZero(p);
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = scale * (p.x + p.y - 1.0);
                }
                return true;
            },
            getMinElevationBelowMSL: () => 0,
            exaggeration: () => 1
        };
    };

    test('Pitch does not change when camera collides with terrain', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.maxPitch = 85;

        transform._elevation = createCollisionElevation(10);
        transform.bearing = -45;
        transform.pitch = 85;

        const altitudeZ = mercatorZfromAltitude(5, transform.center.lat) / Math.cos(degToRad(85));
        const zoom = transform._zoomFromMercatorZ(altitudeZ * 2);
        transform.zoom = zoom;

        const cameraAltitude = transform.getFreeCameraOptions().position.z / mercatorZfromAltitude(1, transform.center.lat);
        expect(cameraAltitude > 10).toBeTruthy();
        expect(fixedNum(transform.bearing)).toEqual(-45);
        expect(fixedNum(transform.pitch)).toEqual(85);
    });

    test('Camera height is above terrain with constant elevation', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.maxPitch = 85;

        transform.elevation = createConstantElevation(10);
        transform.bearing = -45;
        transform.pitch = 85;

        // Set camera altitude to 5 meters
        const altitudeZ = mercatorZfromAltitude(5, transform.center.lat) / Math.cos(degToRad(85));
        const zoom = transform._zoomFromMercatorZ(altitudeZ);
        transform.zoom = zoom;

        const cameraAltitude = altitudeFromMercatorZ(transform.getFreeCameraOptions().position.z, transform.getFreeCameraOptions().position.y);

        expect(cameraAltitude > 10).toBeTruthy();
        expect(fixedNum(transform.zoom)).toEqual(fixedNum(zoom));
        expect(fixedNum(transform.bearing)).toEqual(-45);
        expect(fixedNum(transform.pitch)).toEqual(85);
    });

    test('Constrained camera height over terrain with exaggeration change', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.maxPitch = 85;

        const elevation = createConstantElevation(10);
        elevation._exaggeration = 0;
        transform.elevation = elevation;
        transform.constantCameraHeight = false;
        transform.bearing = -45;
        transform.pitch = 85;

        // Set camera altitude to 5 meters
        const altitudeZ = mercatorZfromAltitude(5, transform.center.lat) / Math.cos(degToRad(85));
        const zoom = transform._zoomFromMercatorZ(altitudeZ);
        transform.zoom = zoom;

        const cameraAltitude = () => {
            return transform.getFreeCameraOptions().position.z / mercatorZfromAltitude(1, transform.center.lat);
        };

        expect(fixedNum(cameraAltitude())).toEqual(5);
        expect(transform._centerAltitude).toEqual(0);

        // increase exaggeration to lift the center (and camera that follows it) up.
        transform.elevation._exaggeration = 1;
        transform.updateElevation(false);
        expect(transform._centerAltitude).toEqual(10);

        const cameraAltitudeAfterLift = cameraAltitude();
        expect(fixedNum(cameraAltitudeAfterLift)).toEqual(15);

        transform.elevation._exaggeration = 15;
        transform.updateElevation(false);
        expect(transform._centerAltitude).toEqual(150);
        expect(fixedNum(cameraAltitude())).toEqual(155);

        transform.elevation._exaggeration = 0;
        transform.updateElevation(false);
        expect(fixedNum(cameraAltitude())).toEqual(5);

        // zoom out to 10 meters and back to 5
        transform.zoom = transform._zoomFromMercatorZ(altitudeZ * 2);
        expect(fixedNum(cameraAltitude())).toEqual(10);
        transform.zoom = zoom;
        expect(fixedNum(cameraAltitude())).toEqual(5);
        expect(fixedNum(transform.pitch)).toEqual(85);

        transform.elevation = null;
        expect(cameraAltitude() < 10).toBeTruthy();

        // collision elevation keeps center at 0 but pushes camera up.
        const elevation1 = createCollisionElevation(10);
        elevation1._exaggeration = 0;

        transform.elevation = elevation1;
        transform.updateElevation(false);
        expect(transform._centerAltitude).toEqual(0);
        expect(cameraAltitude() < 10).toBeTruthy();

        elevation1._exaggeration = 1;
        transform.updateElevation(false);
        expect(transform._centerAltitude).toEqual(0);
        expect(cameraAltitude() > 10).toBeTruthy();
        expect(fixedNum(transform.pitch)).toEqual(85);
    });

    test('Constrained camera height over terrain without data', () => {
        const transform = new Transform();
        transform.resize(200, 200);

        transform.elevation = createCollisionElevationNoData();

        expect(transform._centerAltitudeValidForExaggeration).toEqual(undefined);

        const transformBefore = transform.clone();

        // Set camera altitude to 5 meters
        const altitudeZ = mercatorZfromAltitude(5, transform.center.lat) / Math.cos(degToRad(85));
        const zoom = transform._zoomFromMercatorZ(altitudeZ);

        // Apply zoom
        transform.zoom = zoom;

        expect(transform._centerAltitudeValidForExaggeration).toEqual(undefined);
        expect(transform._seaLevelZoom).toEqual(transformBefore._seaLevelZoom);
    });

    test('Compute zoom from camera height', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.center = {lng: 0, lat: 0};
        transform.zoom = 16;
        transform.elevation = createRampElevation(500);
        expect(transform.elevation.getAtPointOrZero(new MercatorCoordinate(1.0, 0.5))).toEqual(250);

        expect(transform.zoom).toEqual(16);
        expect(transform._seaLevelZoom).toEqual(16);

        // zoom should remain unchanged
        transform.cameraElevationReference = "ground";
        transform.center = new LngLat(180, 0);
        expect(transform.zoom).toEqual(16);

        transform.center = new LngLat(0, 0);
        expect(transform.zoom).toEqual(16);

        // zoom should change so that the altitude remains constant
        transform.cameraElevationReference = "sea";
        transform.center = new LngLat(180, 0);
        expect(transform._seaLevelZoom).toEqual(16);

        const altitudeZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform._seaLevelZoom) * transform.tileSize);
        const heightZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform.zoom) * transform.tileSize);
        const elevationZ = mercatorZfromAltitude(250, 0);
        expect(fixedNum(elevationZ + heightZ)).toEqual(fixedNum(altitudeZ));
    });

    test('Constant camera height over terrain', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.center = {lng: 0, lat: 0};
        transform.zoom = 16;

        transform.elevation = createConstantElevation(0);
        expect(transform.zoom).toEqual(transform._seaLevelZoom);

        // Camera zoom should change so that the standard zoom value describes distance between the camera and the terrain
        transform.elevation = createConstantElevation(10000);
        expect(fixedNum(transform._seaLevelZoom)).toEqual(11.1449615644);

        // Camera height over terrain should remain constant
        const altitudeZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform._seaLevelZoom) * transform.tileSize);
        const heightZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform.zoom) * transform.tileSize);
        const elevationZ = mercatorZfromAltitude(10000, 0);
        expect(elevationZ + heightZ).toEqual(altitudeZ);

        transform.pitch = 32;
        expect(fixedNum(transform._seaLevelZoom)).toEqual(11.1449615644);
        expect(transform.zoom).toEqual(16);
    });

    describe('coveringTiles for terrain', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform();
        let centerElevation = 0;
        let tilesDefaultElevation = 0;
        const tileElevation = {};
        const elevation = {
            isDataAvailableAtPoint(_) {
                return true;
            },
            getAtPointOrZero(_) {
                return this.exaggeration() * centerElevation;
            },
            getAtPoint(_) {
                return this.getAtPointOrZero();
            },
            getMinMaxForTile(tileID) {
                const ele = tileElevation[tileID.key] !== undefined ? tileElevation[tileID.key] : tilesDefaultElevation;
                if (ele === null) return null;
                return {min: this.exaggeration() * ele, max: this.exaggeration() * ele};
            },
            exaggeration() {
                return 10; // Low tile zoom used, exaggerate elevation to make impact.
            },
            getMinElevationBelowMSL: () => 0,
            getMinMaxForVisibleTiles: () => null
        };
        transform.elevation = elevation;
        transform.resize(200, 200);

        // make slightly off center so that sort order is not subject to precision issues
        transform.center = {lng: -0.01, lat: 0.01};

        transform.zoom = 0;
        expect(transform.coveringTiles(options)).toEqual([]);

        transform.zoom = 1;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);

        transform.zoom = 2.4;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(2, 0, 2, 1, 1),
            new OverscaledTileID(2, 0, 2, 2, 1),
            new OverscaledTileID(2, 0, 2, 1, 2),
            new OverscaledTileID(2, 0, 2, 2, 2)]);

        transform.zoom = 10;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 11;
        expect(transform.coveringTiles(options)).toEqual([
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 9.1;
        transform.pitch = 60.0;
        transform.bearing = 32.0;
        transform.center = new LngLat(56.90, 48.20);
        transform.resize(1024, 768);
        transform.elevation = null;
        const cover2D = transform.coveringTiles(options);
        // No LOD as there is no elevation data.
        expect(cover2D[0].overscaledZ === cover2D[cover2D.length - 1].overscaledZ).toBeTruthy();

        transform.pitch = 65.0;
        transform.elevation = elevation;
        const cover = transform.coveringTiles(options);
        // First part of the cover should be the same as for 60 degrees no elevation case.
        expect(cover.slice(0, 6)).toEqual(cover2D.slice(0, 6));

        // Even though it is larger pitch, less tiles are expected as LOD kicks in.
        expect(cover.length < cover2D.length).toBeTruthy();
        expect(cover[0].overscaledZ > cover[cover.length - 1].overscaledZ).toBeTruthy();

        // Elevated LOD with elevated center returns the same
        tilesDefaultElevation = centerElevation = 10000;

        transform.elevation = null;
        transform.elevation = elevation;

        const cover10k = transform.coveringTiles(options);
        expect(cover).toEqual(cover10k);

        // Lower tiles on side get clipped.
        const lowTiles = [
            new OverscaledTileID(9, 0, 9, 335, 178).key,
            new OverscaledTileID(9, 0, 9, 337, 178).key
        ];
        expect(cover.filter(t => lowTiles.includes(t.key)).length === lowTiles.length).toBeTruthy();

        for (const t of lowTiles) {
            tileElevation[t] = 0;
        }
        const coverLowSide = transform.coveringTiles(options);
        expect(coverLowSide.filter(t => lowTiles.includes(t.key)).length === 0).toBeTruthy();

        tileElevation[lowTiles[0]] = null; // missing elevation information gets to cover.
        expect(transform.coveringTiles(options).find(t => t.key === lowTiles[0])).toBeTruthy();

        transform.zoom = 2;
        transform.pitch = 0;
        transform.bearing = 0;
        transform.resize(300, 300);
        test('calculates tile coverage at w > 0', () => {
            transform.center = {lng: 630.02, lat: 0.01};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
        });

        test('calculates tile coverage at w = -1', () => {
            transform.center = {lng: -360.01, lat: 0.02};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
        });

        test('calculates tile coverage across meridian', () => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.02};
            expect(transform.coveringTiles(options)).toEqual([
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, -1, 1, 1, 1),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
        });
        test(
            'only includes tiles for a single world, if renderWorldCopies is set to false',
            () => {
                transform.zoom = 1;
                transform.center = {lng: -180.01, lat: 0.01};
                transform.renderWorldCopies = false;
                expect(transform.coveringTiles(options)).toEqual([
                    new OverscaledTileID(1, 0, 1, 0, 0),
                    new OverscaledTileID(1, 0, 1, 0, 1)
                ]);
            }
        );
        test('proper distance to center with wrap. Zoom drop at the end.', () => {
            transform.resize(2000, 2000);
            transform.zoom = 3.29;
            transform.pitch = 57;
            transform.bearing = 91.8;
            transform.center = {lng: -134.66, lat: 20.52};
            const cover = transform.coveringTiles(options);
            expect(cover[0].overscaledZ === 3).toBeTruthy();
            expect(cover[cover.length - 1].overscaledZ <= 2).toBeTruthy();
        });

        test(
            'zoom 22 somewhere in Mile High City should load only visible tiles',
            () => {
                tilesDefaultElevation = null;
                centerElevation = 1600;
                tileElevation[new OverscaledTileID(14, 0, 14, 3413, 6218).key] = 1600;
                transform.pitch = 0;
                transform.bearing = 0;
                transform.resize(768, 768);
                transform.zoom = options.maxzoom = 22;
                transform.center = {lng: -104.99813327, lat: 39.72784465999999};
                options.roundZoom = true;
                expect(transform.coveringTiles(options)).toEqual([
                    new OverscaledTileID(22, 0, 22, 873835, 1592007),
                    new OverscaledTileID(22, 0, 22, 873834, 1592007),
                    new OverscaledTileID(22, 0, 22, 873835, 1592006),
                    new OverscaledTileID(22, 0, 22, 873834, 1592006)
                ]);
            }
        );
    });

    test('loads only visible on terrain', () => {
        // See https://github.com/mapbox/mapbox-gl-js/pull/10462
        const demTiles = {};
        demTiles[new CanonicalTileID(14, 8546, 5850).key] = 2760;
        demTiles[new CanonicalTileID(14, 8546, 5849).key] = 2760;
        demTiles[new CanonicalTileID(14, 8546, 5851).key] = 2760;
        demTiles[new CanonicalTileID(13, 4272, 2925).key] = 2760;
        demTiles[new CanonicalTileID(13, 4272, 2924).key] = 0;
        demTiles[new CanonicalTileID(14, 8546, 5848).key] = 0;
        demTiles[new CanonicalTileID(12, 2136, 1463).key] = 0;
        demTiles[new CanonicalTileID(11, 1067, 731).key] = 0;
        demTiles[new CanonicalTileID(11, 1066, 731).key] = 0;
        demTiles[new CanonicalTileID(11, 1068, 730).key] = 0;
        demTiles[new CanonicalTileID(11, 1067, 730).key] = 0;
        demTiles[new CanonicalTileID(11, 1066, 730).key] = 0;
        demTiles[new CanonicalTileID(9, 266, 183).key] = 0;

        const options = {
            minzoom: 1,
            maxzoom: 22,
            tileSize: 512
        };

        const transform = new Transform();
        transform.elevation = {
            isDataAvailableAtPoint(_) {
                return true;
            },
            getAtPointOrZero(_) {
                return 2760;
            },
            getAtPoint(_) {
                return this.getAtPointOrZero();
            },
            getMinMaxForTile(tileID) {
                for (let z = tileID.canonical.z - 1; z >= 9; z--) {
                    const id = tileID.calculateScaledKey(z);
                    if (demTiles.hasOwnProperty(id)) {
                        return {min: 0, max: demTiles[id]};
                    }
                }
                return null;
            },
            exaggeration() {
                return 1;
            },
            getMinElevationBelowMSL: () => 0,
            getMinMaxForVisibleTiles: () => null
        };
        transform.bearing = -95.8;
        transform.resize(1335, 934);
        transform.renderWorldCopies = true;
        transform.zoom = 16.07;
        transform.center = new LngLat(7.785269, 45.671);
        transform.zoom = 16.07;
        transform.pitch = 62;

        const cover = transform.coveringTiles(options);

        expect(cover.length === 43).toBeTruthy();
        expect(cover.find(tileID => tileID.canonical.z === 13 && tileID.canonical.x === 4270 && tileID.canonical.y === 2927)).toBeTruthy();
        expect(cover.find(tileID => tileID.canonical.z === 12 && tileID.canonical.x === 2134 && tileID.canonical.y === 1461)).toBeTruthy();
    });

    test('coveringZoomLevel', () => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform();

        transform.zoom = 0;
        expect(transform.coveringZoomLevel(options)).toEqual(0);

        transform.zoom = 0.1;
        expect(transform.coveringZoomLevel(options)).toEqual(0);

        transform.zoom = 1;
        expect(transform.coveringZoomLevel(options)).toEqual(1);

        transform.zoom = 2.4;
        expect(transform.coveringZoomLevel(options)).toEqual(2);

        transform.zoom = 10;
        expect(transform.coveringZoomLevel(options)).toEqual(10);

        transform.zoom = 11;
        expect(transform.coveringZoomLevel(options)).toEqual(11);

        transform.zoom = 11.5;
        expect(transform.coveringZoomLevel(options)).toEqual(11);

        options.tileSize = 256;

        transform.zoom = 0;
        expect(transform.coveringZoomLevel(options)).toEqual(1);

        transform.zoom = 0.1;
        expect(transform.coveringZoomLevel(options)).toEqual(1);

        transform.zoom = 1;
        expect(transform.coveringZoomLevel(options)).toEqual(2);

        transform.zoom = 2.4;
        expect(transform.coveringZoomLevel(options)).toEqual(3);

        transform.zoom = 10;
        expect(transform.coveringZoomLevel(options)).toEqual(11);

        transform.zoom = 11;
        expect(transform.coveringZoomLevel(options)).toEqual(12);

        transform.zoom = 11.5;
        expect(transform.coveringZoomLevel(options)).toEqual(12);

        options.roundZoom = true;

        expect(transform.coveringZoomLevel(options)).toEqual(13);
    });

    test('clamps latitude', () => {
        const transform = new Transform();

        expect(transform.project(new LngLat(0, -90))).toEqual(transform.project(new LngLat(0, -MAX_MERCATOR_LATITUDE)));
        expect(transform.project(new LngLat(0, 90))).toEqual(transform.project(new LngLat(0, MAX_MERCATOR_LATITUDE)));
    });

    test('horizonLineFromTop', () => {
        const transform = new Transform();
        transform.maxPitch = 90;
        transform.resize(800, 800);
        transform.zoom = 10;
        transform.center = {lng: 0, lat: 0};
        transform.pitch = 90;
        transform.padding = {top:0, bottom:0, left:0, right:0};
        transform._horizonShift = 0.0;
        const eq = (a, b, eps = 0.000001) => {
            return Math.abs(a - b) < eps;
        };

        // Horizon line is in the center
        expect(eq(transform.horizonLineFromTop(), 400.0)).toBeTruthy();

        // Padding from top, horizon line should go down
        transform.padding = {top:300, bottom:0, left:0, right:0};
        expect(eq(transform.horizonLineFromTop(), 550.0)).toBeTruthy();

        // Padding from bottom, horizon line should go up
        transform.padding = {top:0, bottom:300, left:0, right:0};
        expect(eq(transform.horizonLineFromTop(), 250.0)).toBeTruthy();
    });

    test('clamps pitch', () => {
        const transform = new Transform();

        transform.pitch = 45;
        expect(transform.pitch).toEqual(45);

        transform.pitch = -10;
        expect(transform.pitch).toEqual(0);

        transform.pitch = 90;
        expect(transform.pitch).toEqual(60);
    });

    test('visibleUnwrappedCoordinates', () => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.zoom = 0;
        transform.center = {lng: -170.01, lat: 0.01};

        let unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords.length).toEqual(4);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        transform._renderWorldCopies = false;
        unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        expect(unwrappedCoords.length).toEqual(1);
    });

    describe('isHorizonVisible', () => {
        test('anyCornerOffEdge', () => {
            const transform = new Transform();
            transform.maxPitch = 85;
            transform.resize(800, 800);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 85;
            let p0, p1;

            expect(transform.isHorizonVisible()).toBeTruthy();

            p0 = new Point(0, 0);
            p1 = new Point(10, 10);
            expect(transform.anyCornerOffEdge(p0, p1)).toBeTruthy();

            p0 = new Point(0, 250);
            p1 = new Point(10, 350);
            expect(transform.anyCornerOffEdge(p0, p1)).toBeTruthy();

            p0 = new Point(0, transform.horizonLineFromTop() - 10);
            p1 = new Point(10, transform.horizonLineFromTop() + 10);
            expect(transform.anyCornerOffEdge(p0, p1)).toBeTruthy();

            p0 = new Point(0, 700);
            p1 = new Point(10, 710);
            expect(transform.anyCornerOffEdge(p0, p1)).toBeFalsy();

            p0 = new Point(0, transform.horizonLineFromTop());
            p1 = new Point(10, transform.horizonLineFromTop() + 10);
            expect(transform.anyCornerOffEdge(p0, p1)).toBeFalsy();
        });

        test('high pitch', () => {
            const transform = new Transform();
            transform.maxPitch = 85;
            transform.resize(300, 300);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 0;

            expect(transform.isHorizonVisible()).toBeFalsy();
            transform.pitch = 85;
            expect(transform.isHorizonVisible()).toBeTruthy();
        });

        test('with large top padding', () => {
            const transform = new Transform();
            transform.resize(200, 200);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 60;

            expect(transform.isHorizonVisible()).toBeFalsy();
            transform.padding = {top: 180};
            expect(transform.isHorizonVisible()).toBeTruthy();
        });

        test('lower zoom level, rotated map making background visible', () => {
            const transform = new Transform();
            transform.resize(1300, 1300);
            transform.zoom = 3;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 0;

            expect(transform.isHorizonVisible()).toBeFalsy();
            transform.zoom = 0;
            transform.bearing = 45;
            expect(transform.isHorizonVisible()).toBeTruthy();
        });

        test('accounts for renderWorldCopies', () => {
            const transform = new Transform();
            transform.resize(1300, 1300);
            transform.zoom = 2;
            transform.center = {lng: -135, lat: 0};
            transform.pitch = 0;
            transform.bearing = -45;
            transform.renderWorldCopies = true;

            expect(transform.isHorizonVisible()).toBeFalsy();
            transform.renderWorldCopies = false;
            expect(transform.isHorizonVisible()).toBeTruthy();
        });
    });

    describe('freeCamera', () => {
        const rotatedFrame = (quaternion) => {
            return {
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                right: vec3.transformQuat([], [1, 0, 0], quaternion)
            };
        };

        test('invalid height', () => {
            const transform = new Transform();
            const options = new FreeCameraOptions();

            options.orientation = [1, 1, 1, 1];
            options.position = new MercatorCoordinate(0.1, 0.2, 0.3);
            transform.setFreeCameraOptions(options);

            const updatedOrientation = transform.getFreeCameraOptions().orientation;
            const updatedPosition = transform.getFreeCameraOptions().position;

            // Expect default state as height is invalid
            expect(updatedOrientation).toEqual([0, 0, 0, 1]);
            expect(updatedPosition).toEqual(new MercatorCoordinate(0, 0, 0));
        });

        test('invalid z', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Invalid z-value (<= 0.0 || > 1) should be clamped to respect both min & max zoom values
            options.position = new MercatorCoordinate(0.1, 0.1, 0.0);
            transform.setFreeCameraOptions(options);
            expect(transform.zoom).toEqual(transform.maxZoom);
            expect(transform.getFreeCameraOptions().position.z > 0.0).toBeTruthy();

            options.position = new MercatorCoordinate(0.5, 0.2, 123.456);
            transform.setFreeCameraOptions(options);
            expect(transform.zoom).toEqual(transform.minZoom);
            expect(transform.getFreeCameraOptions().position.z <= 1.0).toBeTruthy();
        });

        test('orientation', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Default orientation
            options.orientation = [0, 0, 0, 1];
            transform.setFreeCameraOptions(options);
            expect(transform.bearing).toEqual(0);
            expect(transform.pitch).toEqual(0);
            expect(transform.center).toEqual(new LngLat(0, 0));

            // 60 pitch
            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, -60.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            expect(transform.bearing).toEqual(0.0);
            expect(transform.pitch).toEqual(60.0);
            expect(fixedPoint(transform.point, 5)).toEqual(new Point(256, 50));

            // 56 bearing
            options.orientation = [0, 0, 0, 1];
            quat.rotateZ(options.orientation, options.orientation, 56.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            expect(fixedNum(transform.bearing)).toEqual(56.0);
            expect(fixedNum(transform.pitch)).toEqual(0.0);
            expect(fixedPoint(transform.point, 5)).toEqual(new Point(512, 359.80761));

            // 30 pitch and -179 bearing
            options.orientation = [0, 0, 0, 1];
            quat.rotateZ(options.orientation, options.orientation, -179.0 * Math.PI / 180.0);
            quat.rotateX(options.orientation, options.orientation, -30.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            expect(fixedNum(transform.bearing)).toEqual(-179.0);
            expect(fixedNum(transform.pitch)).toEqual(30.0);
            expect(fixedPoint(transform.point, 5)).toEqual(new Point(442.09608, 386.59111));
        });

        test('invalid orientation', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Zero length quaternion
            options.orientation = [0, 0, 0, 0];
            transform.setFreeCameraOptions(options);
            expect(transform.getFreeCameraOptions().orientation).toEqual([0, 0, 0, 1]);

            // up vector is on the xy-plane. Right vector can't be computed
            options.orientation = [0, 0, 0, 1];
            quat.rotateY(options.orientation, options.orientation, Math.PI * 0.5);
            transform.setFreeCameraOptions(options);
            expect(transform.getFreeCameraOptions().orientation).toEqual([0, 0, 0, 1]);

            // Camera is upside down
            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, Math.PI * 0.75);
            transform.setFreeCameraOptions(options);
            expect(transform.getFreeCameraOptions().orientation).toEqual([0, 0, 0, 1]);
        });

        test('wraps coordinates when renderWorldCopies is true', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();
            options._renderWorldCopies = true;

            const lngLatLike = [-482.44, 37.83];
            options.position = MercatorCoordinate.fromLngLat(lngLatLike);
            transform.setFreeCameraOptions(options);

            expect(parseFloat(options.position.toLngLat().lng.toFixed(2))).toEqual(-122.44);
        });

        test('does not wrap coordinates when renderWorldCopies is falsey', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            const lngLatLike = [-482.44, 37.83];
            options.position = MercatorCoordinate.fromLngLat(lngLatLike);
            transform.setFreeCameraOptions(options);

            expect(parseFloat(options.position.toLngLat().lng.toFixed(2))).toEqual(lngLatLike[0]);
        });

        test('clamp pitch', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();
            let frame = null;

            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, -85.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            expect(transform.pitch).toEqual(transform.maxPitch);
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);

            expect(fixedVec3(frame.right, 5)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up, 5)).toEqual([0, -0.5, 0.86603]);
            expect(fixedVec3(frame.forward, 5)).toEqual([0, -0.86603, -0.5]);
        });

        test('clamp to bounds', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            transform.setMaxBounds(new LngLatBounds(new LngLat(-180, -MAX_MERCATOR_LATITUDE), new LngLat(180, MAX_MERCATOR_LATITUDE)));
            transform.zoom = 8.56;
            const options = new FreeCameraOptions();

            // Place the camera to an arbitrary position looking away from the map
            options.position = new MercatorCoordinate(-100.0, -10000.0, 1000.0);
            options.orientation = quat.rotateX([], [0, 0, 0, 1], -45.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);

            expect(fixedPoint(transform.point, 5)).toEqual(new Point(50, 50));
            expect(fixedNum(transform.bearing)).toEqual(0.0);
            expect(fixedNum(transform.pitch)).toEqual(45.0);
        });

        test('invalid state', () => {
            const transform = new Transform();

            expect(transform.pitch).toEqual(0);
            expect(transform.bearing).toEqual(0);
            expect(transform.point).toEqual(new Point(256, 256));

            expect(transform.getFreeCameraOptions().position).toEqual(new MercatorCoordinate(0, 0, 0));
            expect(transform.getFreeCameraOptions().orientation).toEqual([0, 0, 0, 1]);
        });

        test('orientation roll', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            let options = new FreeCameraOptions();

            const orientationWithoutRoll = quat.rotateX([], [0, 0, 0, 1], -Math.PI / 4);
            const orientationWithRoll = quat.rotateZ([], orientationWithoutRoll, Math.PI / 4);

            options.orientation = orientationWithRoll;
            transform.setFreeCameraOptions(options);
            options = transform.getFreeCameraOptions();

            expect(fixedVec4(options.orientation, 5)).toEqual(fixedVec4(orientationWithoutRoll, 5));
            expect(fixedNum(transform.pitch)).toEqual(45.0);
            expect(fixedNum(transform.bearing)).toEqual(0.0);
            expect(fixedPoint(transform.point)).toEqual(new Point(256, 106));
        });

        test('state synchronization', () => {
            const transform = new Transform();
            transform.resize(100, 100);
            let frame = null;

            transform.pitch = 0.0;
            transform.bearing = 0.0;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            expect(transform.getFreeCameraOptions().position).toEqual(new MercatorCoordinate(0.5, 0.5, 0.29296875));
            expect(frame.right).toEqual([1, 0, 0]);
            expect(frame.up).toEqual([0, -1, 0]);
            expect(frame.forward).toEqual([0, 0, -1]);

            transform.center = new LngLat(24.9384, 60.1699);
            expect(fixedCoord(transform.getFreeCameraOptions().position, 5)).toEqual(new MercatorCoordinate(0.56927, 0.28945, 0.29297));

            transform.center = new LngLat(20, -20);
            transform.pitch = 20;
            transform.bearing = 77;
            expect(fixedCoord(transform.getFreeCameraOptions().position, 5)).toEqual(new MercatorCoordinate(0.45792, 0.57926, 0.27530));

            transform.pitch = 0;
            transform.bearing = 90;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            expect(fixedVec3(frame.right)).toEqual([0, 1, 0]);
            expect(fixedVec3(frame.up)).toEqual([1, -0, 0]);
            expect(fixedVec3(frame.forward)).toEqual([0, 0, -1]);

            // Invalid pitch
            transform.bearing = 0;
            transform.pitch = -10;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            expect(fixedCoord(transform.getFreeCameraOptions().position, 5)).toEqual(new MercatorCoordinate(0.55556, 0.55672, 0.29297));
            expect(frame.right).toEqual([1, 0, 0]);
            expect(frame.up).toEqual([0, -1, 0]);
            expect(frame.forward).toEqual([0, 0, -1]);

            transform.bearing = 0;
            transform.pitch = 85;
            transform.center = new LngLat(0, -80);
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            expect(fixedCoord(transform.getFreeCameraOptions().position, 5)).toEqual(new MercatorCoordinate(0.5, 1.14146, 0.14648));
            expect(fixedVec3(frame.right, 5)).toEqual([1, 0, 0]);
            expect(fixedVec3(frame.up, 5)).toEqual([0, -0.5, 0.86603]);
            expect(fixedVec3(frame.forward, 5)).toEqual([0, -0.86603, -0.5]);
        });

        test('Position should ignore the camera elevation reference mode', () => {
            let groundElevation = 200;
            const transform = new Transform(0, 22, 0, 85);
            transform.resize(100, 100);
            transform._elevation = {
                isDataAvailableAtPoint: () => true,
                getAtPointOrZero: () => groundElevation,
                getAtPoint: () => groundElevation,
                exaggeration: () => 1.0,
                raycast: () => undefined,
                getMinElevationBelowMSL: () => 0
            };

            const expected = new FreeCameraOptions();
            expected.position = new MercatorCoordinate(0.1596528750412326, 0.3865452936454495, 0.00007817578881907832);
            expected.orientation = [-0.35818916989938915, -0.3581891698993891, 0.6096724682702889, 0.609672468270289];

            transform.cameraElevationReference = "sea";
            transform.setFreeCameraOptions(expected);
            let actual = transform.getFreeCameraOptions();
            expect(fixedCoord(actual.position)).toEqual(fixedCoord(expected.position));
            expect(fixedVec4(actual.orientation)).toEqual(fixedVec4(expected.orientation));

            transform.cameraElevationReference = "ground";
            groundElevation = 300;
            expected.position = new MercatorCoordinate(0.16, 0.39, 0.000078);
            transform.setFreeCameraOptions(expected);
            actual = transform.getFreeCameraOptions();
            expect(fixedCoord(actual.position)).toEqual(fixedCoord(expected.position));
            expect(fixedVec4(actual.orientation)).toEqual(fixedVec4(expected.orientation));
        });

        describe('_translateCameraConstrained', () => {
            test('it clamps at zoom 0 when maxBounds are not defined', () => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 10;
                transform.resize(500, 500);

                transform._updateCameraState();
                transform._translateCameraConstrained([0.2, 0.3, 1000]);

                expect(transform.zoom).toEqual(0);
            });

            test('it performs no clamping if camera z movementis not upwards', () => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 10;
                transform.resize(500, 500);

                transform._updateCameraState();
                const initialPos = transform._camera.position;
                transform._translateCameraConstrained([0.2, 0.3, 0]);
                const finalPos = transform._camera.position;

                expect(initialPos[0] + 0.2).toEqual(finalPos[0]);
                expect(initialPos[1] + 0.3).toEqual(finalPos[1]);
                expect(initialPos[2]).toEqual(finalPos[2]);
            });

            test('it clamps at a height equivalent to _constrain', () => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 20;
                transform.resize(500, 500);
                transform.setMaxBounds(LngLatBounds.convert([-5, -5, 5, 5]));

                //record constrained zoom
                transform.zoom = 0;
                const minZoom = transform.zoom;

                //zoom back in and update camera position
                transform.zoom = 20;
                transform._updateCameraState();
                transform._translateCameraConstrained([0.1, 0.2, 1]);
                expect(transform.zoom).toEqual(minZoom);
            });
        });
    });

    test("pointRayIntersection with custom altitude", () => {
        const transform = new Transform();
        transform.resize(100, 100);
        transform.pitch = 45;

        let result = transform.rayIntersectionCoordinate(transform.pointRayIntersection(transform.centerPoint));
        expect(fixedCoord(result)).toEqual(new MercatorCoordinate(0.5, 0.5, 0.0));

        result = transform.rayIntersectionCoordinate(transform.pointRayIntersection(transform.centerPoint, 1000));
        const diff = mercatorZfromAltitude(1000, 0);
        expect(fixedCoord(result)).toEqual(fixedCoord(new MercatorCoordinate(0.5, 0.5 + diff, diff)));
    });

    test("zoomFromMercatorZAdjusted", () => {
        const transform = new Transform();
        transform.resize(500, 500);
        expect(transform.setProjection({name: 'globe'})).toBeTruthy();

        for (let zoom = 0; zoom < 6; ++zoom) {
            transform.zoom = zoom;

            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(1e3, 0)), 3)
            ).toEqual(6);
            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(1e6, 0)), 3)
            ).toEqual(5.874);
            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(4e6, 0)), 3)
            ).toEqual(3.87);
            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(1e7, 0)), 3)
            ).toEqual(2.054);
            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(2e7, 0)), 3)
            ).toEqual(1.052);
            expect(
                fixedNum(transform.zoomFromMercatorZAdjusted(mercatorZfromAltitude(5e7, 0)), 3)
            ).toEqual(0);
        }
    });

    test("ZoomDeltaToMovement", () => {
        const transform = new Transform();
        transform.resize(100, 100);

        // Incrementing zoom by 1 is expected reduce distance by half
        let foundMovement = transform.zoomDeltaToMovement([0.5, 0.5, 0.0], 1.0);
        let expectedMovement = transform.cameraToCenterDistance / transform.worldSize * 0.5;
        expect(foundMovement).toEqual(expectedMovement);

        foundMovement = transform.zoomDeltaToMovement([0.5, 0.5, 0.0], 2.0);
        expectedMovement = transform.cameraToCenterDistance / transform.worldSize * 0.75;
        expect(foundMovement).toEqual(expectedMovement);
    });

    test("ComputeZoomRelativeTo", () => {
        const transform = new Transform();
        transform.resize(100, 100);
        transform.zoom = 0;

        const height = transform._camera.position[2];
        expect(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, 0.0))).toEqual(0);
        expect(transform.computeZoomRelativeTo(new MercatorCoordinate(0.0, 0.0, 0.0))).toEqual(0);
        expect(
            transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.5))
        ).toEqual(1);
        expect(
            transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.75))
        ).toEqual(2);

        transform.zoom += 1;
        expect(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, 0.0))).toEqual(1);
        expect(
            transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.25))
        ).toEqual(2);
        expect(
            transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.375))
        ).toEqual(3);
    });

    test("setProjection", () => {
        const transform = new Transform();
        expect(transform.getProjection().name).toEqual('mercator');

        // correctly returns indication of whether projection changed
        expect(transform.setProjection({name: 'albers'})).toBeTruthy();
        expect(transform.setProjection({name: 'albers'})).toBeFalsy();
        expect(transform.setProjection({name: 'albers', center: [-96, 37.5]})).toBeFalsy();
        expect(transform.setProjection({name: 'albers', center: [-100, 37.5]})).toBeTruthy();
        expect(transform.setProjection({name: 'mercator'})).toBeTruthy();
        expect(transform.setProjection()).toBeFalsy();
    });
});
