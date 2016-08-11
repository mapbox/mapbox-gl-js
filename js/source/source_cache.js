'use strict';

var Source = require('./source');
var Tile = require('./tile');
var Evented = require('../util/evented');
var TileCoord = require('./tile_coord');
var Cache = require('../util/lru_cache');
var Coordinate = require('../geo/coordinate');
var util = require('../util/util');
var EXTENT = require('../data/bucket').EXTENT;

module.exports = SourceCache;

/**
 * A tile pyramid is a specialized cache and datastructure
 * that contains tiles. It's used by sources to manage their
 * data.
 *
 * @param {Object} options
 * @private
 */
function SourceCache(id, options, dispatcher) {
    this.id = id;
    this.dispatcher = dispatcher;

    var source = this._source = Source.create(id, options, dispatcher)
    .on('load', function () {
        if (this.map && this._source.onAdd) { this._source.onAdd(this.map); }

        this._sourceLoaded = true;

        this.tileSize = source.tileSize;
        this.minzoom = source.minzoom;
        this.maxzoom = source.maxzoom;
        this.roundZoom = source.roundZoom;
        this.reparseOverscaled = source.reparseOverscaled;
        this.isTileClipped = source.isTileClipped;
        this.attribution = source.attribution;

        this.vectorLayerIds = source.vectorLayerIds;

        this.fire('load');
    }.bind(this))
    .on('error', function (e) {
        this._sourceErrored = true;
        this.fire('error', e);
    }.bind(this))
    .on('change', function () {
        this.reload();
        if (this.transform) {
            this.update(this.transform, this.map && this.map.style.rasterFadeDuration);
        }
        this.fire('change');
    }.bind(this));

    this._tiles = {};
    this._cache = new Cache(0, this.unloadTile.bind(this));

    this._isIdRenderable = this._isIdRenderable.bind(this);
}


SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

