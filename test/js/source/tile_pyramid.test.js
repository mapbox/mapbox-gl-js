'use strict';

var test = require('tap').test;
var TilePyramid = require('../../../js/source/tile_pyramid');
var TileCoord = require('../../../js/source/tile_coord');
var Transform = require('../../../js/geo/transform');
var LngLat = require('../../../js/geo/lng_lat');
var Coordinate = require('../../../js/geo/coordinate');
var util = require('../../../js/util/util');

test('TilePyramid#coveringTiles', function(t) {
    var pyramid = new TilePyramid({
        minzoom: 1,
        maxzoom: 10,
        tileSize: 512
    });

    var transform = new Transform();
    transform.resize(200, 200);

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

    pyramid.roundZoom = true;

    t.deepEqual(pyramid.coveringZoomLevel(transform), 13);

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

        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        pyramid.updateCacheSize(tr);
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

    t.end();
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

        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        pyramid.updateCacheSize(tr);

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

    t.end();
});

test('TilePyramid#update', function(t) {
    t.test('loads no tiles if used is false', function(t) {
        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 0;

        var pyramid = createPyramid({});
        pyramid.update(false, transform);

        t.deepEqual(pyramid.orderedIDs(), []);
        t.end();
    });

    t.test('loads covering tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var pyramid = createPyramid({});
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [new TileCoord(0, 0, 0).id]);
        t.end();
    });

    t.test('removes unused tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
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
        transform.resize(511, 511);
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
            new TileCoord(0, 0, 0).id,
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);
        t.end();
    });

    t.test('retains parent tiles for pending children (wrapped)', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;
        transform.center = new LngLat(360, 0);

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
            new TileCoord(0, 0, 0, 1).id,
            new TileCoord(1, 0, 0, 1).id,
            new TileCoord(1, 1, 0, 1).id,
            new TileCoord(1, 0, 1, 1).id,
            new TileCoord(1, 1, 1, 1).id
        ]);
        t.end();
    });

    t.test('includes partially covered tiles in rendered tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 2;

        var pyramid = createPyramid({
            load: function(tile) {
                tile.timeAdded = Infinity;
                tile.loaded = true;
            }
        });

        pyramid.update(true, transform, 100);
        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(2, 1, 1).id,
            new TileCoord(2, 2, 1).id,
            new TileCoord(2, 1, 2).id,
            new TileCoord(2, 2, 2).id
        ]);

        transform.zoom = 0;
        pyramid.update(true, transform, 100);

        t.deepEqual(pyramid.renderedIDs().length, 5);
        t.end();
    });

    t.test('retains a parent tile for fading even if a tile is partially covered by children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 0;

        var pyramid = createPyramid({
            load: function(tile) {
                tile.timeAdded = Infinity;
                tile.loaded = true;
            }
        });

        pyramid.update(true, transform, 100);

        transform.zoom = 2;
        pyramid.update(true, transform, 100);

        transform.zoom = 1;
        pyramid.update(true, transform, 100);

        t.equal(pyramid._coveredTiles[(new TileCoord(0, 0, 0).id)], true);
        t.end();
    });


    t.test('retains overscaled loaded children', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 16;
        transform.center = new LngLat(0, 0);


        var pyramid = createPyramid({
            reparseOverscaled: true,
            load: function(tile) {
                tile.loaded = tile.coord.z === 16;
            }
        });

        t.equal(pyramid.maxzoom, 14);

        pyramid.update(true, transform);
        t.deepEqual(pyramid.renderedIDs(), [
            new TileCoord(16, 8191, 8191, 0).id,
            new TileCoord(16, 8192, 8191, 0).id,
            new TileCoord(16, 8192, 8192, 0).id,
            new TileCoord(16, 8191, 8192, 0).id
        ]);

        transform.zoom = 15;
        pyramid.update(true, transform);

        t.deepEqual(pyramid.renderedIDs(), [
            new TileCoord(16, 8191, 8191, 0).id,
            new TileCoord(16, 8192, 8191, 0).id,
            new TileCoord(16, 8192, 8192, 0).id,
            new TileCoord(16, 8191, 8192, 0).id
        ]);
        t.end();

    });

    t.end();
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

    t.end();
});

