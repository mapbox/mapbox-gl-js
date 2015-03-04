'use strict';

var Tile = require('./tile');
var TileCoord = require('./tile_coord');
var Point = require('point-geometry');
var Cache = require('../util/mru_cache');
var util = require('../util/util');

module.exports = TilePyramid;

function TilePyramid(options) {
    this.tileSize = options.tileSize;
    this.minzoom = options.minzoom;
    this.maxzoom = options.maxzoom;
    this.reparseOverscaled = options.reparseOverscaled;

    this._load = options.load;
    this._abort = options.abort;
    this._unload = options.unload;
    this._add = options.add;
    this._remove = options.remove;

    this._tiles = {};
    this._cache = new Cache(options.cacheSize, function(tile) { return this._unload(tile); }.bind(this));
}

TilePyramid.prototype = {
    loaded: function() {
        for (var t in this._tiles) {
            if (!this._tiles[t].loaded)
                return false;
        }
        return true;
    },

    orderedIDs: function() {
        return Object.keys(this._tiles)
            .sort(function(a, b) { return (b % 32) - (a % 32); }) // z-order
            .map(function(id) { return +id; });
    },

    renderedIDs: function() {
        return this.orderedIDs().filter(function(id) {
            return this._tiles[id].loaded && !this._coveredTiles[id];
        }.bind(this));
    },

    reload: function() {
        this._cache.reset();
        for (var i in this._tiles) {
            this._load(this._tiles[i]);
        }
    },

    getTile: function(id) {
        return this._tiles[id];
    },

    // get the zoom level adjusted for the difference in map and source tilesizes
    getZoom: function(transform) {
        return transform.zoom + Math.log(transform.tileSize / this.tileSize) / Math.LN2;
    },

    coveringZoomLevel: function(transform) {
        return Math.floor(this.getZoom(transform));
    },

    coveringTiles: function(transform) {
        var z = this.coveringZoomLevel(transform);
        var actualZ = z;

        if (z < this.minzoom) return [];
        if (z > this.maxzoom) z = this.maxzoom;

        var tr = transform,
            tileCenter = TileCoord.zoomTo(tr.locationCoordinate(tr.center), z),
            centerPoint = new Point(tileCenter.column - 0.5, tileCenter.row - 0.5);

        return TileCoord.cover(z, [
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: 0}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: 0}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: tr.width, y: tr.height}), z),
            TileCoord.zoomTo(tr.pointCoordinate(tileCenter, {x: 0, y: tr.height}), z)
        ], this.reparseOverscaled ? actualZ : z).sort(function(a, b) {
            return centerPoint.dist(TileCoord.fromID(a)) -
                centerPoint.dist(TileCoord.fromID(b));
        });
    },

    // Recursively find children of the given tile (up to maxCoveringZoom) that are already loaded;
    // adds found tiles to retain object; returns true if children completely cover the tile
    findLoadedChildren: function(id, maxCoveringZoom, retain) {
        var complete = true;
        var z = TileCoord.fromID(id).z;
        var ids = TileCoord.children(id, this.maxzoom);
        for (var i = 0; i < ids.length; i++) {
            if (this._tiles[ids[i]] && this._tiles[ids[i]].loaded) {
                retain[ids[i]] = true;
            } else {
                complete = false;
                if (z < maxCoveringZoom) {
                    // Go further down the hierarchy to find more unloaded children.
                    this.findLoadedChildren(ids[i], maxCoveringZoom, retain);
                }
            }
        }
        return complete;
    },

    // Find a loaded parent of the given tile (up to minCoveringZoom);
    // adds the found tile to retain object and returns the tile if found
    findLoadedParent: function(id, minCoveringZoom, retain) {
        for (var z = TileCoord.fromID(id).z; z >= minCoveringZoom; z--) {
            id = TileCoord.parent(id, this.maxzoom);
            var tile = this._tiles[id];
            if (tile && tile.loaded) {
                retain[id] = true;
                return tile;
            }
        }
    },

    // Removes tiles that are outside the viewport and adds new tiles that are inside the viewport.
    update: function(used, transform, fadeDuration) {
        var i;
        var id;
        var tile;

        // Determine the overzooming/underzooming amounts.
        var zoom = Math.floor(this.getZoom(transform));
        var minCoveringZoom = util.clamp(zoom - 10, this.minzoom, this.maxzoom);
        var maxCoveringZoom = util.clamp(zoom + 1,  this.minzoom, this.maxzoom);

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        var retain = {};
        var now = new Date().getTime();

        // Covered is a list of retained tiles who's areas are full covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = {};

        var required = used ? this.coveringTiles(transform) : [];
        for (i = 0; i < required.length; i++) {
            id = +required[i];
            tile = this.addTile(id);

            retain[id] = true;

            if (tile.loaded)
                continue;

            // The tile we require is not yet loaded.
            // Retain child or parent tiles that cover the same area.
            if (!this.findLoadedChildren(id, maxCoveringZoom, retain)) {
                this.findLoadedParent(id, minCoveringZoom, retain);
            }
        }

        for (id in retain) {
            tile = this._tiles[id];
            if (tile && tile.timeAdded > now - (fadeDuration || 0)) {
                // This tile is still fading in. Find tiles to cross-fade with it.
                if (this.findLoadedChildren(id, maxCoveringZoom, retain)) {
                    this._coveredTiles[id] = true;
                    retain[id] = true;
                } else {
                    this.findLoadedParent(id, minCoveringZoom, retain);
                }
            }
        }

        // Remove the tiles we don't need anymore.
        var remove = util.keysDifference(this._tiles, retain);
        for (i = 0; i < remove.length; i++) {
            this.removeTile(+remove[i]);
        }
    },

    addTile: function(id) {
        var tile = this._tiles[id];
        if (tile)
            return tile;

        var wrapped = this._wrappedID(id);
        tile = this._tiles[wrapped] || this._cache.get(wrapped);

        if (!tile) {
            var zoom = TileCoord.fromID(id).z;
            var overscaling = zoom > this.maxzoom ? Math.pow(2, zoom - this.maxzoom) : 1;
            tile = new Tile(wrapped, this.tileSize * overscaling);
            this._load(tile);
        }

        tile.uses++;
        this._tiles[id] = tile;
        this._add(tile, id);

        return tile;
    },

    removeTile: function(id) {
        var tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        this._remove(tile, id);

        if (tile.uses > 0)
            return;

        if (tile.loaded) {
            this._cache.add(this._wrappedID(id), tile);
        } else {
            this._abort(tile);
            this._unload(tile);
        }
    },

    clearTiles: function() {
        for (var id in this._tiles)
            this.removeTile(id);
        this._cache.reset();
    },

    tileAt: function(point) {
        var ids = this.orderedIDs();
        for (var i = 0; i < ids.length; i++) {
            var tile = this._tiles[ids[i]];
            var pos = tile.positionAt(point);
            if (pos && pos.x >= 0 && pos.x < 4096 && pos.y >= 0 && pos.y < 4096) {
                // The click is within the viewport. There is only ever one tile in
                // a layer that has this property.
                return {
                    tile: tile,
                    x: pos.x,
                    y: pos.y,
                    scale: pos.scale
                };
            }
        }
    },

    _wrappedID: function(id) {
        var pos = TileCoord.fromID(id);
        return pos.w === 0 ? id : TileCoord.toID(pos.z, pos.x, pos.y, 0);
    }
};