SourceCache.prototype = util.inherit(Evented, {
    onAdd: function (map) {
        this.map = map;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    },

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     * @returns {boolean}
     * @private
     */
    loaded: function() {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        for (var t in this._tiles) {
            var tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    },

    /**
     * @returns {Source} The underlying source object
     * @private
     */
    getSource: function () {
        return this._source;
    },

    loadTile: function (tile, callback) {
        return this._source.loadTile(tile, callback);
    },

    unloadTile: function (tile) {
        if (this._source.unloadTile)
            return this._source.unloadTile(tile);
    },

    abortTile: function (tile) {
        if (this._source.abortTile)
            return this._source.abortTile(tile);
    },

    serialize: function () {
        return this._source.serialize();
    },

    prepare: function () {
        if (this._sourceLoaded && this._source.prepare)
            return this._source.prepare();
    },

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     * @returns {Array<number>} ids
     * @private
     */
    getIds: function() {
        return Object.keys(this._tiles).map(Number).sort(compareKeyZoom);
    },

    getRenderableIds: function() {
        return this.getIds().filter(this._isIdRenderable);
    },

    _isIdRenderable: function(id) {
        return this._tiles[id].isRenderable() && !this._coveredTiles[id];
    },

    reload: function() {
        this._cache.reset();
        for (var i in this._tiles) {
            var tile = this._tiles[i];

            // The difference between "loading" tiles and "reloading" tiles is
            // that "reloading" tiles are "renderable". Therefore, a "loading"
            // tile cannot become a "reloading" tile without first becoming
            // a "loaded" tile.
            if (tile.state !== 'loading') {
                tile.state = 'reloading';
            }

            this.loadTile(this._tiles[i], this._tileLoaded.bind(this, this._tiles[i]));
        }
    },

    _tileLoaded: function (tile, err) {
        if (err) {
            tile.state = 'errored';
            this.fire('tile.error', {tile: tile, error: err});
            this._source.fire('tile.error', {tile: tile, error: err});
            return;
        }

        tile.source = this;
        tile.timeAdded = new Date().getTime();
        this.fire('tile.load', {tile: tile});
        this._source.fire('tile.load', {tile: tile});
    },

    /**
     * Get a specific tile by TileCoordinate
     * @param {TileCoordinate} coord
     * @returns {Object} tile
     * @private
     */
    getTile: function(coord) {
        return this.getTileByID(coord.id);
    },

    /**
     * Get a specific tile by id
     * @param {number|string} id
     * @returns {Object} tile
     * @private
     */
    getTileByID: function(id) {
        return this._tiles[id];
    },

    /**
     * get the zoom level adjusted for the difference in map and source tilesizes
     * @param {Object} transform
     * @returns {number} zoom level
     * @private
     */
    getZoom: function(transform) {
        return transform.zoom + transform.scaleZoom(transform.tileSize / this.tileSize);
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

            // only consider renderable tiles on higher zoom levels (up to maxCoveringZoom)
            if (retain[id] || !tile.isRenderable() || tile.coord.z <= coord.z || tile.coord.z > maxCoveringZoom) continue;

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

                if (tile && tile.isRenderable()) {
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
     * @returns {Tile} tile object
     * @private
     */
    findLoadedParent: function(coord, minCoveringZoom, retain) {
        for (var z = coord.z - 1; z >= minCoveringZoom; z--) {
            coord = coord.parent(this.maxzoom);
            var tile = this._tiles[coord.id];
            if (tile && tile.isRenderable()) {
                retain[coord.id] = true;
                return tile;
            }
            if (this._cache.has(coord.id)) {
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
    update: function(transform, fadeDuration) {
        if (!this._sourceLoaded) { return; }
        var i;
        var coord;
        var tile;

        this.updateCacheSize(transform);

        // Determine the overzooming/underzooming amounts.
        var zoom = (this.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
        var minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this.minzoom);
        var maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming,  this.minzoom);

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        var retain = {};
        var now = new Date().getTime();

        // Covered is a list of retained tiles who's areas are full covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = {};

        var required = this.used ? transform.coveringTiles(this._source) : [];
        for (i = 0; i < required.length; i++) {
            coord = required[i];
            tile = this.addTile(coord);

            retain[coord.id] = true;

            if (tile.isRenderable())
                continue;

            // The tile we require is not yet loaded.
            // Retain child or parent tiles that cover the same area.
            if (!this.findLoadedChildren(coord, maxCoveringZoom, retain)) {
                this.findLoadedParent(coord, minCoveringZoom, retain);
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
                this.findLoadedParent(coord, minCoveringZoom, parentsForFading);
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
            this.loadTile(tile, this._tileLoaded.bind(this, tile));
        }

        tile.uses++;
        this._tiles[coord.id] = tile;
        this.fire('tile.add', {tile: tile});
        this._source.fire('tile.add', {tile: tile});

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
        this.fire('tile.remove', {tile: tile});
        this._source.fire('tile.remove', {tile: tile});

        if (tile.uses > 0)
            return;

        if (tile.isRenderable()) {
            this._cache.add(tile.coord.wrapped().id, tile);
        } else {
            tile.aborted = true;
            this.abortTile(tile);
            this.unloadTile(tile);
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
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param {Array<Coordinate>} queryGeometry coordinates of the corners of bounding rectangle
     * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     * @private
     */
    tilesIn: function(queryGeometry) {
        var tileResults = {};
        var ids = this.getIds();

        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;
        var z = queryGeometry[0].zoom;

        for (var k = 0; k < queryGeometry.length; k++) {
            var p = queryGeometry[k];
            minX = Math.min(minX, p.column);
            minY = Math.min(minY, p.row);
            maxX = Math.max(maxX, p.column);
            maxY = Math.max(maxY, p.row);
        }

        for (var i = 0; i < ids.length; i++) {
            var tile = this._tiles[ids[i]];
            var coord = TileCoord.fromID(ids[i]);

            var tileSpaceBounds = [
                coordinateToTilePoint(coord, tile.sourceMaxZoom, new Coordinate(minX, minY, z)),
                coordinateToTilePoint(coord, tile.sourceMaxZoom, new Coordinate(maxX, maxY, z))
            ];

            if (tileSpaceBounds[0].x < EXTENT && tileSpaceBounds[0].y < EXTENT &&
                tileSpaceBounds[1].x >= 0 && tileSpaceBounds[1].y >= 0) {

                var tileSpaceQueryGeometry = [];
                for (var j = 0; j < queryGeometry.length; j++) {
                    tileSpaceQueryGeometry.push(coordinateToTilePoint(coord, tile.sourceMaxZoom, queryGeometry[j]));
                }

                var tileResult = tileResults[tile.coord.id];
                if (tileResult === undefined) {
                    tileResult = tileResults[tile.coord.id] = {
                        tile: tile,
                        coord: coord,
                        queryGeometry: [],
                        scale: Math.pow(2, this.transform.zoom - tile.coord.z)
                    };
                }

                // Wrapped tiles share one tileResult object but can have multiple queryGeometry parts
                tileResult.queryGeometry.push(tileSpaceQueryGeometry);
            }
        }

        var results = [];
        for (var t in tileResults) {
            results.push(tileResults[t]);
        }
        return results;
    },

    redoPlacement: function () {
        var ids = this.getIds();
        for (var i = 0; i < ids.length; i++) {
            var tile = this.getTileByID(ids[i]);
            tile.redoPlacement(this);
        }
    },

    getVisibleCoordinates: function () {
        return this.getRenderableIds().map(TileCoord.fromID);
    }
});

/**
 * Convert a coordinate to a point in a tile's coordinate space.
 * @param {Coordinate} tileCoord
 * @param {Coordinate} coord
 * @returns {Object} position
 * @private
 */
function coordinateToTilePoint(tileCoord, sourceMaxZoom, coord) {
    var zoomedCoord = coord.zoomTo(Math.min(tileCoord.z, sourceMaxZoom));
    return {
        x: (zoomedCoord.column - (tileCoord.x + tileCoord.w * Math.pow(2, tileCoord.z))) * EXTENT,
        y: (zoomedCoord.row - tileCoord.y) * EXTENT
    };

}

function compareKeyZoom(a, b) {
    return (a % 32) - (b % 32);
}