test('TilePyramid#tilesIn', function (t) {
    t.test('regular tiles', function(t) {
        var transform = new Transform();
        transform.resize(511, 511);
        transform.zoom = 1;

        var pyramid = createPyramid({
            load: function(tile) {
                tile.loaded = true;
            }
        });

        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);

        var tiles = pyramid.tilesIn([
            new Coordinate(0.5, 0.25, 1),
            new Coordinate(1.5, 0.75, 1)
        ]);

        tiles.sort(function (a, b) { return a.tile.coord.x - b.tile.coord.x; });
        tiles.forEach(function (result) { delete result.tile.uid; });

        t.equal(tiles[0].tile.coord.id, 1);
        t.equal(tiles[0].tile.tileSize, 512);
        t.equal(tiles[0].scale, 1);
        t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

        t.equal(tiles[1].tile.coord.id, 33);
        t.equal(tiles[1].tile.tileSize, 512);
        t.equal(tiles[1].scale, 1);
        t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

        t.end();
    });

    t.test('reparsed overscaled tiles', function(t) {
        var pyramid = createPyramid({
            load: function(tile) { tile.loaded = true; },
            reparseOverscaled: true,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 2.0;
        pyramid.update(true, transform);

        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(2, 0, 0).id,
            new TileCoord(2, 1, 0).id,
            new TileCoord(2, 0, 1).id,
            new TileCoord(2, 1, 1).id
        ]);

        var tiles = pyramid.tilesIn([
            new Coordinate(0.5, 0.25, 1),
            new Coordinate(1.5, 0.75, 1)
        ]);

        tiles.sort(function (a, b) { return a.tile.coord.x - b.tile.coord.x; });
        tiles.forEach(function (result) { delete result.tile.uid; });

        t.equal(tiles[0].tile.coord.id, 2);
        t.equal(tiles[0].tile.tileSize, 1024);
        t.equal(tiles[0].scale, 1);
        t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

        t.equal(tiles[1].tile.coord.id, 34);
        t.equal(tiles[1].tile.tileSize, 1024);
        t.equal(tiles[1].scale, 1);
        t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

        t.end();
    });

    t.test('overscaled tiles', function(t) {
        var pyramid = createPyramid({
            load: function(tile) { tile.loaded = true; },
            reparseOverscaled: false,
            minzoom: 1,
            maxzoom: 1,
            tileSize: 512
        });

        var transform = new Transform();
        transform.resize(512, 512);
        transform.zoom = 2.0;
        pyramid.update(true, transform);


        t.deepEqual(pyramid.orderedIDs(), [
            new TileCoord(1, 0, 0).id,
            new TileCoord(1, 1, 0).id,
            new TileCoord(1, 0, 1).id,
            new TileCoord(1, 1, 1).id
        ]);

        var tiles = pyramid.tilesIn([
            new Coordinate(0.5, 0.25, 1),
            new Coordinate(1.5, 0.75, 1)
        ]);

        tiles.sort(function (a, b) { return a.tile.coord.x - b.tile.coord.x; });
        tiles.forEach(function (result) { delete result.tile.uid; });

        t.equal(tiles[0].tile.coord.id, 1);
        t.equal(tiles[0].tile.tileSize, 512);
        t.equal(tiles[0].scale, 2);
        t.deepEqual(tiles[0].queryGeometry, [[{x: 4096, y: 2048}, {x:12288, y: 6144}]]);

        t.equal(tiles[1].tile.coord.id, 33);
        t.equal(tiles[1].tile.tileSize, 512);
        t.equal(tiles[1].scale, 2);
        t.deepEqual(tiles[1].queryGeometry, [[{x: -4096, y: 2048}, {x: 4096, y: 6144}]]);

        t.end();
    });

    t.end();
});

test('TilePyramid#loaded (no errors)', function (t) {
    var pyramid = createPyramid({
        load: function(tile) {
            tile.loaded = true;
        }
    });

    var coord = new TileCoord(0, 0, 0);
    pyramid.addTile(coord);

    t.ok(pyramid.loaded());
    t.end();
});

test('TilePyramid#loaded (with errors)', function (t) {
    var pyramid = createPyramid({
        load: function(tile) {
            tile.errored = true;
        }
    });

    var coord = new TileCoord(0, 0, 0);
    pyramid.addTile(coord);

    t.ok(pyramid.loaded());
    t.end();
});

test('TilePyramid#orderedIDs (ascending order by zoom level)', function(t) {
    var ids = [
        new TileCoord(0, 0, 0),
        new TileCoord(3, 0, 0),
        new TileCoord(1, 0, 0),
        new TileCoord(2, 0, 0)
    ];

    var pyramid = createPyramid({});
    for (var i = 0; i < ids.length; i++) {
        pyramid._tiles[ids[i].id] = {};
    }
    var orderedIDs = pyramid.orderedIDs();
    t.deepEqual(orderedIDs, [
        new TileCoord(0, 0, 0).id,
        new TileCoord(1, 0, 0).id,
        new TileCoord(2, 0, 0).id,
        new TileCoord(3, 0, 0).id
    ]);
    t.end();
});


test('TilePyramid#findLoadedParent', function(t) {

    t.test('adds from previously used tiles (pyramid._tiles)', function(t) {
        var pyramid = createPyramid({});
        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        pyramid.updateCacheSize(tr);

        var tile = {
            coord: new TileCoord(1, 0, 0),
            loaded: true
        };

        pyramid._tiles[tile.coord.id] = tile;

        var retain = {};
        var expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(pyramid.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.deepEqual(pyramid.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
        t.end();
    });

    t.test('adds from cache', function(t) {
        var pyramid = createPyramid({});
        var tr = new Transform();
        tr.width = 512;
        tr.height = 512;
        pyramid.updateCacheSize(tr);

        var tile = {
            coord: new TileCoord(1, 0, 0),
            loaded: true
        };

        pyramid._cache.add(tile.coord.id, tile);

        var retain = {};
        var expectedRetain = {};
        expectedRetain[tile.coord.id] = true;

        t.equal(pyramid.findLoadedParent(new TileCoord(2, 3, 3), 0, retain), undefined);
        t.equal(pyramid.findLoadedParent(new TileCoord(2, 0, 0), 0, retain), tile);
        t.deepEqual(retain, expectedRetain);
        t.equal(pyramid._cache.order.length, 0);
        t.equal(pyramid._tiles[tile.coord.id], tile);

        t.end();
    });

    t.end();
});
