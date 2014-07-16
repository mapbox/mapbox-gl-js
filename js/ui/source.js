'use strict';

var util = require('../util/util.js'),
    ajax = require('../util/ajax.js'),
    Evented = require('../util/evented.js'),
    Cache = require('../util/mrucache.js'),
    Tile = require('./tile.js'),
    VectorTile = require('./vectortile'),
    RasterTile = require('./rastertile.js'),
    Point = require('point-geometry');

var protocols = {
    "mapbox": function(url, callback) {
        var id = url.split('://')[1];
        ajax.getJSON("https://a.tiles.mapbox.com/v4/" + id + ".json?secure=1&access_token=" + window.mapboxgl.accessToken, callback);
    }
};

var Source = module.exports = function(options) {
    this.tiles = {};
    this.enabled = false;
    this.type = options.type;
    if (this.type === 'vector' && options.tileSize && options.tileSize !== 512) {
        throw new Error('vector tile sources must have a tileSize of 512');
    }
    this.Tile = this.type === 'vector' ? VectorTile : RasterTile;
    this.options = util.extend(Object.create(this.options), options);
    this.cache = new Cache(this.options.cacheSize, function(tile) {
        tile.remove();
    });

    var protocol = options.url.split(':')[0];
    protocols[protocol](options.url, function(err, tileJSON) {
        if (err) throw err;
        this.tileJSON = tileJSON;
        this.loadNewTiles = true;
        this.enabled = true;
    }.bind(this));
};

Source.prototype = Object.create(Evented);

