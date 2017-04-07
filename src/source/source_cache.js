'use strict';

const Source = require('./source');
const Tile = require('./tile');
const Evented = require('../util/evented');
const TileCoord = require('./tile_coord');
const Cache = require('../util/lru_cache');
const Coordinate = require('../geo/coordinate');
const util = require('../util/util');
const EXTENT = require('../data/extent');

/**
 * `SourceCache` is responsible for
 *
 *  - creating an instance of `Source`
 *  - forwarding events from `Source`
 *  - caching tiles loaded from an instance of `Source`
 *  - loading the tiles needed to render a given viewport
 *  - unloading the cached tiles not needed to render a given viewport
 *
 * @private
 */
class SourceCache extends Evented {

    constructor(id, options, dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.on('data', function(e) {
            // this._sourceLoaded signifies that the TileJSON is loaded if applicable.
            // if the source type does not come with a TileJSON, the flag signifies the
            // source data has loaded (i.e geojson has been tiled on the worker and is ready)
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') this._sourceLoaded = true;

            // for sources with mutable data, this event fires when the underlying data
            // to a source is changed. (i.e. GeoJSONSource#setData and ImageSource#serCoordinates)
            if (this._sourceLoaded && e.dataType === "source" && e.sourceDataType === 'content') {
                this.reload();
                if (this.transform) {
                    this.update(this.transform);
                }
            }
        });

        this.on('error', function() {
            this._sourceErrored = true;
        });

        this._source = Source.create(id, options, dispatcher, this);

        this._tiles = {};
        this._cache = new Cache(0, this.unloadTile.bind(this));
        this._timers = {};
        this._cacheTimers = {};

        this._isIdRenderable = this._isIdRenderable.bind(this);
    }

    onAdd(map) {
        this.map = map;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    }

