'use strict';

var Tile = require('./tile');
var TileCoord = require('./tile_coord');
var Point = require('point-geometry');
var Cache = require('../util/lru_cache');
var util = require('../util/util');
var EXTENT = require('../data/bucket').EXTENT;

module.exports = TilePyramid;

/**
 * A tile pyramid is a specialized cache and datastructure
 * that contains tiles. It's used by sources to manage their
 * data.
 *
 * @param {Object} options
 * @param {number} options.tileSize
 * @param {number} options.minzoom
 * @param {number} options.maxzoom
 * @private
 */
function TilePyramid(options) {
    this.tileSize = options.tileSize;
    this.minzoom = options.minzoom;
    this.maxzoom = options.maxzoom;
    this.roundZoom = options.roundZoom;
    this.reparseOverscaled = options.reparseOverscaled;

    this._load = options.load;
    this._abort = options.abort;
    this._unload = options.unload;
    this._add = options.add;
    this._remove = options.remove;
    this._redoPlacement = options.redoPlacement;

    this._tiles = {};
    this._cache = new Cache(0, function(tile) { return this._unload(tile); }.bind(this));

    this._filterRendered = this._filterRendered.bind(this);
}


TilePyramid.maxOverzooming = 10;
TilePyramid.maxUnderzooming = 3;

