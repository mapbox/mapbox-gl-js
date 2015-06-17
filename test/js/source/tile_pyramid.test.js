'use strict';

var test = require('prova');
var TilePyramid = require('../../../js/source/tile_pyramid');
var TileCoord = require('../../../js/source/tile_coord');
var Transform = require('../../../js/geo/transform');
var LatLng = require('../../../js/geo/lat_lng');
var util = require('../../../js/util/util');

test('TilePyramid#coveringTiles', function(t) {
    var pyramid = new TilePyramid({
        minzoom: 1,
        maxzoom: 10,
        tileSize: 512
    });

    var transform = new Transform();

    transform.width = 200;
    transform.height = 200;

    transform.zoom = 0;
    t.deepEqual(pyramid.coveringTiles(transform), []);

    transform.zoom = 1;
    t.deepEqual(pyramid.coveringTiles(transform), ['1', '33', '65', '97'].map(TileCoord.fromID));

    transform.zoom = 2.4;
    t.deepEqual(pyramid.coveringTiles(transform), ['162', '194', '290', '322'].map(TileCoord.fromID));

    transform.zoom = 10;
    t.deepEqual(pyramid.coveringTiles(transform), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

    transform.zoom = 11;
    t.deepEqual(pyramid.coveringTiles(transform), ['16760810', '16760842', '16793578', '16793610'].map(TileCoord.fromID));

    t.end();
});

test('TilePyramid#coveringZoomLevel', function(t) {
    var pyramid = new TilePyramid({
        minzoom: 1,
        maxzoom: 10,
        tileSize: 512
    });

    var transform = new Transform();

    transform.zoom = 0;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 0);

    transform.zoom = 0.1;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 0);

    transform.zoom = 1;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 1);

    transform.zoom = 2.4;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 2);

    transform.zoom = 10;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 10);

    transform.zoom = 11;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 11);

    transform.zoom = 11.5;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 11);

    pyramid.tileSize = 256;

    transform.zoom = 0;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 1);

    transform.zoom = 0.1;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 1);

    transform.zoom = 1;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 2);

    transform.zoom = 2.4;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 3);

    transform.zoom = 10;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 11);

    transform.zoom = 11;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 12);

    transform.zoom = 11.5;
    t.deepEqual(pyramid.coveringZoomLevel(transform), 12);

    t.end();
});

function createPyramid(options) {
    return new TilePyramid(util.extend({
        tileSize: 512,
        minzoom: 0,
        maxzoom: 14,
        load: function() {},
        abort: function() {},
        unload: function() {},
        add: function() {},
        remove: function() {}
    }, options));
}

test('TilePyramid#addTile', function(t) {
    t.test('loads tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var pyramid = createPyramid({
            load: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        pyramid.addTile(coord);
    });

    t.test('adds tile when uncached', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var pyramid = createPyramid({
            add: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 1);
                t.end();
            }
        });
        pyramid.addTile(coord);
    });

    t.test('uses cached tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            load = 0,
            add = 0;

        var pyramid = createPyramid({
            load: function(tile) { tile.loaded = true; load++; },
            add: function() { add++; }
        });

        pyramid.addTile(coord);
        pyramid.removeTile(coord.id);
        pyramid.addTile(coord);

        t.equal(load, 1);
        t.equal(add, 2);

        t.end();
    });

    t.test('reuses wrapped tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            load = 0,
            add = 0;

        var pyramid = createPyramid({
            load: function(tile) { tile.loaded = true; load++; },
            add: function() { add++; }
        });

        var t1 = pyramid.addTile(coord);
        var t2 = pyramid.addTile(new TileCoord(0, 0, 0, 1));

        t.equal(load, 1);
        t.equal(add, 2);
        t.equal(t1, t2);

        t.end();
    });
});