    onRemove(map) {
        if (this._source && this._source.onRemove) {
            this._source.onRemove(map);
        }
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     * @returns {boolean}
     * @private
     */
    loaded() {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        for (const t in this._tiles) {
            const tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }

    /**
     * @returns {Source} The underlying source object
     * @private
     */
    getSource() {
        return this._source;
    }

    loadTile(tile, callback) {
        return this._source.loadTile(tile, callback);
    }

    unloadTile(tile) {
        if (this._source.unloadTile)
            return this._source.unloadTile(tile);
    }

    abortTile(tile) {
        if (this._source.abortTile)
            return this._source.abortTile(tile);
    }

    serialize() {
        return this._source.serialize();
    }


    prepare() {
        if (this._sourceLoaded && this._source.prepare)
            return this._source.prepare();
    }

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     * @returns {Array<number>} ids
     * @private
     */
    getIds() {
        return Object.keys(this._tiles).map(Number).sort(compareKeyZoom);
    }

    getRenderableIds() {
        return this.getIds().filter(this._isIdRenderable);
    }

    _isIdRenderable(id) {
        return this._tiles[id].hasData() && !this._coveredTiles[id];
    }

    reload() {
        this._cache.reset();
        for (const i in this._tiles) {
            this.reloadTile(i, 'reloading');
        }
    }

    reloadTile(id, state) {
        const tile = this._tiles[id];

        // this potentially does not address all underlying
        // issues https://github.com/mapbox/mapbox-gl-js/issues/4252
        // - hard to tell without repro steps
        if (!tile) return;

        // The difference between "loading" tiles and "reloading" or "expired"
        // tiles is that "reloading"/"expired" tiles are "renderable".
        // Therefore, a "loading" tile cannot become a "reloading" tile without
        // first becoming a "loaded" tile.
        if (tile.state !== 'loading') {
            tile.state = state;
        }

        this.loadTile(tile, this._tileLoaded.bind(this, tile, id, state));
    }

    _tileLoaded(tile, id, previousState, err) {
        if (err) {
            tile.state = 'errored';
            if (err.status !== 404) this._source.fire('error', {tile: tile, error: err});
            return;
        }

        tile.sourceCache = this;
        tile.timeAdded = new Date().getTime();
        if (previousState === 'expired') tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        this._source.fire('data', {dataType: 'source', tile: tile, coord: tile.coord});

        // HACK this is necessary to fix https://github.com/mapbox/mapbox-gl-js/issues/2986
        if (this.map) this.map.painter.tileExtentVAO.vao = null;
    }

    /**
     * Get a specific tile by TileCoordinate
     * @param {TileCoordinate} coord
     * @returns {Object} tile
     * @private
     */
    getTile(coord) {
        return this.getTileByID(coord.id);
    }

    /**
     * Get a specific tile by id
     * @param {number|string} id
     * @returns {Object} tile
     * @private
     */
    getTileByID(id) {
        return this._tiles[id];
    }

    /**
     * get the zoom level adjusted for the difference in map and source tilesizes
     * @param {Object} transform
     * @returns {number} zoom level
     * @private
     */
    getZoom(transform) {
        return transform.zoom + transform.scaleZoom(transform.tileSize / this._source.tileSize);
    }

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
    findLoadedChildren(coord, maxCoveringZoom, retain) {
        let found = false;

        for (const id in this._tiles) {
            let tile = this._tiles[id];

            // only consider renderable tiles on higher zoom levels (up to maxCoveringZoom)
            if (retain[id] || !tile.hasData() || tile.coord.z <= coord.z || tile.coord.z > maxCoveringZoom) continue;

            // disregard tiles that are not descendants of the given tile coordinate
            const z2 = Math.pow(2, Math.min(tile.coord.z, this._source.maxzoom) - Math.min(coord.z, this._source.maxzoom));
            if (Math.floor(tile.coord.x / z2) !== coord.x ||
                Math.floor(tile.coord.y / z2) !== coord.y)
                continue;

            // found loaded child
            retain[id] = true;
            found = true;

            // loop through parents; retain the topmost loaded one if found
            while (tile && tile.coord.z - 1 > coord.z) {
                const parentId = tile.coord.parent(this._source.maxzoom).id;
                tile = this._tiles[parentId];

                if (tile && tile.hasData()) {
                    delete retain[id];
                    retain[parentId] = true;
                }
            }
        }
        return found;
    }

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
    findLoadedParent(coord, minCoveringZoom, retain) {
        for (let z = coord.z - 1; z >= minCoveringZoom; z--) {
            coord = coord.parent(this._source.maxzoom);
            const tile = this._tiles[coord.id];
            if (tile && tile.hasData()) {
                retain[coord.id] = true;
                return tile;
            }
            if (this._cache.has(coord.id)) {
                retain[coord.id] = true;
                return this._cache.getWithoutRemoving(coord.id);
            }
        }
    }

    /**
     * Resizes the tile cache based on the current viewport's size.
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     *
     * @private
     */
    updateCacheSize(transform) {
        const widthInTiles = Math.ceil(transform.width / transform.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / transform.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = 5;
        this._cache.setMaxSize(Math.floor(approxTilesInView * commonZoomRange));
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     * @private
     */
    update(transform) {
        this.transform = transform;
        if (!this._sourceLoaded) { return; }
        let i;
        let coord;
        let tile;
        let parentTile;

        this.updateCacheSize(transform);

        // Determine the overzooming/underzooming amounts.
        const zoom = (this._source.roundZoom ? Math.round : Math.floor)(this.getZoom(transform));
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming,  this._source.minzoom);

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        const retain = {};

        // Covered is a list of retained tiles who's areas are full covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = {};

        let visibleCoords;
        if (!this.used) {
            visibleCoords = [];
        } else if (this._source.coord) {
            visibleCoords = transform.getVisibleWrappedCoordinates(this._source.coord);
        } else {
            visibleCoords = transform.coveringTiles({
                tileSize: this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled
            });

            if (this._source.hasTile) {
                visibleCoords = visibleCoords.filter((coord) => this._source.hasTile(coord));
            }
        }

        for (i = 0; i < visibleCoords.length; i++) {
            coord = visibleCoords[i];
            tile = this.addTile(coord);

            retain[coord.id] = true;

            if (tile.hasData())
                continue;

            // The tile we require is not yet loaded.
            // Retain child or parent tiles that cover the same area.
            if (!this.findLoadedChildren(coord, maxCoveringZoom, retain)) {
                parentTile = this.findLoadedParent(coord, minCoveringZoom, retain);
                if (parentTile) {
                    this.addTile(parentTile.coord);
                }
            }
        }

        const parentsForFading = {};

        if (isRasterType(this._source.type)) {
            const ids = Object.keys(retain);
            for (let k = 0; k < ids.length; k++) {
                const id = ids[k];
                coord = TileCoord.fromID(id);
                tile = this._tiles[id];
                if (!tile) continue;

                // If the drawRasterTile has never seen this tile, then
                // tile.fadeEndTime may be unset.  In that case, or if
                // fadeEndTime is in the future, then this tile is still
                // fading in. Find tiles to cross-fade with it.
                if (typeof tile.fadeEndTime === 'undefined' || tile.fadeEndTime >= Date.now()) {
                    if (this.findLoadedChildren(coord, maxCoveringZoom, retain)) {
                        retain[id] = true;
                    }
                    parentTile = this.findLoadedParent(coord, minCoveringZoom, parentsForFading);
                    if (parentTile) {
                        this.addTile(parentTile.coord);
                    }
                }
            }
        }

        let fadedParent;
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
        const remove = util.keysDifference(this._tiles, retain);
        for (i = 0; i < remove.length; i++) {
            this.removeTile(+remove[i]);
        }
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @param {Coordinate} coord
     * @returns {Coordinate} the coordinate.
     * @private
     */
    addTile(coord) {
        let tile = this._tiles[coord.id];
        if (tile)
            return tile;

        const wrapped = coord.wrapped();
        tile = this._tiles[wrapped.id];

        if (!tile) {
            tile = this._cache.get(wrapped.id);
            if (tile) {
                tile.redoPlacement(this._source);
                if (this._cacheTimers[wrapped.id]) {
                    clearTimeout(this._cacheTimers[wrapped.id]);
                    this._cacheTimers[wrapped.id] = undefined;
                    this._setTileReloadTimer(wrapped.id, tile);
                }
            }
        }
        const cached = Boolean(tile);
        if (!cached) {
            const zoom = coord.z;
            const overscaling = zoom > this._source.maxzoom ? Math.pow(2, zoom - this._source.maxzoom) : 1;
            tile = new Tile(wrapped, this._source.tileSize * overscaling, this._source.maxzoom);
            this.loadTile(tile, this._tileLoaded.bind(this, tile, coord.id, tile.state));
        }

        tile.uses++;
        this._tiles[coord.id] = tile;
        if (!cached) this._source.fire('dataloading', {tile: tile, coord: tile.coord, dataType: 'source'});

        return tile;
    }

    _setTileReloadTimer(id, tile) {
        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this.reloadTile(id, 'expired');
                this._timers[id] = undefined;
            }, expiryTimeout);
        }
    }

    _setCacheInvalidationTimer(id, tile) {
        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._cacheTimers[id] = setTimeout(() => {
                this._cache.remove(id);
                this._cacheTimers[id] = undefined;
            }, expiryTimeout);
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     * @param {string|number} id tile id
     * @returns {undefined} nothing
     * @private
     */
    removeTile(id) {
        const tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        if (this._timers[id]) {
            clearTimeout(this._timers[id]);
            this._timers[id] = undefined;
        }

        if (tile.uses > 0)
            return;

        if (tile.hasData()) {
            const wrappedId = tile.coord.wrapped().id;
            this._cache.add(wrappedId, tile);
            this._setCacheInvalidationTimer(wrappedId, tile);
        } else {
            tile.aborted = true;
            this.abortTile(tile);
            this.unloadTile(tile);
        }
    }

    /**
     * Remove all tiles from this pyramid
     * @private
     */
    clearTiles() {
        for (const id in this._tiles)
            this.removeTile(id);
        this._cache.reset();
    }

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param {Array<Coordinate>} queryGeometry coordinates of the corners of bounding rectangle
     * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     * @private
     */
    tilesIn(queryGeometry) {
        const tileResults = {};
        const ids = this.getIds();

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        const z = queryGeometry[0].zoom;

        for (let k = 0; k < queryGeometry.length; k++) {
            const p = queryGeometry[k];
            minX = Math.min(minX, p.column);
            minY = Math.min(minY, p.row);
            maxX = Math.max(maxX, p.column);
            maxY = Math.max(maxY, p.row);
        }

        for (let i = 0; i < ids.length; i++) {
            const tile = this._tiles[ids[i]];
            const coord = TileCoord.fromID(ids[i]);

            const tileSpaceBounds = [
                coordinateToTilePoint(coord, tile.sourceMaxZoom, new Coordinate(minX, minY, z)),
                coordinateToTilePoint(coord, tile.sourceMaxZoom, new Coordinate(maxX, maxY, z))
            ];

            if (tileSpaceBounds[0].x < EXTENT && tileSpaceBounds[0].y < EXTENT &&
                tileSpaceBounds[1].x >= 0 && tileSpaceBounds[1].y >= 0) {

                const tileSpaceQueryGeometry = [];
                for (let j = 0; j < queryGeometry.length; j++) {
                    tileSpaceQueryGeometry.push(coordinateToTilePoint(coord, tile.sourceMaxZoom, queryGeometry[j]));
                }

                let tileResult = tileResults[tile.coord.id];
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

        const results = [];
        for (const t in tileResults) {
            results.push(tileResults[t]);
        }
        return results;
    }

    redoPlacement() {
        const ids = this.getIds();
        for (let i = 0; i < ids.length; i++) {
            const tile = this.getTileByID(ids[i]);
            tile.redoPlacement(this._source);
        }
    }

    getVisibleCoordinates() {
        const coords = this.getRenderableIds().map(TileCoord.fromID);
        for (const coord of coords) {
            coord.posMatrix = this.transform.calculatePosMatrix(coord, this._source.maxzoom);
        }
        return coords;
    }
}

SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

/**
 * Convert a coordinate to a point in a tile's coordinate space.
 * @param {Coordinate} tileCoord
 * @param {Coordinate} coord
 * @returns {Object} position
 * @private
 */
function coordinateToTilePoint(tileCoord, sourceMaxZoom, coord) {
    const zoomedCoord = coord.zoomTo(Math.min(tileCoord.z, sourceMaxZoom));
    return {
        x: (zoomedCoord.column - (tileCoord.x + tileCoord.w * Math.pow(2, tileCoord.z))) * EXTENT,
        y: (zoomedCoord.row - tileCoord.y) * EXTENT
    };

}

function compareKeyZoom(a, b) {
    return (a % 32) - (b % 32);
}

function isRasterType(type) {
    return type === 'raster' || type === 'image' || type === 'video';
}

module.exports = SourceCache;