TilePyramid.prototype = {
    /**
     * Confirm that every tracked tile is loaded.
     * @returns {boolean} whether all tiles are loaded.
     * @private
     */
    loaded: function() {
        for (var t in this._tiles) {
            if (!this._tiles[t].loaded && !this._tiles[t].errored)
                return false;
        }
        return true;
    },

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     * @returns {Array<number>} ids
     * @private
     */
    orderedIDs: function() {
        return Object.keys(this._tiles).map(Number).sort(compareKeyZoom);
    },

    renderedIDs: function() {
        return this.orderedIDs().filter(this._filterRendered);
    },

    _filterRendered: function(id) {
        return this._tiles[id].loaded && !this._coveredTiles[id];
    },

    reload: function() {
        this._cache.reset();
        for (var i in this._tiles) {
            this._load(this._tiles[i]);
        }
    },

    /**
     * Get a specific tile by id
     * @param {string|number} id tile id
     * @returns {Object} tile
     * @private
     */
    getTile: function(id) {
        return this._tiles[id];
    },

    /**
     * get the zoom level adjusted for the difference in map and source tilesizes
     * @param {Object} transform
     * @returns {number} zoom level
     * @private
     */
    getZoom: function(transform) {
        return transform.zoom + Math.log(transform.tileSize / this.tileSize) / Math.LN2;
    },

    /**
     * Return a zoom level that will cover all tiles in a given transform
     * @param {Object} transform
     * @returns {number} zoom level
     * @private
     */
    coveringZoomLevel: function(transform) {
        return (this.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
    },

    /**
     * Given a transform, return all coordinates that could cover that
     * transform for a covering zoom level.
     * @param {Object} transform
     * @returns {Array<Tile>} tiles
     * @private
     */
    coveringTiles: function(transform) {
        var z = this.coveringZoomLevel(transform);
        var actualZ = z;

        if (z < this.minzoom) return [];
        if (z > this.maxzoom) z = this.maxzoom;

        var tr = transform,
            tileCenter = tr.locationCoordinate(tr.center)._zoomTo(z),
            centerPoint = new Point(tileCenter.column - 0.5, tileCenter.row - 0.5);

        return TileCoord.cover(z, [
            tr.pointCoordinate(new Point(0, 0))._zoomTo(z),
            tr.pointCoordinate(new Point(tr.width, 0))._zoomTo(z),
            tr.pointCoordinate(new Point(tr.width, tr.height))._zoomTo(z),
            tr.pointCoordinate(new Point(0, tr.height))._zoomTo(z)
        ], this.reparseOverscaled ? actualZ : z).sort(function(a, b) {
            return centerPoint.dist(a) - centerPoint.dist(b);
        });
    },

    /**
     * Recursively find children of the given tile (up to maxCoveringZoom) that are already loaded;
     * adds found tiles to retain object; returns true if any child is found.
     *
     * @param {Coordinate} coord
     * @param {number} maxCoveringZoom
     * @param {boolean} retain
     * @returns {boolean} whether the operation was complete
     * @private
     */
    findLoadedChildren: function(coord, maxCoveringZoom, retain) {
        var found = false;

        for (var id in this._tiles) {
            var tile = this._tiles[id];

            // only consider loaded tiles on higher zoom levels (up to maxCoveringZoom)
            if (retain[id] || !tile.loaded || tile.coord.z <= coord.z || tile.coord.z > maxCoveringZoom) continue;

            // disregard tiles that are not descendants of the given tile coordinate
            var z2 = Math.pow(2, Math.min(tile.coord.z, this.maxzoom) - Math.min(coord.z, this.maxzoom));
            if (Math.floor(tile.coord.x / z2) !== coord.x ||
                Math.floor(tile.coord.y / z2) !== coord.y)
                continue;

            // found loaded child
            retain[id] = true;
            found = true;

            // loop through parents; retain the topmost loaded one if found
            while (tile && tile.coord.z - 1 > coord.z) {
                var parentId = tile.coord.parent(this.maxzoom).id;
                tile = this._tiles[parentId];

                if (tile && tile.loaded) {
                    delete retain[id];
                    retain[parentId] = true;
                }
            }
        }
        return found;
    },

    /**
     * Find a loaded parent of the given tile (up to minCoveringZoom);
     * adds the found tile to retain object and returns the tile if found
     *
     * @param {Coordinate} coord
     * @param {number} minCoveringZoom
     * @param {boolean} retain
     * @param {boolean} checkCache
     * @returns {Tile} tile object
     * @private
     */
    findLoadedParent: function(coord, minCoveringZoom, retain, checkCache) {
        for (var z = coord.z - 1; z >= minCoveringZoom; z--) {
            coord = coord.parent(this.maxzoom);
            var tile = this._tiles[coord.id];
            if (tile && tile.loaded) {
                retain[coord.id] = true;
                return tile;
            }
            if (checkCache && this._cache.has(coord.id)) {
                this.addTile(coord);
                retain[coord.id] = true;
                return this._tiles[coord.id];
            }
        }
    },

    /**
     * Resizes the tile cache based on the current viewport's size.
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     *
     * @private
     */
    updateCacheSize: function(transform) {
        var widthInTiles = Math.ceil(transform.width / transform.tileSize) + 1;
        var heightInTiles = Math.ceil(transform.height / transform.tileSize) + 1;
        var approxTilesInView = widthInTiles * heightInTiles;
        var commonZoomRange = 5;
        this._cache.setMaxSize(Math.floor(approxTilesInView * commonZoomRange));
    },

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     * @private
     */
    update: function(used, transform, fadeDuration) {
        var i;
        var coord;
        var tile;

        this.updateCacheSize(transform);

        // Determine the overzooming/underzooming amounts.
        var zoom = (this.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
        var minCoveringZoom = Math.max(zoom - TilePyramid.maxOverzooming, this.minzoom);
        var maxCoveringZoom = Math.max(zoom + TilePyramid.maxUnderzooming,  this.minzoom);

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
            coord = required[i];
            tile = this.addTile(coord);

            retain[coord.id] = true;

            if (tile.loaded)
                continue;

            // The tile we require is not yet loaded.
            // Retain child or parent tiles that cover the same area.
            if (!this.findLoadedChildren(coord, maxCoveringZoom, retain)) {
                this.findLoadedParent(coord, minCoveringZoom, retain, true);
            }
        }

        var parentsForFading = {};

        var ids = Object.keys(retain);
        for (var k = 0; k < ids.length; k++) {
            var id = ids[k];
            coord = TileCoord.fromID(id);
            tile = this._tiles[id];
            if (tile && tile.timeAdded > now - (fadeDuration || 0)) {
                // This tile is still fading in. Find tiles to cross-fade with it.
                if (this.findLoadedChildren(coord, maxCoveringZoom, retain)) {
                    retain[id] = true;
                }
                this.findLoadedParent(coord, minCoveringZoom, parentsForFading, true);
            }
        }

        var fadedParent;
        for (fadedParent in parentsForFading) {
            if (!retain[fadedParent]) {
                // If a tile is only needed for fading, mark it as covered so that it isn't rendered on it's own.
                this._coveredTiles[fadedParent] = true;
            }
        }
        for (fadedParent in parentsForFading) {
            retain[fadedParent] = true;
        }

        // Remove the tiles we don't need anymore.
        var remove = util.keysDifference(this._tiles, retain);
        for (i = 0; i < remove.length; i++) {
            this.removeTile(+remove[i]);
        }

        this.transform = transform;
    },

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @param {Coordinate} coord
     * @returns {Coordinate} the coordinate.
     * @private
     */
    addTile: function(coord) {
        var tile = this._tiles[coord.id];
        if (tile)
            return tile;

        var wrapped = coord.wrapped();
        tile = this._tiles[wrapped.id];

        if (!tile) {
            tile = this._cache.get(wrapped.id);
            if (tile && this._redoPlacement) {
                this._redoPlacement(tile);
            }
        }

        if (!tile) {
            var zoom = coord.z;
            var overscaling = zoom > this.maxzoom ? Math.pow(2, zoom - this.maxzoom) : 1;
            tile = new Tile(wrapped, this.tileSize * overscaling, this.maxzoom);
            this._load(tile);
        }

        tile.uses++;
        this._tiles[coord.id] = tile;
        this._add(tile, coord);

        return tile;
    },

    /**
     * Remove a tile, given its id, from the pyramid
     * @param {string|number} id tile id
     * @returns {undefined} nothing
     * @private
     */
    removeTile: function(id) {
        var tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        this._remove(tile);

        if (tile.uses > 0)
            return;

        if (tile.loaded) {
            this._cache.add(tile.coord.wrapped().id, tile);
        } else {
            this._abort(tile);
            this._unload(tile);
        }
    },

    /**
     * Remove all tiles from this pyramid
     * @private
     */
    clearTiles: function() {
        for (var id in this._tiles)
            this.removeTile(id);
        this._cache.reset();
    },

    /**
     * For a given coordinate, search through our current tiles and attempt
     * to find a tile at that point
     * @param {Coordinate} coord
     * @returns {Object} tile
     * @private
     */
    tileAt: function(coord) {
        var ids = this.orderedIDs();
        for (var i = 0; i < ids.length; i++) {
            var tile = this._tiles[ids[i]];
            var pos = tile.positionAt(coord);
            if (pos && pos.x >= 0 && pos.x < EXTENT && pos.y >= 0 && pos.y < EXTENT) {
                // The click is within the viewport. There is only ever one tile in
                // a layer that has this property.
                return {
                    tile: tile,
                    x: pos.x,
                    y: pos.y,
                    scale: Math.pow(2, this.transform.zoom - tile.coord.z),
                    tileSize: tile.tileSize
                };
            }
        }
    },

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param {Array<Coordinate>} bounds [minxminy, maxxmaxy] coordinates of the corners of bounding rectangle
     * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     * @private
     */
    tilesIn: function(bounds) {
        var result = [];
        var ids = this.orderedIDs();

        for (var i = 0; i < ids.length; i++) {
            var tile = this._tiles[ids[i]];
            var tileSpaceBounds = [
                tile.positionAt(bounds[0]),
                tile.positionAt(bounds[1])
            ];
            if (tileSpaceBounds[0].x < EXTENT && tileSpaceBounds[0].y < EXTENT &&
                tileSpaceBounds[1].x >= 0 && tileSpaceBounds[1].y >= 0) {
                result.push({
                    tile: tile,
                    minX: tileSpaceBounds[0].x,
                    maxX: tileSpaceBounds[1].x,
                    minY: tileSpaceBounds[0].y,
                    maxY: tileSpaceBounds[1].y
                });
            }
        }

        return result;
    }
};

function compareKeyZoom(a, b) {
    return (a % 32) - (b % 32);
}