test('TilePyramid#removeTile', function(t) {
    t.test('removes tile', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var pyramid = createPyramid({
            remove: function(tile) {
                t.deepEqual(tile.coord, coord);
                t.equal(tile.uses, 0);
                t.end();
            }
        });
        pyramid.addTile(coord);
        pyramid.removeTile(coord.id);
    });

    t.test('caches (does not unload) loaded tile', function(t) {
        var coord = new TileCoord(0, 0, 0);
        var pyramid = createPyramid({
            load: function(tile) {
                tile.loaded = true;
            },
            unload: function() {
                t.fail();
            }
        });

        pyramid.addTile(coord);
        pyramid.removeTile(coord.id);

        t.end();
    });

    t.test('aborts and unloads unfinished tile', function(t) {
        var coord = new TileCoord(0, 0, 0),
            abort = 0,
            unload = 0;

        var pyramid = createPyramid({
            abort: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unload: function(tile) {
                t.deepEqual(tile.coord, coord);
                unload++;
            }
        });

        pyramid.addTile(coord);
        pyramid.removeTile(coord.id);

        t.equal(abort, 1);
        t.equal(unload, 1);

        t.end();
    });
});

test('TilePyramid#update', function(t) {
    t.test('loads no tiles if used is false', function(t) {
        var transform = new Transform();
        transform.width = 512;
        transform.height = 512;
        transform.zoom = 0;

        var pyramid = createPyramid({});
        pyramid.update(false, transform);

        t.deepEqual(pyramid.orderedIDs(), []);
        t.end();
    });

    t.test('loads covering tiles', function(t) {
        var transform = new Transform();
        transform.width = 511;
        transform.height = 511;
        transform.zoom = 0;

        var pyramid = createPyramid({});
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [new TileCoord(0, 0, 0).id]);
        t.end();
    });

    t.test('removes unused tiles', function(t) {
        var transform = new Transform();
        transform.width = 511;
        transform.height = 511;
        transform.zoom = 0;

        var pyramid = createPyramid({
            load: function(tile) {
                tile.loaded = true;
            }
        });

        pyramid.update(true, transform);
        t.deepEqual(pyramid.orderedIDs(), [new TileCoord(0, 0, 0).id]);

        transform.zoom = 1;
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);
        t.end();
    });

    t.test('retains parent tiles for pending children', function(t) {
        var transform = new Transform();
        transform.width = 511;
        transform.height = 511;
        transform.zoom = 0;

        var pyramid = createPyramid({
            load: function(tile) {
                tile.loaded = (tile.coord.id === new TileCoord(0, 0, 0).id);
            }
        });

        pyramid.update(true, transform);
        t.deepEqual(pyramid.orderedIDs(), [new TileCoord(0, 0, 0).id]);

        transform.zoom = 1;
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id,
            new TileCoord(0, 0, 0).id
        ]);
        t.end();
    });

    t.test('retains parent tiles for pending children (wrapped)', function(t) {
        var transform = new Transform();
        transform.width = 511;
        transform.height = 511;
        transform.zoom = 0;
        transform.center = new LatLng(0, 360);

        var pyramid = createPyramid({
            load: function(tile) {
                tile.loaded = (tile.coord.id === new TileCoord(0, 0, 0).id);
            }
        });

        pyramid.update(true, transform);
        t.deepEqual(pyramid.orderedIDs(), [new TileCoord(0, 0, 0, 1).id]);

        transform.zoom = 1;
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(1, 0, 0, 1).id,
            new TileCoord(1, 1, 0, 1).id,
            new TileCoord(1, 0, 1, 1).id,
            new TileCoord(1, 1, 1, 1).id,
            new TileCoord(0, 0, 0, 1).id
        ]);
        t.end();
    });
});

test('TilePyramid#clearTiles', function(t) {
    t.test('unloads tiles', function(t) {
        var coord = new TileCoord(0, 0, 0),
            abort = 0,
            unload = 0;

        var pyramid = createPyramid({
            abort: function(tile) {
                t.deepEqual(tile.coord, coord);
                abort++;
            },
            unload: function(tile) {
                t.deepEqual(tile.coord, coord);
                unload++;
            }
        });

        pyramid.addTile(coord);
        pyramid.clearTiles();

        t.equal(abort, 1);
        t.equal(unload, 1);

        t.end();
    });
});
