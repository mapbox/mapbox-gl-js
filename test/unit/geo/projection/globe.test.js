import {test} from '../../../util/test.js';
import Transform from '../../../../src/geo/transform.js';
import LngLat from '../../../../src/geo/lng_lat.js';
import {OverscaledTileID} from '../../../../src/source/tile_id.js';

test('Globe', (t) => {
    t.test('pointCoordinate', (t) => {
        const tr = new Transform();
        tr.resize(100, 100);
        tr.zoom = 0;
        tr.setProjection({name: 'globe'});

        let point = tr.projection.pointCoordinate(tr, 50, 50);
        t.same(point.x.toFixed(2), 0.5);
        t.same(point.y.toFixed(2), 0.5);

        point = tr.projection.pointCoordinate(tr, 0, 50);
        t.same(point.x.toFixed(4), 0.3736);
        t.same(point.y.toFixed(4), 0.5);

        point = tr.projection.pointCoordinate(tr, 50, 0);
        t.same(point.x.toFixed(4), 0.5);
        t.same(point.y.toFixed(4), 0.3577);

        tr.center = {lng: 180, lat: 0};

        point = tr.projection.pointCoordinate(tr, 50, 50);
        t.same(point.x.toFixed(2), 1.0);
        t.same(point.y.toFixed(2), 0.5);

        point = tr.projection.pointCoordinate(tr, 0, 50);
        t.same(point.x.toFixed(4), 0.8736);
        t.same(point.y.toFixed(4), 0.5);

        // Expect x-coordinate not to wrap
        point = tr.projection.pointCoordinate(tr, 100, 50);
        t.same(point.x.toFixed(4), 1.1264);
        t.same(point.y.toFixed(4), 0.5);

        t.end();
    });

    t.test('coveringTiles', (t) => {
        const minZoom = 0;
        const maxZoom = 22;
        const minPitch = 0;
        const maxPitch = 85.0;

        const tr = new Transform(minZoom, maxZoom, minPitch, maxPitch);
        tr.resize(512, 512);
        tr.setProjection({name: 'globe'});

        const options = {
            minzoom: 0,
            maxzoom: 22,
            tileSize: 512,
        };

        t.test('calculate tile coverage at high tilt', (t) => {
            tr.zoom = 5.0;
            tr.pitch = 85.0;
            tr.center = new LngLat(74.37, 74.75);

            t.deepEqual(tr.coveringTiles(options), [
                new OverscaledTileID(5, 0, 5, 22, 6),
                new OverscaledTileID(5, 0, 5, 23, 6),
                new OverscaledTileID(4, 0, 4, 11, 2),
                new OverscaledTileID(4, 0, 4, 10, 2)
                
            ]);
            t.end();
        });

        t.test('calculate tile coverage near transition point', (t) => {
            tr.zoom = 5.99;
            tr.pitch = 0.0;
            tr.center = new LngLat(-107.017, 37.612);

            t.deepEqual(tr.coveringTiles(options), [
                new OverscaledTileID(5, 0, 5, 6, 12)
            ]);
            t.end();
        });

        t.test('calculate tile coverage near north pole', (t) => {
            tr.zoom = 4;
            tr.pitch = 45.0;
            tr.center = new LngLat(32.54, 67.36);

            t.deepEqual(tr.coveringTiles(options), [
                new OverscaledTileID(4, 0, 4, 9, 3),
                new OverscaledTileID(4, 0, 4, 9, 4),
                new OverscaledTileID(4, 0, 4, 8, 3),
                new OverscaledTileID(4, 0, 4, 8, 4),
                new OverscaledTileID(4, 0, 4, 10, 3),
                new OverscaledTileID(4, 0, 4, 10, 4),
                new OverscaledTileID(4, 0, 4, 9, 2),
                new OverscaledTileID(4, 0, 4, 8, 2),
                new OverscaledTileID(4, 0, 4, 10, 2),
                new OverscaledTileID(4, 0, 4, 7, 2),
                new OverscaledTileID(4, 0, 4, 9, 1),
                new OverscaledTileID(4, 0, 4, 11, 2),
                new OverscaledTileID(4, 0, 4, 8, 1),
                new OverscaledTileID(4, 0, 4, 10, 1),
                new OverscaledTileID(4, 0, 4, 7, 1),
                new OverscaledTileID(4, 0, 4, 11, 1)
            ]);
            t.end();
        });

        t.end();
    });

    t.end();
});
