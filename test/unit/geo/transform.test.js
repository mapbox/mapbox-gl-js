import { test } from 'mapbox-gl-js-test';
import Point from '@mapbox/point-geometry';
import Transform from '../../../src/geo/transform';
import LngLat from '../../../src/geo/lng_lat';
import { OverscaledTileID, CanonicalTileID } from '../../../src/source/tile_id';
import fixed from 'mapbox-gl-js-test/fixed';
const fixedLngLat = fixed.LngLat;
const fixedCoord = fixed.Coord;

test('transform', (t) => {

    t.test('creates a transform', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        t.equal(transform.unmodified, true);
        t.equal(transform.tileSize, 512, 'tileSize');
        t.equal(transform.worldSize, 512, 'worldSize');
        t.equal(transform.width, 500, 'width');
        t.equal(transform.minZoom, 0, 'minZoom');
        t.equal(transform.bearing, 0, 'bearing');
        t.equal(transform.bearing = 1, 1, 'set bearing');
        t.equal(transform.bearing, 1, 'bearing');
        t.equal(transform.bearing = 0, 0, 'set bearing');
        t.equal(transform.unmodified, false);
        t.equal(transform.minZoom = 10, 10);
        t.equal(transform.maxZoom = 10, 10);
        t.equal(transform.minZoom, 10);
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        t.equal(transform.maxZoom, 10);
        t.equal(transform.size.equals(new Point(500, 500)), true);
        t.equal(transform.centerPoint.equals(new Point(250, 250)), true);
        t.equal(transform.scaleZoom(0), -Infinity);
        t.equal(transform.scaleZoom(10), 3.3219280948873626);
        t.deepEqual(transform.point, new Point(262144, 262144));
        t.equal(transform.x, 262144);
        t.equal(transform.y, 262144);
        t.equal(transform.height, 500);
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(250, 250))), { lng: 0, lat: 0 });
        t.deepEqual(fixedCoord(transform.pointCoordinate(new Point(250, 250))), { column: 512, row: 512, zoom: 10 });
        t.deepEqual(transform.locationPoint(new LngLat(0, 0)), { x: 250, y: 250 });
        t.deepEqual(transform.locationCoordinate(new LngLat(0, 0)), { column: 512, row: 512, zoom: 10 });
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
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        transform.setLocationAtPoint({ lng: 13, lat: 10 }, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), { lng: 13, lat: 10 });
        t.end();
    });

    t.test('setLocationAt tilted', (t) => {
        const transform = new Transform();
        transform.resize(500, 500);
        transform.zoom = 4;
        transform.pitch = 50;
        t.deepEqual(transform.center, { lng: 0, lat: 0 });
        transform.setLocationAtPoint({ lng: 13, lat: 10 }, new Point(15, 45));
        t.deepEqual(fixedLngLat(transform.pointLocation(new Point(15, 45))), { lng: 13, lat: 10 });
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
        t.same(transform.center, new LngLat(0, -0.006358305286099153));

        transform.zoom = 10;
        transform.center = new LngLat(-50, -30);
        t.same(transform.center, new LngLat(-4.828338623046875, -4.828969771321582));

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
        transform.center = { lng: -0.01, lat: 0.01 };

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
        transform.center = { lng: -170.01, lat: 0.01 };

        let unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        t.equal(unwrappedCoords.length, 2);

        //getVisibleUnwrappedCoordinates should honor _renderWorldCopies
        transform._renderWorldCopies = false;
        unwrappedCoords = transform.getVisibleUnwrappedCoordinates(new CanonicalTileID(0, 0, 0));
        t.equal(unwrappedCoords.length, 1);

        t.end();
    });

    t.end();
});
