import {test} from '../../util/test';
import Point from '@mapbox/point-geometry';
import Transform from '../../../src/geo/transform';
import LngLat from '../../../src/geo/lng_lat';
import {OverscaledTileID, CanonicalTileID} from '../../../src/source/tile_id';
import {fixedNum, fixedLngLat, fixedCoord, fixedPoint, fixedVec3, fixedVec4} from '../../util/fixed';
import {FreeCameraOptions} from '../../../src/ui/free_camera';
import MercatorCoordinate, {mercatorZfromAltitude} from '../../../src/geo/mercator_coordinate';
import {vec3, quat} from 'gl-matrix';
import LngLatBounds from '../../../src/geo/lng_lat_bounds';
import {extend, degToRad} from '../../../src/util/util';

test('transform', (t) => {

    t.test('creates a transform', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        t.equal(transform.unmodified, true);
        t.equal(transform.maxValidLatitude, 85.051129);
        t.equal(transform.tileSize, 512, 'tileSize');
        t.equal(transform.worldSize, 512, 'worldSize');
        t.equal(transform.width, 500, 'width');
        t.equal(transform.minZoom, 0, 'minZoom');
        t.equal(transform.minPitch, 0, 'minPitch');
        t.equal(transform.bearing, 0, 'bearing');
        t.equal(transform.bearing = 1, 1, 'set bearing');
        t.equal(transform.bearing, 1, 'bearing');
        t.equal(transform.bearing = 0, 0, 'set bearing');
        t.equal(transform.unmodified, false);
        t.equal(transform.minZoom = 10, 10);
        t.equal(transform.maxZoom = 10, 10);
        t.equal(transform.minZoom, 10);
        t.deepEqual(transform.center, {lng: 0, lat: 0});
        t.equal(transform.maxZoom, 10);
        t.equal(transform.minPitch = 10, 10);
        t.equal(transform.maxPitch = 10, 10);
        t.equal(transform.size.equals(new Point(500, 500)), true);
        t.equal(transform.centerPoint.equals(new Point(250, 250)), true);
        t.equal(transform.scaleZoom(0), -Infinity);
        t.equal(transform.scaleZoom(10), 3.3219280948873626);
        t.deepEqual(transform.point, new Point(262144, 262144));
        t.equal(transform.height, 500);
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(250, 250))), {lng: 0, lat: 0});
        t.deepEqual(fixedCoord(transform.pointCoordinate(new Point(250, 250))), {x: 0.5, y: 0.5, z: 0});
        t.deepEqual(fixedPoint(transform.locationPoint(new LngLat(0, 0))), {x: 250, y: 250});
        t.deepEqual(transform.locationCoordinate(new LngLat(0, 0)), {x: 0.5, y: 0.5, z: 0});
        t.deepEqual(fixedLngLat(transform.pointLocation3D(new Point(250, 250))), {lng: 0, lat: 0});
        t.deepEqual(fixedCoord(transform.pointCoordinate3D(new Point(250, 250))), {x: 0.5, y: 0.5, z: 0});
        t.deepEqual(fixedPoint(transform.locationPoint3D(new LngLat(0, 0))), {x: 250, y: 250});
        t.end();
    });

    t.test('does not throw on bad center', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.center = {lng: 50, lat: -90};
        t.end();
    });

    t.test('setLocationAt', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        t.deepEqual(transform.center, {lng: 0, lat: 0});
        transform.setLocationAtPoint({lng: 13, lat: 10}, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), {lng: 13, lat: 10});
        t.end();
    });

    t.test('setLocationAt tilted', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        transform.pitch = 50;
        t.deepEqual(transform.center, {lng: 0, lat: 0});
        transform.setLocationAtPoint({lng: 13, lat: 10}, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), {lng: 13, lat: 10});
        t.end();
    });

    t.test('has a default zoom', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        t.equal(transform.tileZoom, 0);
        t.equal(transform.tileZoom, transform.zoom);
        t.end();
    });

    t.test('set fov', (t) => {
        const transform = new Transform();
        transform.fov = 10;
        t.equal(transform.fov, 10);
        transform.fov = 10;
        t.equal(transform.fov, 10);
        t.end();
    });

    t.test('lngRange & latRange constrain zoom and center', (t) => {
        const transform = new Transform();
        transform.center = new LngLat(0, 0);
        transform.zoom = 10;
        transform.resize(500, 500);

        transform.lngRange = [-5, 5];
        transform.latRange = [-5, 5];

        transform.zoom = 0;
        t.equal(transform.zoom, 5.135709286104402);

        transform.center = new LngLat(-50, -30);
        t.same(transform.center, new LngLat(0, -0.0063583052861417855));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        t.same(transform.center, new LngLat(-4.828338623046875, -4.828969771321582));

        t.end();
    });

    t.test('_minZoomForBounds respects latRange and lngRange', (t) => {
        t.test('it returns 0 when latRange and lngRange are undefined', (t) => {
            const transform = new Transform();
            transform.center = new LngLat(0, 0);
            transform.zoom = 10;
            transform.resize(500, 500);

            t.equal(transform._minZoomForBounds(), 0);
            t.end();
        });

        t.test('it results in equivalent minZoom as _constrain()', (t) => {
            const transform = new Transform();
            transform.center = new LngLat(0, 0);
            transform.zoom = 10;
            transform.resize(500, 500);
            transform.lngRange = [-5, 5];
            transform.latRange = [-5, 5];

            const preComputedMinZoom = transform._minZoomForBounds();
            transform.zoom = 0;
            const constrainedMinZoom = transform.zoom;

            t.equal(preComputedMinZoom, constrainedMinZoom);
            t.end();
        });

        t.end();
    });

    test('mapbox-gl-js-internal#373', (t) => {
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

        t.deepEqual(transform.coveringTiles(options), [
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

        t.end();
    });

    test('pointCoordinate retains direction when point is offscreen', (t) => {

        function assertDueNorth(t, m1, m2) {
            const dx = m2.x - m1.x;
            const dy = m2.y - m1.y;
            const l = Math.sqrt(dx * dx + dy * dy);
            const ndx = dx / l;
            const ndy = dy / l;
            t.ok(Math.abs(ndx) < 1e-10);
            t.ok(Math.abs(ndy + 1) < 1e-10);
        }

        t.test('no pitch', (t) => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 0;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth(t, {x: 0.5, y: 0.5, z : 0}, coord);
            t.end();
        });

        t.test('high pitch', (t) => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 80;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth(t, {x: 0.5, y: 0.5, z : 0}, coord);
            t.end();
        });

        t.test('medium pitch', (t) => {
            const transform = new Transform();
            transform.center = {lng: 0, lat: 0};
            transform.zoom = 16;
            transform.pitch = 70;
            transform.bearing = 0;
            transform.resize(512, 512);

            const coord = transform.pointCoordinate(new Point(transform.width / 2, -10000));
            assertDueNorth(t, {x: 0.5, y: 0.5, z : 0}, coord);
            t.end();
        });

        t.end();
    });

    test('coveringTiles', (t) => {
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
        t.deepEqual(transform.coveringTiles(options), []);

        transform.zoom = 1;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(2, 0, 2, 1, 1),
            new OverscaledTileID(2, 0, 2, 2, 1),
            new OverscaledTileID(2, 0, 2, 1, 2),
            new OverscaledTileID(2, 0, 2, 2, 2)]);

        transform.zoom = 10;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 11;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 5.1;
        transform.pitch = 60.0;
        transform.bearing = 32.0;
        transform.center = new LngLat(56.90, 48.20);
        transform.resize(1024, 768);
        t.deepEqual(transform.coveringTiles(options), [
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
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(8, 0, 8, 145, 74),
            new OverscaledTileID(8, 0, 8, 145, 73),
            new OverscaledTileID(8, 0, 8, 146, 74)
        ]);

        transform.resize(50, 300);
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(8, 0, 8, 145, 74),
            new OverscaledTileID(8, 0, 8, 145, 73),
            new OverscaledTileID(8, 0, 8, 146, 74),
            new OverscaledTileID(8, 0, 8, 146, 73)
        ]);

        transform.zoom = 2;
        transform.pitch = 0;
        transform.bearing = 0;
        transform.resize(300, 300);
        t.test('calculates tile coverage at w > 0', (t) => {
            transform.center = {lng: 630.02, lat: 0.01};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
            t.end();
        });

        t.test('calculates tile coverage at w = -1', (t) => {
            transform.center = {lng: -360.01, lat: 0.02};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
            t.end();
        });

        t.test('calculates tile coverage across meridian', (t) => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.02};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, -1, 1, 1, 1),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
            t.end();
        });

        t.test('only includes tiles for a single world, if renderWorldCopies is set to false', (t) => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.01};
            transform.renderWorldCopies = false;
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
            t.end();
        });

        t.test('mapbox-gl-js-internal#86', (t) => {
            transform.renderWorldCopies = true;
            transform.maxPitch = 85;
            transform.zoom = 1.28;
            transform.bearing = -81.6;
            transform.pitch = 81;
            transform.center = {lng: -153.3, lat: 0.0};
            transform.resize(2759, 1242);
            t.deepEqual(transform.coveringTiles({tileSize: 512}), [
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
            t.end();
        });

        t.end();
    });

    const createCollisionElevation = (elevation) => {
        return {
            getAtPoint(p) {
                if (p.x === 0.5 && p.y === 0.5)
                    return 0;
                return elevation;
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = elevation;
                }
                return true;
            },
        };
    };

    const createConstantElevation = (elevation) => {
        return {
            getAtPoint(_) {
                return elevation;
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = elevation;
                }
                return true;
            },
        };
    };

    const createRampElevation = (scale) => {
        return {
            getAtPoint(p) {
                return scale * (p.x + p.y - 1.0);
            },
            getForTilePoints(tileID, points) {
                for (const p of points) {
                    p[2] = scale * (p.x + p.y - 1.0);
                }
                return true;
            },
        };
    };

    test('Constrained camera height over terrain', (t) => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.maxPitch = 85;

        transform.elevation = createCollisionElevation(10);
        transform.constantCameraHeight = false;
        transform.bearing = -45;
        transform.pitch = 85;

        // Set camera altitude to 5 meters
        const altitudeZ = mercatorZfromAltitude(5, transform.center.lat) / Math.cos(degToRad(85));
        const zoom = transform._zoomFromMercatorZ(altitudeZ);
        transform.zoom = zoom;

        // Pitch should have been adjusted so that the camera isn't under the terrain
        const pixelsPerMeter = mercatorZfromAltitude(1, transform.center.lat) * transform.worldSize;
        const updatedAltitude = transform.cameraToCenterDistance / pixelsPerMeter * Math.cos(degToRad(transform.pitch));

        t.true(updatedAltitude > 10);
        t.equal(fixedNum(transform.zoom), fixedNum(zoom));
        t.equal(fixedNum(transform.bearing), -45);

        t.end();
    });

    test('Compute zoom from camera height', (t) => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.center = {lng: 0, lat: 0};
        transform.zoom = 16;
        transform.elevation = createRampElevation(500);
        t.equal(transform.elevation.getAtPoint(new MercatorCoordinate(1.0, 0.5)), 250);

        t.equal(transform.zoom, 16);
        t.equal(transform._cameraZoom, 16);

        // zoom should remain unchanged
        transform.cameraElevationReference = "ground";
        transform.center = new LngLat(180, 0);
        t.equal(transform.zoom, 16);

        transform.center = new LngLat(0, 0);
        t.equal(transform.zoom, 16);

        // zoom should change so that the altitude remains constant
        transform.cameraElevationReference = "sea";
        transform.center = new LngLat(180, 0);
        t.equal(transform._cameraZoom, 16);

        const altitudeZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform._cameraZoom) * transform.tileSize);
        const heightZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform.zoom) * transform.tileSize);
        const elevationZ = mercatorZfromAltitude(250, 0);
        t.equal(fixedNum(elevationZ + heightZ), fixedNum(altitudeZ));

        t.end();
    });

    test('Constant camera height over terrain', (t) => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.center = {lng: 0, lat: 0};
        transform.zoom = 16;

        transform.elevation = createConstantElevation(0);
        t.equal(transform.zoom, transform._cameraZoom);

        // Camera zoom should change so that the standard zoom value describes distance between the camera and the terrain
        transform.elevation = createConstantElevation(10000);
        t.equal(fixedNum(transform._cameraZoom), 11.1449615644);

        // Camera height over terrain should remain constant
        const altitudeZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform._cameraZoom) * transform.tileSize);
        const heightZ = transform.cameraToCenterDistance / (Math.pow(2.0, transform.zoom) * transform.tileSize);
        const elevationZ = mercatorZfromAltitude(10000, 0);
        t.equal(elevationZ + heightZ, altitudeZ);

        transform.pitch = 32;
        t.equal(fixedNum(transform._cameraZoom), 11.1449615644);
        t.equal(transform.zoom, 16);

        t.end();
    });

    test('coveringTiles for terrain', (t) => {
        const options2D = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const options = extend({
            useElevationData: true
        }, options2D);

        const transform = new Transform();
        let centerElevation = 0;
        let tilesDefaultElevation = 0;
        const tileElevation = {};
        const elevation = {
            getAtPoint(_) {
                return this.exaggeration() * centerElevation;
            },
            getMinMaxForTile(tileID) {
                const ele = tileElevation[tileID.key] !== undefined ? tileElevation[tileID.key] : tilesDefaultElevation;
                if (ele === null) return null;
                return {min: this.exaggeration() * ele, max: this.exaggeration() * ele};
            },
            exaggeration() {
                return 10; // Low tile zoom used, exaggerate elevation to make impact.
            }
        };
        transform.elevation = elevation;
        transform.resize(200, 200);

        // make slightly off center so that sort order is not subject to precision issues
        transform.center = {lng: -0.01, lat: 0.01};

        transform.zoom = 0;
        t.deepEqual(transform.coveringTiles(options), []);

        transform.zoom = 1;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(1, 0, 1, 0, 0),
            new OverscaledTileID(1, 0, 1, 1, 0),
            new OverscaledTileID(1, 0, 1, 0, 1),
            new OverscaledTileID(1, 0, 1, 1, 1)]);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(2, 0, 2, 1, 1),
            new OverscaledTileID(2, 0, 2, 2, 1),
            new OverscaledTileID(2, 0, 2, 1, 2),
            new OverscaledTileID(2, 0, 2, 2, 2)]);

        transform.zoom = 10;
        t.deepEqual(transform.coveringTiles(options), [
            new OverscaledTileID(10, 0, 10, 511, 511),
            new OverscaledTileID(10, 0, 10, 512, 511),
            new OverscaledTileID(10, 0, 10, 511, 512),
            new OverscaledTileID(10, 0, 10, 512, 512)]);

        transform.zoom = 11;
        t.deepEqual(transform.coveringTiles(options), [
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
        const cover2D = transform.coveringTiles(options2D);
        // No LOD as there is no elevation data.
        t.true(cover2D[0].overscaledZ === cover2D[cover2D.length - 1].overscaledZ);

        transform.pitch = 65.0;
        transform.elevation = elevation;
        const cover = transform.coveringTiles(options);
        // First part of the cover should be the same as for 60 degrees no elevation case.
        t.deepEqual(cover.slice(0, 6), cover2D.slice(0, 6));

        // Even though it is larger pitch, less tiles are expected as LOD kicks in.
        t.true(cover.length < cover2D.length);
        t.true(cover[0].overscaledZ > cover[cover.length - 1].overscaledZ);

        // Elevated LOD with elevated center returns the same
        tilesDefaultElevation = centerElevation = 10000;

        transform.elevation = null;
        transform.elevation = elevation;
        const cover10k = transform.coveringTiles(options);

        t.deepEqual(cover, cover10k);

        // Lower tiles on side get clipped.
        const lowTiles = [
            new OverscaledTileID(9, 0, 9, 335, 178).key,
            new OverscaledTileID(9, 0, 9, 337, 178).key
        ];
        t.true(cover.filter(t => lowTiles.includes(t.key)).length === lowTiles.length);

        for (const t of lowTiles) {
            tileElevation[t] = 0;
        }
        const coverLowSide = transform.coveringTiles(options);
        t.true(coverLowSide.filter(t => lowTiles.includes(t.key)).length === 0);

        tileElevation[lowTiles[0]] = null; // missing elevation information gets to cover.
        t.ok(transform.coveringTiles(options).find(t => t.key === lowTiles[0]));

        transform.zoom = 2;
        transform.pitch = 0;
        transform.bearing = 0;
        transform.resize(300, 300);
        t.test('calculates tile coverage at w > 0', (t) => {
            transform.center = {lng: 630.02, lat: 0.01};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(2, 2, 2, 1, 1),
                new OverscaledTileID(2, 2, 2, 1, 2),
                new OverscaledTileID(2, 2, 2, 0, 1),
                new OverscaledTileID(2, 2, 2, 0, 2)
            ]);
            t.end();
        });

        t.test('calculates tile coverage at w = -1', (t) => {
            transform.center = {lng: -360.01, lat: 0.02};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(2, -1, 2, 1, 1),
                new OverscaledTileID(2, -1, 2, 2, 1),
                new OverscaledTileID(2, -1, 2, 1, 2),
                new OverscaledTileID(2, -1, 2, 2, 2)
            ]);
            t.end();
        });

        t.test('calculates tile coverage across meridian', (t) => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.02};
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(1, -1, 1, 1, 0),
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, -1, 1, 1, 1),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
            t.end();
        });
        t.test('only includes tiles for a single world, if renderWorldCopies is set to false', (t) => {
            transform.zoom = 1;
            transform.center = {lng: -180.01, lat: 0.01};
            transform.renderWorldCopies = false;
            t.deepEqual(transform.coveringTiles(options), [
                new OverscaledTileID(1, 0, 1, 0, 0),
                new OverscaledTileID(1, 0, 1, 0, 1)
            ]);
            t.end();
        });
        t.test('proper distance to center with wrap. Zoom drop at the end.', (t) => {
            transform.resize(2000, 2000);
            transform.zoom = 3.29;
            transform.pitch = 57;
            transform.bearing = 91.8;
            transform.center = {lng: -134.66, lat: 20.52};
            const cover = transform.coveringTiles(options);
            t.assert(cover[0].overscaledZ === 3);
            t.assert(cover[cover.length - 1].overscaledZ <= 2);
            t.end();
        });

        t.end();
    });

    test('coveringZoomLevel', (t) => {
        const options = {
            minzoom: 1,
            maxzoom: 10,
            tileSize: 512
        };

        const transform = new Transform();

        transform.zoom = 0;
        t.deepEqual(transform.coveringZoomLevel(options), 0);

        transform.zoom = 0.1;
        t.deepEqual(transform.coveringZoomLevel(options), 0);

        transform.zoom = 1;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringZoomLevel(options), 2);

        transform.zoom = 10;
        t.deepEqual(transform.coveringZoomLevel(options), 10);

        transform.zoom = 11;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        transform.zoom = 11.5;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        options.tileSize = 256;

        transform.zoom = 0;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 0.1;
        t.deepEqual(transform.coveringZoomLevel(options), 1);

        transform.zoom = 1;
        t.deepEqual(transform.coveringZoomLevel(options), 2);

        transform.zoom = 2.4;
        t.deepEqual(transform.coveringZoomLevel(options), 3);

        transform.zoom = 10;
        t.deepEqual(transform.coveringZoomLevel(options), 11);

        transform.zoom = 11;
        t.deepEqual(transform.coveringZoomLevel(options), 12);

        transform.zoom = 11.5;
        t.deepEqual(transform.coveringZoomLevel(options), 12);

        options.roundZoom = true;

        t.deepEqual(transform.coveringZoomLevel(options), 13);

        t.end();
    });

    t.test('clamps latitude', (t) => {
        const transform = new Transform();

        t.deepEqual(transform.project(new LngLat(0, -90)), transform.project(new LngLat(0, -transform.maxValidLatitude)));
        t.deepEqual(transform.project(new LngLat(0, 90)), transform.project(new LngLat(0, transform.maxValidLatitude)));
        t.end();
    });

    t.test('clamps pitch', (t) => {
        const transform = new Transform();

        transform.pitch = 45;
        t.equal(transform.pitch, 45);

        transform.pitch = -10;
        t.equal(transform.pitch, 0);

        transform.pitch = 90;
        t.equal(transform.pitch, 60);

        t.end();
    });

    t.test('visibleUnwrappedCoordinates', (t) => {
        const transform = new Transform();
        transform.resize(200, 200);
        transform.zoom = 0;
        transform.center = {lng: -170.01, lat: 0.01};

        let unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        t.equal(unwrappedCoords.length, 4);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        transform._renderWorldCopies = false;
        unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        t.equal(unwrappedCoords.length, 1);

        t.end();
    });

    t.test('isHorizonVisible', (t) => {

        t.test('isHorizonVisibleForPoints', (t) => {
            const transform = new Transform();
            transform.maxPitch = 85;
            transform.resize(800, 800);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 85;
            let p0, p1;

            t.true(transform.isHorizonVisible());

            p0 = new Point(0, 0); p1 = new Point(10, 10);
            t.true(transform.isHorizonVisibleForPoints(p0, p1));

            p0 = new Point(0, 250); p1 = new Point(10, 350);
            t.true(transform.isHorizonVisibleForPoints(p0, p1));

            p0 = new Point(0, transform.horizonLineFromTop() - 10);
            p1 = new Point(10, transform.horizonLineFromTop() + 10);
            t.true(transform.isHorizonVisibleForPoints(p0, p1));

            p0 = new Point(0, 700); p1 = new Point(10, 710);
            t.false(transform.isHorizonVisibleForPoints(p0, p1));

            p0 = new Point(0, transform.horizonLineFromTop());
            p1 = new Point(10, transform.horizonLineFromTop() + 10);
            t.false(transform.isHorizonVisibleForPoints(p0, p1));

            t.end();
        });

        t.test('high pitch', (t) => {
            const transform = new Transform();
            transform.maxPitch = 85;
            transform.resize(300, 300);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 0;

            t.false(transform.isHorizonVisible());
            transform.pitch = 85;
            t.true(transform.isHorizonVisible());

            t.end();
        });

        t.test('with large top padding', (t) => {
            const transform = new Transform();
            transform.resize(200, 200);
            transform.zoom = 10;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 60;

            t.false(transform.isHorizonVisible());
            transform.padding = {top: 180};
            t.true(transform.isHorizonVisible());

            t.end();
        });

        t.test('lower zoom level, rotated map making background visible', (t) => {
            const transform = new Transform();
            transform.resize(1300, 1300);
            transform.zoom = 3;
            transform.center = {lng: 0, lat: 0};
            transform.pitch = 0;

            t.false(transform.isHorizonVisible());
            transform.zoom = 0;
            transform.bearing = 45;
            t.true(transform.isHorizonVisible());

            t.end();
        });

        t.test('accounts for renderWorldCopies', (t) => {
            const transform = new Transform();
            transform.resize(1300, 1300);
            transform.zoom = 2;
            transform.center = {lng: -135, lat: 0};
            transform.pitch = 0;
            transform.bearing = -45;
            transform.renderWorldCopies = true;

            t.false(transform.isHorizonVisible());
            transform.renderWorldCopies = false;
            t.true(transform.isHorizonVisible());

            t.end();
        });

        t.end();
    });

    t.test('freeCamera', (t) => {
        const rotatedFrame = (quaternion) => {
            return {
                up: vec3.transformQuat([], [0, -1, 0], quaternion),
                forward: vec3.transformQuat([], [0, 0, -1], quaternion),
                right: vec3.transformQuat([], [1, 0, 0], quaternion)
            };
        };

        t.test('invalid height', (t) => {
            const transform = new Transform();
            const options = new FreeCameraOptions();

            options.orientation = [1, 1, 1, 1];
            options.position = new MercatorCoordinate(0.1, 0.2, 0.3);
            transform.setFreeCameraOptions(options);

            const updatedOrientation = transform.getFreeCameraOptions().orientation;
            const updatedPosition = transform.getFreeCameraOptions().position;

            // Expect default state as height is invalid
            t.deepEqual(updatedOrientation, [0, 0, 0, 1]);
            t.deepEqual(updatedPosition, new MercatorCoordinate(0, 0, 0));
            t.end();
        });

        t.test('invalid z', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Invalid z-value (<= 0.0 || > 1) should be clamped to respect both min & max zoom values
            options.position = new MercatorCoordinate(0.1, 0.1, 0.0);
            transform.setFreeCameraOptions(options);
            t.equal(transform.zoom, transform.maxZoom);
            t.true(transform.getFreeCameraOptions().position.z > 0.0);

            options.position = new MercatorCoordinate(0.5, 0.2, 123.456);
            transform.setFreeCameraOptions(options);
            t.equal(transform.zoom, transform.minZoom);
            t.true(transform.getFreeCameraOptions().position.z <= 1.0);

            t.end();
        });

        t.test('orientation', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Default orientation
            options.orientation = [0, 0, 0, 1];
            transform.setFreeCameraOptions(options);
            t.equal(transform.bearing, 0);
            t.equal(transform.pitch, 0);
            t.deepEqual(transform.center, new LngLat(0, 0));

            // 60 pitch
            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, -60.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            t.equal(transform.bearing, 0.0);
            t.equal(transform.pitch, 60.0);
            t.deepEqual(fixedPoint(transform.point, 5), new Point(256, 50));

            // 56 bearing
            options.orientation = [0, 0, 0, 1];
            quat.rotateZ(options.orientation, options.orientation, 56.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            t.equal(fixedNum(transform.bearing), 56.0);
            t.equal(fixedNum(transform.pitch), 0.0);
            t.deepEqual(fixedPoint(transform.point, 5), new Point(512, 359.80761));

            // 30 pitch and -179 bearing
            options.orientation = [0, 0, 0, 1];
            quat.rotateZ(options.orientation, options.orientation, -179.0 * Math.PI / 180.0);
            quat.rotateX(options.orientation, options.orientation, -30.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            t.equal(fixedNum(transform.bearing), -179.0);
            t.equal(fixedNum(transform.pitch), 30.0);
            t.deepEqual(fixedPoint(transform.point, 5), new Point(442.09608, 386.59111));

            t.end();
        });

        t.test('invalid orientation', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            // Zero length quaternion
            options.orientation = [0, 0, 0, 0];
            transform.setFreeCameraOptions(options);
            t.deepEqual(transform.getFreeCameraOptions().orientation, [0, 0, 0, 1]);

            // up vector is on the xy-plane. Right vector can't be computed
            options.orientation = [0, 0, 0, 1];
            quat.rotateY(options.orientation, options.orientation, Math.PI * 0.5);
            transform.setFreeCameraOptions(options);
            t.deepEqual(transform.getFreeCameraOptions().orientation, [0, 0, 0, 1]);

            // Camera is upside down
            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, Math.PI * 0.75);
            transform.setFreeCameraOptions(options);
            t.deepEqual(transform.getFreeCameraOptions().orientation, [0, 0, 0, 1]);

            t.end();
        });

        t.test('wraps coordinates when renderWorldCopies is true', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();
            options._renderWorldCopies = true;

            const lngLatLike = [-482.44, 37.83];
            options.position = MercatorCoordinate.fromLngLat(lngLatLike);
            transform.setFreeCameraOptions(options);

            t.equal(parseFloat(options.position.toLngLat().lng.toFixed(2)), -122.44);
            t.end();
        });

        t.test('does not wrap coordinates when renderWorldCopies is falsey', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();

            const lngLatLike = [-482.44, 37.83];
            options.position = MercatorCoordinate.fromLngLat(lngLatLike);
            transform.setFreeCameraOptions(options);

            t.equal(parseFloat(options.position.toLngLat().lng.toFixed(2)), lngLatLike[0]);
            t.end();
        });

        t.test('clamp pitch', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            const options = new FreeCameraOptions();
            let frame = null;

            options.orientation = [0, 0, 0, 1];
            quat.rotateX(options.orientation, options.orientation, -85.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);
            t.equal(transform.pitch, transform.maxPitch);
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);

            t.deepEqual(fixedVec3(frame.right, 5), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up, 5), [0, -0.5, 0.86603]);
            t.deepEqual(fixedVec3(frame.forward, 5), [0, -0.86603, -0.5]);

            t.end();
        });

        t.test('clamp to bounds', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            transform.setMaxBounds(new LngLatBounds(new LngLat(-180, -transform.maxValidLatitude), new LngLat(180, transform.maxValidLatitude)));
            transform.zoom = 8.56;
            const options = new FreeCameraOptions();

            // Place the camera to an arbitrary position looking away from the map
            options.position = new MercatorCoordinate(-100.0, -10000.0, 1000.0);
            options.orientation = quat.rotateX([], [0, 0, 0, 1], -45.0 * Math.PI / 180.0);
            transform.setFreeCameraOptions(options);

            t.deepEqual(fixedPoint(transform.point, 5), new Point(50, 50));
            t.equal(fixedNum(transform.bearing), 0.0);
            t.equal(fixedNum(transform.pitch), 45.0);

            t.end();
        });

        t.test('invalid state', (t) => {
            const transform = new Transform();

            t.equal(transform.pitch, 0);
            t.equal(transform.bearing, 0);
            t.deepEqual(transform.point, new Point(256, 256));

            t.deepEqual(transform.getFreeCameraOptions().position, new MercatorCoordinate(0, 0, 0));
            t.deepEqual(transform.getFreeCameraOptions().orientation, [0, 0, 0, 1]);

            t.end();
        });

        t.test('orientation roll', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            let options = new FreeCameraOptions();

            const orientationWithoutRoll = quat.rotateX([], [0, 0, 0, 1], -Math.PI / 4);
            const orientationWithRoll = quat.rotateZ([], orientationWithoutRoll, Math.PI / 4);

            options.orientation = orientationWithRoll;
            transform.setFreeCameraOptions(options);
            options = transform.getFreeCameraOptions();

            t.deepEqual(fixedVec4(options.orientation, 5), fixedVec4(orientationWithoutRoll, 5));
            t.equal(fixedNum(transform.pitch), 45.0);
            t.equal(fixedNum(transform.bearing), 0.0);
            t.deepEqual(fixedPoint(transform.point), new Point(256, 106));

            t.end();
        });

        t.test('state synchronization', (t) => {
            const transform = new Transform();
            transform.resize(100, 100);
            let frame = null;

            transform.pitch = 0.0;
            transform.bearing = 0.0;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            t.deepEqual(transform.getFreeCameraOptions().position, new MercatorCoordinate(0.5, 0.5, 0.29296875));
            t.deepEqual(frame.right, [1, 0, 0]);
            t.deepEqual(frame.up, [0, -1, 0]);
            t.deepEqual(frame.forward, [0, 0, -1]);

            transform.center = new LngLat(24.9384, 60.1699);
            t.deepEqual(fixedCoord(transform.getFreeCameraOptions().position, 5), new MercatorCoordinate(0.56927, 0.28945, 0.29297));

            transform.center = new LngLat(20, -20);
            transform.pitch = 20;
            transform.bearing = 77;
            t.deepEqual(fixedCoord(transform.getFreeCameraOptions().position, 5), new MercatorCoordinate(0.45792, 0.57926, 0.27530));

            transform.pitch = 0;
            transform.bearing = 90;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            t.deepEqual(fixedVec3(frame.right), [0, 1, 0]);
            t.deepEqual(fixedVec3(frame.up), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.forward), [0, 0, -1]);

            // Invalid pitch
            transform.bearing = 0;
            transform.pitch = -10;
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            t.deepEqual(fixedCoord(transform.getFreeCameraOptions().position, 5), new MercatorCoordinate(0.55556, 0.55672, 0.29297));
            t.deepEqual(frame.right, [1, 0, 0]);
            t.deepEqual(frame.up, [0, -1, 0]);
            t.deepEqual(frame.forward, [0, 0, -1]);

            transform.bearing = 0;
            transform.pitch = 85;
            transform.center = new LngLat(0, -80);
            frame = rotatedFrame(transform.getFreeCameraOptions().orientation);
            t.deepEqual(fixedCoord(transform.getFreeCameraOptions().position, 5), new MercatorCoordinate(0.5, 1.14146, 0.14648));
            t.deepEqual(fixedVec3(frame.right, 5), [1, 0, 0]);
            t.deepEqual(fixedVec3(frame.up, 5), [0, -0.5, 0.86603]);
            t.deepEqual(fixedVec3(frame.forward, 5), [0, -0.86603, -0.5]);

            t.end();
        });

        t.test('Position should ignore the camera elevation reference mode', (t) => {
            let groundElevation = 200;
            const transform = new Transform(0, 22, 0, 85);
            transform.resize(100, 100);
            transform._elevation = {
                getAtPoint: () => groundElevation,
                exaggeration: () => 1.0,
                raycast: () => undefined
            };

            const expected = new FreeCameraOptions();
            expected.position = new MercatorCoordinate(0.1596528750412326, 0.3865452936454495, 0.00007817578881907832);
            expected.orientation = [-0.35818916989938915, -0.3581891698993891, 0.6096724682702889, 0.609672468270289];

            transform.cameraElevationReference = "sea";
            transform.setFreeCameraOptions(expected);
            let actual = transform.getFreeCameraOptions();
            t.deepEqual(fixedCoord(actual.position), fixedCoord(expected.position));
            t.deepEqual(fixedVec4(actual.orientation), fixedVec4(expected.orientation));

            transform.cameraElevationReference = "ground";
            groundElevation = 300;
            expected.position = new MercatorCoordinate(0.16, 0.39, 0.000078);
            transform.setFreeCameraOptions(expected);
            actual = transform.getFreeCameraOptions();
            t.deepEqual(fixedCoord(actual.position), fixedCoord(expected.position));
            t.deepEqual(fixedVec4(actual.orientation), fixedVec4(expected.orientation));

            t.end();
        });

        t.test('_translateCameraConstrained', (t) => {
            t.test('it clamps at zoom 0 when lngRange and latRange are not defined', (t) => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 10;
                transform.resize(500, 500);

                transform._updateCameraState();
                transform._translateCameraConstrained([0.2, 0.3, 1000]);

                t.equal(transform.zoom, 0);
                t.end();
            });

            t.test('it performs no clamping if camera z movementis not upwards', (t) => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 10;
                transform.resize(500, 500);

                transform._updateCameraState();
                const initialPos = transform._camera.position;
                transform._translateCameraConstrained([0.2, 0.3, 0]);
                const finalPos = transform._camera.position;

                t.equal(initialPos[0] + 0.2, finalPos[0]);
                t.equal(initialPos[1] + 0.3, finalPos[1]);
                t.equal(initialPos[2], finalPos[2]);
                t.end();
            });

            t.test('it clamps at a height equivalent to _constrain', (t) => {
                const transform = new Transform();
                transform.center = new LngLat(0, 0);
                transform.zoom = 20;
                transform.resize(500, 500);
                transform.lngRange = [-5, 5];
                transform.latRange = [-5, 5];

                //record constrained zoom
                transform.zoom = 0;
                const minZoom = transform.zoom;

                //zoom back in and update camera position
                transform.zoom = 20;
                transform._updateCameraState();
                transform._translateCameraConstrained([0.1, 0.2, 1]);
                t.equal(transform.zoom, minZoom);

                t.end();
            });

            t.end();
        });

        t.end();
    });

    t.test("pointRayIntersection with custom altitude", (t) => {
        const transform = new Transform();
        transform.resize(100, 100);
        transform.pitch = 45;

        let result = transform.rayIntersectionCoordinate(transform.pointRayIntersection(transform.centerPoint));
        t.deepEqual(fixedCoord(result), new MercatorCoordinate(0.5, 0.5, 0.0));

        result = transform.rayIntersectionCoordinate(transform.pointRayIntersection(transform.centerPoint, 1000));
        const diff = mercatorZfromAltitude(1000, 0);
        t.deepEqual(fixedCoord(result), fixedCoord(new MercatorCoordinate(0.5, 0.5 + diff, diff)));

        t.end();
    });

    t.test("ZoomDeltaToMovement", (t) => {
        const transform = new Transform();
        transform.resize(100, 100);

        // Incrementing zoom by 1 is expected reduce distance by half
        let foundMovement = transform.zoomDeltaToMovement([0.5, 0.5, 0.0], 1.0);
        let expectedMovement = transform.cameraToCenterDistance / transform.worldSize * 0.5;
        t.equal(foundMovement, expectedMovement);

        foundMovement = transform.zoomDeltaToMovement([0.5, 0.5, 0.0], 2.0);
        expectedMovement = transform.cameraToCenterDistance / transform.worldSize * 0.75;
        t.equal(foundMovement, expectedMovement);

        t.end();
    });

    t.test("ComputeZoomRelativeTo", (t) => {
        const transform = new Transform();
        transform.resize(100, 100);
        transform.zoom = 0;

        const height = transform._camera.position[2];
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, 0.0)), 0);
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.0, 0.0, 0.0)), 0);
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.5)), 1);
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.75)), 2);

        transform.zoom += 1;
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, 0.0)), 1);
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.25)), 2);
        t.equal(transform.computeZoomRelativeTo(new MercatorCoordinate(0.5, 0.5, height * 0.375)), 3);

        t.end();
    });

    t.end();
});
