'use strict';

var util = require('../util/util'),
    ajax = require('../util/ajax'),
    normalizeURL = require('../util/mapbox').normalizeSourceURL,
    Evented = require('../util/evented'),
    Cache = require('../util/mru_cache'),
    TileCoord = require('./tile_coord'),
    Tile = require('./tile'),
    Point = require('point-geometry');

module.exports = Source;

function Source(options) {
    util.extend(this, util.pick(options,
        'type', 'url', 'tileSize'));

    if (this.type === 'vector' && this.tileSize !== 512) {
        throw new Error('vector tile sources must have a tileSize of 512');
    }

    this._tiles = {};
    this._cache = new Cache(this.cacheSize, function(tile) {
        tile.remove();
    });

    var loaded = (err, tileJSON) => {
        if (err) throw err;

        if (!tileJSON.tiles)
            throw new Error('missing tiles property');

        util.extend(this, util.pick(tileJSON,
            'tiles', 'minzoom', 'maxzoom', 'attribution'));

        this._loaded = true;
        this.fire('change');
    };

    if (this.url) {
        ajax.getJSON(normalizeURL(this.url), loaded);
    } else {
        loaded(null, options);
    }

    this._updateTiles = util.throttle(this._updateTiles, 50, this);
}

Source.prototype = util.inherit(Evented, {
    minzoom: 0,
    maxzoom: 22,
    tileSize: 512,
    cacheSize: 20,
    _loaded: false,

    onAdd(map) {
        this.map = map;
    },

    load() {
        for (var t in this._tiles) {
            this._tiles[t]._load();
        }
    },

    loaded() {
        if (!this._loaded) {
            return false;
        }
        for (var t in this._tiles) {
            if (!this._tiles[t].loaded)
                return false;
        }
        return true;
    },

    render(layers, painter) {
        // Iteratively paint every tile.
        if (!this._loaded) return;
        var order = Object.keys(this._tiles);
        order.sort(zOrder);
        for (var i = 0; i < order.length; i++) {
            var id = order[i];
            var tile = this._tiles[id];
            if (tile.loaded && !this.coveredTiles[id]) {
                this._renderTile(tile, id, layers, painter);
            }
        }
    },

    // Given a tile of data, its id, and a style layers, render the tile to the canvas
    _renderTile(tile, id, layers, painter) {
        var pos = TileCoord.fromID(id);
        var z = pos.z, x = pos.x, y = pos.y, w = pos.w;
        x += w * (1 << z);

        tile.calculateMatrices(z, x, y, this.map.transform, painter);

        painter.draw(tile, this.map.style, layers, {
            z: z, x: x, y: y,
            debug: this.map.debug,
            antialiasing: this.map.antialiasing,
            vertices: this.map.vertices,
            rotating: this.map.rotating,
            zooming: this.map.zooming
        });
    },

    featuresAt(point, params, callback) {
        point = Point.convert(point);

        if (params.layer) {
            var style = this.map.style,
                layer = style.getLayer(params.layer);
            params.bucket = style.buckets[layer.ref || layer.id];
        }

        var order = Object.keys(this._tiles);
        order.sort(zOrder);
        for (var i = 0; i < order.length; i++) {
            var id = order[i];
            var tile = this._tiles[id];
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
    _getZoom() {
        var zOffset = Math.log(this.map.transform.tileSize / this.tileSize) / Math.LN2;
        return this.map.transform.zoom + zOffset;
    },

    _coveringZoomLevel() {
        return Math.floor(this._getZoom());
    },

    _getCoveringTiles() {
        var z = this._coveringZoomLevel();

        if (z < this.minzoom) return [];
        if (z > this.maxzoom) z = this.maxzoom;

        var tr = this.map.transform,
            tileCenter = TileCoord.zoomTo(tr.locationCoordinate(tr.center), z),
            centerPoint = new Point(tileCenter.column - 0.5, tileCenter.row - 0.5);

        return TileCoord.cover(z, [
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: 0}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: 0}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: tr.height}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: tr.height}), z)
        ]).sort(function(a, b) {
            return centerPoint.dist(TileCoord.fromID(a)) -
                   centerPoint.dist(TileCoord.fromID(b));
        });
    },

    // Recursively find children of the given tile (up to maxCoveringZoom) that are already loaded;
    // adds found tiles to retain object; returns true if children completely cover the tile

    _findLoadedChildren(id, maxCoveringZoom, retain) {
        var complete = true;
        var z = TileCoord.fromID(id).z;
        var ids = TileCoord.children(id);
        for (var i = 0; i < ids.length; i++) {
            if (this._tiles[ids[i]] && this._tiles[ids[i]].loaded) {
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
    // adds the found tile to retain object and returns the tile if found

    _findLoadedParent(id, minCoveringZoom, retain) {
        for (var z = TileCoord.fromID(id).z; z >= minCoveringZoom; z--) {
            id = TileCoord.parent(id);
            var tile = this._tiles[id];
            if (tile && tile.loaded) {
                retain[id] = true;
                return tile;
            }
        }
    },

    update() {
        if (this._loaded) this._updateTiles();
    },

    // Removes tiles that are outside the viewport and adds new tiles that are inside the viewport.
    _updateTiles() {
        if (!this.map || !this.map.loadNewTiles ||
            !this.map.style || !this.map.style.sources || !this.map.style.sources[this.id]) return;

        var zoom = Math.floor(this._getZoom());
        var required = this._getCoveringTiles();
        var i;
        var id;
        var complete;
        var tile;

        // Determine the overzooming/underzooming amounts.
        var minCoveringZoom = util.clamp(zoom - 10, this.minzoom, this.maxzoom);
        var maxCoveringZoom = util.clamp(zoom + 1,  this.minzoom, this.maxzoom);

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
            tile = this._tiles[id];
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
        var remove = util.keysDifference(this._tiles, retain);
        for (i = 0; i < remove.length; i++) {
            id = +remove[i];
            this._removeTile(id);
        }
    },

    _loadTile(id) {
        var pos = TileCoord.fromID(id),
            tile;
        if (pos.w === 0) {
            var url = TileCoord.url(id, this.tiles);
            tile = this._tiles[id] = Tile.create(this.type, id, this, url, (err) => {
                if (err) {
                    console.warn('failed to load tile %d/%d/%d: %s', pos.z, pos.x, pos.y, err.stack || err);
                } else {
                    this.fire('tile.load', {tile: tile});
                }
            });
        } else {
            var wrapped = TileCoord.toID(pos.z, pos.x, pos.y, 0);
            tile = this._tiles[id] = this._tiles[wrapped] || this._addTile(wrapped);
            tile.uses++;
        }
        return tile;
    },

    // Adds a vector tile to the map. It will trigger a rerender of the map and will
    // be part in all future renders of the map. The map object will handle copying
    // the tile data to the GPU if it is required to paint the current viewport.
    _addTile(id) {
        var tile = this._tiles[id];

        if (!tile) {
            tile = this._cache.get(id);
            if (tile) {
                tile.uses = 1;
                this._tiles[id] = tile;
            }
        }

        if (!tile) {
            tile = this._loadTile(id);
            this.fire('tile.add', {tile: tile});
        }

        return tile;
    },

    _removeTile(id) {
        var tile = this._tiles[id];
        if (tile) {
            tile.uses--;
            delete this._tiles[id];

            if (tile.uses <= 0) {
                if (!tile.loaded) {
                    tile.abort();
                    tile.remove();
                } else {
                    this._cache.add(id, tile);
                }

                this.fire('tile.remove', {tile: tile});
            }
        }
    }
});

function zOrder(a, b) {
    return (b % 32) - (a % 32);
}

var sources = {
    vector: Source,
    raster: Source,
    geojson: require('./geojson_source'),
    video: require('./video_source')
};

Source.create = function(source) {
    return new sources[source.type](source);
};
