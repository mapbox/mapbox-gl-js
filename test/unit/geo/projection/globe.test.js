import {test} from '../../../util/test.js';
import Transform from '../../../../src/geo/transform.js';
import LngLat from '../../../../src/geo/lng_lat.js';
import {OverscaledTileID} from '../../../../src/source/tile_id.js';
import {getLatitudinalLod} from '../../../../src/geo/projection/globe_util.js';
import {MAX_MERCATOR_LATITUDE} from '../../../../src/geo/mercator_coordinate.js';

test('Globe', (t) => {
    t.test('pointCoordinate', (t) => {
        const tr = new Transform();
        tr.resize(512, 512);
        tr.zoom = 0;
        tr.setProjection({name: 'globe'});

        // center
        let point = tr.projection.pointCoordinate(tr, 256, 256);
        t.same(point.x.toFixed(2), 0.5);
        t.same(point.y.toFixed(2), 0.5);

        // left, middle
        point = tr.projection.pointCoordinate(tr, 0, 256);
        t.same(point.x.toFixed(4), 0.2653);
        t.same(point.y.toFixed(4), 0.5);

        // right, middle
        point = tr.projection.pointCoordinate(tr, 512, 256);
        t.same(point.x.toFixed(4), 0.7347);
        t.same(point.y.toFixed(4), 0.5);

        // clamp y
        point = tr.projection.pointCoordinate(tr, 256, 512);
        t.same(point.x.toFixed(4), 0.5);
        t.same(point.y.toFixed(4), 0.9830);

        // Position should be always clamped to the surface of the globe sphere
        for (let i = 0; i < 5; i++) {
            point = tr.projection.pointCoordinate(tr, 512 + i * 50, 256);
            t.same(point.x.toFixed(4), 0.7347);
            t.same(point.y.toFixed(4), 0.5);
        }

        tr.center = {lng: 180, lat: 0};

        point = tr.projection.pointCoordinate(tr, 256, 256);
        t.same(point.x.toFixed(2), 1.0);
        t.same(point.y.toFixed(2), 0.5);

        point = tr.projection.pointCoordinate(tr, 0, 256);
        t.same(point.x.toFixed(4), 0.7653);
        t.same(point.y.toFixed(4), 0.5);

        // Expect x-coordinate not to wrap
        point = tr.projection.pointCoordinate(tr, 512, 256);
        t.same(point.x.toFixed(4), 1.2347);
        t.same(point.y.toFixed(4), 0.5);

        t.end();
    });

    t.test('coveringTiles', (t) => {
        const createConstantElevation = (elevation) => {
            return {
                isDataAvailableAtPoint(_) {
                    return true;
                },
                getAtPointOrZero(_) {
                    return elevation;
                },
                getForTilePoints(tileID, points) {
                    for (const p of points) {
                        p[2] = elevation;
                    }
                    return true;
                },
                getMinElevationBelowMSL: () => 0,
                exaggeration: () => 1
            };
        };

        const tr = new Transform();
        tr.resize(1118, 948);
        tr.setProjection({name: 'globe'});
        tr.elevation = createConstantElevation(0);

        const options = {
            minzoom: 0,
            maxzoom: 22,
            tileSize: 512,
        };

        t.test('tessellate fewer tiles near pole', (t) => {
            tr.zoom = 4.24;
            tr.pitch = 51.0;
            tr.center = new LngLat(-99.54, 76.72);

            t.deepEqual(tr.coveringTiles(options), [
                new OverscaledTileID(4, 0, 4, 3, 2),
                new OverscaledTileID(4, 0, 4, 4, 2),
                new OverscaledTileID(4, 0, 4, 3, 3),
                new OverscaledTileID(4, 0, 4, 2, 2),
                new OverscaledTileID(4, 0, 4, 4, 3),
                new OverscaledTileID(4, 0, 4, 2, 3),
                new OverscaledTileID(4, 0, 4, 5, 2),
                new OverscaledTileID(4, 0, 4, 1, 2),
                new OverscaledTileID(3, 0, 3, 1, 0),
                new OverscaledTileID(3, 0, 3, 2, 0),
                new OverscaledTileID(3, 0, 3, 0, 0),
                new OverscaledTileID(3, 0, 3, 3, 1),
                new OverscaledTileID(3, 0, 3, 3, 0),
                new OverscaledTileID(3, 0, 3, 4, 1),
                new OverscaledTileID(3, 0, 3, 4, 0),
                new OverscaledTileID(3, 0, 3, 5, 0),
                new OverscaledTileID(3, 0, 3, 6, 1),
                new OverscaledTileID(3, 0, 3, 6, 0),
                new OverscaledTileID(3, 0, 3, 7, 1),
                new OverscaledTileID(3, 0, 3, 7, 0)
            ]);
            t.end();
        });

        t.test('ideal tiles at high pitch', (t) => {
            tr.zoom = 5.1;
            tr.pitch = 51.0;
            tr.center = new LngLat(156.45, 20.15);

            t.deepEqual(tr.coveringTiles(options), [
                new OverscaledTileID(5, 0, 5, 29, 14),
                new OverscaledTileID(5, 0, 5, 30, 14),
                new OverscaledTileID(5, 0, 5, 29, 13),
                new OverscaledTileID(5, 0, 5, 30, 13),
                new OverscaledTileID(5, 0, 5, 29, 15),
                new OverscaledTileID(5, 0, 5, 28, 14),
                new OverscaledTileID(5, 0, 5, 30, 15),
                new OverscaledTileID(5, 0, 5, 28, 13),
                new OverscaledTileID(5, 0, 5, 31, 14),
                new OverscaledTileID(5, 0, 5, 29, 12),
                new OverscaledTileID(5, 0, 5, 31, 13),
                new OverscaledTileID(5, 0, 5, 30, 12),
                new OverscaledTileID(5, 0, 5, 28, 12),
                new OverscaledTileID(5, 0, 5, 31, 12),
                new OverscaledTileID(4, 0, 4, 13, 6),
                new OverscaledTileID(3, 0, 3, 7, 2),
                new OverscaledTileID(3, 0, 3, 6, 2),
                new OverscaledTileID(4, 0, 4, 0, 6),
                new OverscaledTileID(3, 0, 3, 0, 2),
            ]);
            t.end();
        });

        t.end();
    });

    t.test('getLatitudinalLod', (t) => {
        t.equal(0, getLatitudinalLod(0));
        t.equal(1, getLatitudinalLod(45.0));
        t.equal(1, getLatitudinalLod(-45.0));
        t.equal(2, getLatitudinalLod(MAX_MERCATOR_LATITUDE));
        t.equal(2, getLatitudinalLod(-MAX_MERCATOR_LATITUDE));
        t.equal(2, getLatitudinalLod(90.0));
        t.equal(2, getLatitudinalLod(-90.0));
        t.end();
    });

    t.end();
});