util.extend(Source.prototype, {
    options: {
        tileSize: 512,
        cacheSize: 20
    },

    onAdd: function(map) {
        this.map = map;
        this.painter = map.painter;
    },

    load: function() {
        for (var t in this.tiles) {
            this.tiles[t]._load();
        }
    },

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
            if (tile.loaded && !this.coveredTiles[id]) {
                this._renderTile(tile, id, layers);
            }
        }
    },

    featuresAt: function(point, params, callback) {
        point = Point.convert(point);

        var order = Object.keys(this.tiles);
        order.sort(this._z_order);
        for (var i = 0; i < order.length; i++) {
            var id = order[i];
            var tile = this.tiles[id];
            var pos = tile.positionAt(id, point);

            if (pos && pos.x >= 0 && pos.x < 4096 && pos.y >= 0 && pos.y < 4096) {
                // The click is within the viewport. There is only ever one tile in
                // a layer that has this property.
                return tile.featuresAt(pos, params, callback);
            }
        }

        callback(null, []);
    },

    // get the zoom level adjusted for the difference in map and source tilesizes
    _getZoom: function() {
        var zOffset = Math.log(this.map.tileSize/this.options.tileSize) / Math.LN2;
        return this.map.transform.zoom + zOffset;
    },

    _coveringZoomLevel: function(zoom) {
        for (var z = this.tileJSON.maxzoom; z >= this.tileJSON.minzoom; z--) {
            if (z <= zoom) {
                if (this.type === 'raster') {
                    // allow underscaling by rounding to the nearest zoom level
                    if (z < this.tileJSON.maxzoom) {
                        z += Math.round(zoom - z);
                    }
                }
                return z;
            }
        }
        return 0;
    },

    _childZoomLevel: function(zoom) {
        zoom = Math.max(this.tileJSON.minzoom, zoom + 1);
        return zoom <= this.tileJSON.maxzoom ? zoom : null;
    },

    _getCoveringTiles: function(zoom) {
        if (zoom === undefined) zoom = this._getZoom();
        var z = this._coveringZoomLevel(zoom),
            tiles = 1 << z,
            tr = this.map.transform,
            tileCenter = util.zoomTo(tr.locationCoordinate(tr.center), z);

        var points = [
            util.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: 0}), z),
            util.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: 0}), z),
            util.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: tr.height}), z),
            util.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: tr.height}), z)
        ], t = {};

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

        tile.calculateMatrices(z, x, y, this.map.transform, this.painter);

        this.painter.draw(tile, this.map.style, layers, {
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
        if (!this.map.loadNewTiles || !this.loadNewTiles || !this.map.style.sources[this.id]) return;

        var zoom = Math.floor(this._getZoom());
        var required = this._getCoveringTiles().sort(this._centerOut.bind(this));
        var i;
        var id;
        var complete;
        var tile;

        // Determine the overzooming/underzooming amounts.
        var minCoveringZoom = Math.max(this.tileJSON.minzoom, zoom - 10);
        var maxCoveringZoom = this.tileJSON.minzoom;
        while (maxCoveringZoom < zoom + 1) {
            var level = this._childZoomLevel(maxCoveringZoom);
            if (level === null) break;
            else maxCoveringZoom = level;
        }

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        var retain = {};
        // Covered is a list of retained tiles who's areas are full covered by other,
        // better, retained tiles. They are not drawn separately.
        this.coveredTiles = {};

        var fullyComplete = true;

        // Add existing child/parent tiles if the actual tile is not yet loaded
        for (i = 0; i < required.length; i++) {
            id = +required[i];
            retain[id] = true;
            tile = this._addTile(id);

            if (!tile.loaded) {
                // The tile we require is not yet loaded. Try to find a parent or
                // child tile that we already have.

                // First, try to find existing child tiles that completely cover the
                // missing tile.
                complete = this._findLoadedChildren(id, maxCoveringZoom, retain);

                // Then, if there are no complete child tiles, try to find existing
                // parent tiles that completely cover the missing tile.
                if (!complete) {
                    complete = this._findLoadedParent(id, minCoveringZoom, retain);
                }

                // The unloaded tile's area is not completely covered loaded tiles
                if (!complete) {
                    fullyComplete = false;
                }
            }
        }

        var now = new Date().getTime();
        var fadeDuration = this.type === 'raster' ? this.map.style.rasterFadeDuration : 0;

        for (id in retain) {
            tile = this.tiles[id];
            if (tile && tile.timeAdded > now - fadeDuration) {
                // This tile is still fading in. Find tiles to cross-fade with it.

                complete = this._findLoadedChildren(id, maxCoveringZoom, retain);

                if (complete) {
                    this.coveredTiles[id] = true;
                } else {
                    this._findLoadedParent(id, minCoveringZoom, retain);
                }
            }
        }

        for (id in this.coveredTiles) retain[id] = true;

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
            var url = Tile.url(id, this.tileJSON.tiles);
            tile = this.tiles[id] = new this.Tile(id, this, url, tileComplete);
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
                layer.fire('tile.load', {tile: tile});
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
            tile = this.cache.get(id);
            if (tile) {
                this.tiles[id] = tile;
            }
        }

        if (!tile) {
            tile = this._loadTile(id);
            this.fire('tile.add', {tile: tile});
        }

        if (tile && tile.loaded && !tile.timeAdded) {
            tile.timeAdded = new Date().getTime();
            this.map.animationLoop.set(this.map.style.rasterFadeDuration);
        }

        return tile;
    },

    _removeTile: function(id) {
        var tile = this.tiles[id];
        if (tile) {
            tile.uses--;
            delete this.tiles[id];

            if (tile.uses <= 0) {
                delete tile.timeAdded;
                if (!tile.loaded) {
                    tile.abort();
                    tile.remove();
                } else {
                    this.cache.add(id, tile);
                }

                this.fire('tile.remove', {tile: tile});
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
    },

    _centerOut: function(a, b) {
        var tr = this.map.transform;
        var aPos = Tile.fromID(a);
        var bPos = Tile.fromID(b);
        var c = util.zoomTo(tr.locationCoordinate(tr.center), aPos.z);
        var center = new Point(c.column - 0.5, c.row - 0.5);
        return center.dist(aPos) - center.dist(bPos);
    },
});

var sources = {
    vector: Source,
    raster: Source,
    geojson: require('./geojsonsource'),
    video: require('./videosource')
};

Source.create = function(source) {
    return new sources[source.type](source);
};
