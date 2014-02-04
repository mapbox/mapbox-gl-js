'use strict';

var Coordinate = require('../util/coordinate.js'),
    util = require('../util/util.js'),
    evented = require('../lib/evented.js'),
    Tile = require('./tile.js'),
    RasterTile = require('./rastertile.js');


var Layer = module.exports = function(config, map) {
    this.map = map;
    this.painter = map.painter;

    this.tiles = {};

    this.Tile = config.type === 'raster' ? RasterTile : Tile;
    this.type = config.type;

    this.zooms = config.zooms || [0];
    this.urls = config.urls || [];
    this.minTileZoom = this.zooms[0];
    this.maxTileZoom = this.zooms[this.zooms.length - 1];
    this.id = config.id;

    this.loadNewTiles = true;
    this.enabled = config.enabled === false ? false : true;
};

evented(Layer);

util.extend(Layer.prototype, {

    update: function() {
        if (!this.enabled) return;
        this._updateTiles();
    },

    render: function(layers) {
        // Iteratively paint every tile.
        if (!this.enabled) return;
        var order = Object.keys(this.tiles);
        order.sort(this._z_order);
        for (var i = 0; i < order.length; i++) {
            var id = order[i];
            var tile = this.tiles[id];
            if (tile.loaded) {
                this._renderTile(tile, id, layers);
            }
        }
    },

    stats: function() {
        var stats = {};
        var tiles = util.unique(util.values(this.tiles));
        for (var i = 0; i < tiles.length; i++) {
            var tile = tiles[i];
            if (tile.stats) {
                this._mergeStats(stats, tile.stats);
            }
        }

        return stats;
    },

    featuresAt: function(x, y, params, callback) {
        var order = Object.keys(this.tiles);
        order.sort(this._z_order);
        for (var i = 0; i < order.length; i++) {
            var id = order[i];
            var tile = this.tiles[id];
            var pos = tile.positionAt(id, x, y);

            if (pos.x >= 0 && pos.x < 4096 && pos.y >= 0 && pos.y < 4096) {
                // The click is within the viewport. There is only ever one tile in
                // a layer that has this property.
                return tile.featuresAt(pos, params, callback);
            }
        }

        callback(null, []);
    },

    _coveringZoomLevel: function(zoom) {
        for (var i = this.zooms.length - 1; i >= 0; i--) {
            if (this.zooms[i] <= zoom) {
                var z = this.zooms[i];
                if (this.type === 'raster') {
                    z += (window.devicePixelRatio > 1) ? 2 : 1;
                    if (this.zooms[i+1]) {
                        var diff = this.zooms[i+1] - this.zooms[i];
                        z += Math.round((this.map.transform.z % diff) / diff) * diff;
                    }
                }
                return z;
            }
        }
        return 0;
    },

    _parentZoomLevel: function(zoom) {
        for (var i = this.zooms.length - 1; i >= 0; i--) {
            if (this.zooms[i] < zoom) {
                return this.zooms[i];
            }
        }
        return null;
    },

    _childZoomLevel: function(zoom) {
        for (var i = 0; i < this.zooms.length; i++) {
            if (this.zooms[i] > zoom) {
                return this.zooms[i];
            }
        }
        return null;
    },

    _getPanTile: function(zoom) {
        var panTileZoom = this._coveringZoomLevel(Math.max(this.minTileZoom, zoom - 4)), // allow 10x overzooming
            coord = Coordinate.ifloor(Coordinate.zoomTo(
                this.map.transform.locationCoordinate(this.map.transform), panTileZoom));
        return Tile.toID(coord.zoom, coord.column, coord.row);
    },

    _getCoveringTiles: function() {
	var z = this._coveringZoomLevel(this.map.transform.zoom),
	    tiles = 1 << z,
	    tileCenter = Coordinate.zoomTo(this.map.transform.locationCoordinate(this.map.transform), z);

        var points = [
            this.map.transform.pointCoordinate(tileCenter, {x:0, y:0}),
            this.map.transform.pointCoordinate(tileCenter, {x:this.map.transform.width, y:0}),
            this.map.transform.pointCoordinate(tileCenter, {x:this.map.transform.width, y:this.map.transform.height}),
            this.map.transform.pointCoordinate(tileCenter, {x:0, y:this.map.transform.height})
        ], t = {};

        points.forEach(function(p) {
            Coordinate.izoomTo(p, z);
        });

        // Divide the screen up in two triangles and scan each of them:
        // +---/
        // | / |
        // /---+
        this._scanTriangle(points[0], points[1], points[2], 0, tiles, scanLine);
        this._scanTriangle(points[2], points[3], points[0], 0, tiles, scanLine);

        return Object.keys(t).sort(fromCenter);

        function fromCenter(a, b) {
            var ad = Math.abs(a.x - tileCenter.column) +
                    Math.abs(a.y - tileCenter.row),
                bd = Math.abs(b.x - tileCenter.column) +
                    Math.abs(b.y - tileCenter.row);

            return ad - bd;
        }

        function scanLine(x0, x1, y) {
            var x, wx;
            if (y >= 0 && y <= tiles) {
                for (x = x0; x < x1; x++) {
                    wx = (x + tiles) % tiles;
                    t[Tile.toID(z, wx, y, Math.floor(x/tiles))] = {x: wx, y: y};
                }
            }
        }
    },

    // Given a tile of data, its id, and a style layers, render the tile to the canvas
    _renderTile: function(tile, id, layers) {
        var pos = Tile.fromID(id);
        var z = pos.z, x = pos.x, y = pos.y, w = pos.w;
        x += w * (1 << z);

        this.painter.viewport(z, x, y, this.map.transform, this.map.transform.size, this.pixelRatio);

	this.painter[this.type === 'raster' ? 'drawRaster' : 'draw'](tile, this.map.style, layers, {
            z: z, x: x, y: y,
            debug: this.map.debug,
            antialiasing: this.map.antialiasing,
            vertices: this.map.vertices,
            rotating: this.map.rotating,
            zooming: this.map.zooming
        });
    },

    // Recursively find children of the given tile (up to maxCoveringZoom) that are already loaded;
    // adds found tiles to retain object; returns true if children completely cover the tile

    _findLoadedChildren: function(id, maxCoveringZoom, retain) {
        var complete = true;
        var z = Tile.fromID(id).z;
        var ids = Tile.children(id);
        for (var i = 0; i < ids.length; i++) {
            if (this.tiles[ids[i]] && this.tiles[ids[i]].loaded) {
                retain[ids[i]] = true;
            } else {
                complete = false;
                if (z < maxCoveringZoom) {
                    // Go further down the hierarchy to find more unloaded children.
                    this._findLoadedChildren(ids[i], maxCoveringZoom, retain);
                }
            }
        }
        return complete;
    },

    // Find a loaded parent of the given tile (up to minCoveringZoom);
    // adds the found tile to retain object and returns true if a parent was found

    _findLoadedParent: function(id, minCoveringZoom, retain) {
        for (var z = Tile.fromID(id).z; z >= minCoveringZoom; z--) {
            id = Tile.parent(id);
            if (this.tiles[id] && this.tiles[id].loaded) {
                retain[id] = true;
                return true;
            }
        }
        return false;
    },

    // Removes tiles that are outside the viewport and adds new tiles that are inside the viewport.
    _updateTiles: function() {
        if (!this.map.loadNewTiles) {
            return;
        }

        // var map = this;
        var zoom = this.map.transform.zoom;
        var required = this._getCoveringTiles();
        var panTile = this._getPanTile(zoom);
        var i;
        var id;

        // Determine the overzooming/underzooming amounts.
        var minCoveringZoom = Math.max(this.minTileZoom, zoom - 10);
        var maxCoveringZoom = this.minTileZoom;
        while (maxCoveringZoom < zoom + 1) {
            var level = this._childZoomLevel(maxCoveringZoom);
            if (level === null) break;
            else maxCoveringZoom = level;
        }

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        var retain = {};

        // Add existing child/parent tiles if the actual tile is not yet loaded
        for (i = 0; i < required.length; i++) {
            id = +required[i];
            retain[id] = true;
            var tile = this._addTile(id);

            if (!tile.loaded) {
                // The tile we require is not yet loaded. Try to find a parent or
                // child tile that we already have.

                // First, try to find existing child tiles that completely cover the
                // missing tile.
                var complete = this._findLoadedChildren(id, maxCoveringZoom, retain);

                // Then, if there are no complete child tiles, try to find existing
                // parent tiles that completely cover the missing tile.
                if (!complete) {
                    this._findLoadedParent(id, minCoveringZoom, retain);
                }
            }
        }

        if (!retain[panTile]) {
            retain[panTile] = true;
            this._addTile(panTile);
        }

        // Remove the tiles we don't need anymore.
        var remove = util.keysDifference(this.tiles, retain);
        for (i = 0; i < remove.length; i++) {
            id = +remove[i];
            this._removeTile(id);
        }
    },

    _loadTile: function(id) {
        var layer = this;
        var map = this.map,
            pos = Tile.fromID(id),
            tile;

        if (pos.w === 0) {
            // console.time('loading ' + pos.z + '/' + pos.x + '/' + pos.y);
            tile = this.tiles[id] = new this.Tile(map, Tile.url(id, this.urls), pos.z, tileComplete);
        } else {
            var wrapped = Tile.toID(pos.z, pos.x, pos.y, 0);
            tile = this.tiles[id] = this.tiles[wrapped] || this._addTile(wrapped);
            tile.uses++;
        }

        function tileComplete(err) {
            // console.timeEnd('loading ' + pos.z + '/' + pos.x + '/' + pos.y);
            if (err) {
                console.warn('failed to load tile %d/%d/%d: %s', pos.z, pos.x, pos.y, err.stack || err);
            } else {
                layer.fire('tile.load', tile);
                map.update();
            }
        }

        return tile;
    },

    // Adds a vector tile to the map. It will trigger a rerender of the map and will
    // be part in all future renders of the map. The map object will handle copying
    // the tile data to the GPU if it is required to paint the current viewport.
    _addTile: function(id) {
        var tile = this.tiles[id];

        if (!tile) {
            tile = this._loadTile(id);
            this.fire('tile.add', tile);
        }

        this.map.addTile(tile);
        return tile;
    },

    _removeTile: function(id) {
        var tile = this.tiles[id];
        if (tile) {
            tile.uses--;
            delete this.tiles[id];

            if (tile.uses <= 0) {
                if (!tile.loaded) {
                    tile.abort();
                }

                this.map.removeTile(tile);
                tile.remove();

                this.fire('tile.remove', tile);
            }
        }
    },

    _mergeStats: function(a, b) {
        for (var key in b) {
            if (typeof b[key] === 'object') {
                this._mergeStats(a[key] || (a[key] = {}), b[key]);
            } else {
                a[key] = (a[key] || 0) + b[key];
            }
        }
    },

    // Taken from polymaps src/Layer.js
    // https://github.com/simplegeo/polymaps/blob/master/src/Layer.js#L333-L383

    // scan-line conversion
    _scanTriangle: function(a, b, c, ymin, ymax, scanLine) {
        var ab = this._edge(a, b),
            bc = this._edge(b, c),
            ca = this._edge(c, a);

        var t;

        // sort edges by y-length
        if (ab.dy > bc.dy) { t = ab; ab = bc; bc = t; }
        if (ab.dy > ca.dy) { t = ab; ab = ca; ca = t; }
        if (bc.dy > ca.dy) { t = bc; bc = ca; ca = t; }

        // scan span! scan span!
        if (ab.dy) this._scanSpans(ca, ab, ymin, ymax, scanLine);
        if (bc.dy) this._scanSpans(ca, bc, ymin, ymax, scanLine);
    },

    // scan-line conversion
    _edge: function(a, b) {
        if (a.row > b.row) { var t = a; a = b; b = t; }
        return {
            x0: a.column,
            y0: a.row,
            x1: b.column,
            y1: b.row,
            dx: b.column - a.column,
            dy: b.row - a.row
        };
    },

    // scan-line conversion
    _scanSpans: function(e0, e1, ymin, ymax, scanLine) {
        var y0 = Math.max(ymin, Math.floor(e1.y0)),
            y1 = Math.min(ymax, Math.ceil(e1.y1));

        // sort edges by x-coordinate
        if ((e0.x0 == e1.x0 && e0.y0 == e1.y0) ?
            (e0.x0 + e1.dy / e0.dy * e0.dx < e1.x1) :
            (e0.x1 - e1.dy / e0.dy * e0.dx < e1.x0)) {
            var t = e0; e0 = e1; e1 = t;
        }

        // scan lines!
        var m0 = e0.dx / e0.dy,
            m1 = e1.dx / e1.dy,
            d0 = e0.dx > 0, // use y + 1 to compute x0
            d1 = e1.dx < 0; // use y + 1 to compute x1
        for (var y = y0; y < y1; y++) {
            var x0 = m0 * Math.max(0, Math.min(e0.dy, y + d0 - e0.y0)) + e0.x0,
                x1 = m1 * Math.max(0, Math.min(e1.dy, y + d1 - e1.y0)) + e1.x0;
            scanLine(Math.floor(x1), Math.ceil(x0), y);
        }
    },

    _z_order: function(a, b) {
        return (b % 32) - (a % 32);
    }
});
