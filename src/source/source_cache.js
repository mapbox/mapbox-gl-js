// @flow

const createSource = require('./source').create;
const Tile = require('./tile');
const Evented = require('../util/evented');
const TileCoord = require('./tile_coord');
const Cache = require('../util/lru_cache');
const Coordinate = require('../geo/coordinate');
const util = require('../util/util');
const EXTENT = require('../data/extent');

import type {Source} from './source';
import type Map from '../ui/map';
import type Dispatcher from '../util/dispatcher';
import type Transform from '../geo/transform';
import type {TileState} from './tile';

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
    id: string;
    dispatcher: Dispatcher;
    map: Map;

    _source: Source;
    _sourceLoaded: boolean;
    _sourceErrored: boolean;
    _tiles: {[any]: Tile};
    _cache: Cache<Tile>;
    _timers: {[any]: number};
    _cacheTimers: {[any]: number};
    _maxTileCacheSize: ?number;
    _paused: boolean;
    _shouldReloadOnResume: boolean;
    _coveredTiles: {[any]: boolean};
    transform: Transform;
    _isIdRenderable: (id: string) => boolean;

    static maxUnderzooming: number;
    static maxOverzooming: number;

    constructor(id: string, options: SourceSpecification, dispatcher: Dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;

        this.on('data', (e) => {
            // this._sourceLoaded signifies that the TileJSON is loaded if applicable.
            // if the source type does not come with a TileJSON, the flag signifies the
            // source data has loaded (i.e geojson has been tiled on the worker and is ready)
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') this._sourceLoaded = true;

            // for sources with mutable data, this event fires when the underlying data
            // to a source is changed. (i.e. GeoJSONSource#setData and ImageSource#serCoordinates)
            if (this._sourceLoaded && !this._paused && e.dataType === "source" && e.sourceDataType === 'content') {
                this.reload();
                if (this.transform) {
                    this.update(this.transform);
                }
            }
        });

        this.on('error', () => {
            this._sourceErrored = true;
        });

        this._source = createSource(id, options, dispatcher, this);

        this._tiles = {};
        this._cache = new Cache(0, this._unloadTile.bind(this));
        this._timers = {};
        this._cacheTimers = {};
        this._maxTileCacheSize = null;

        this._isIdRenderable = this._isIdRenderable.bind(this);
    }

    onAdd(map: Map) {
        this.map = map;
        this._maxTileCacheSize = map ? map._maxTileCacheSize : null;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    }

    onRemove(map: Map) {
        if (this._source && this._source.onRemove) {
            this._source.onRemove(map);
        }
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     */
    loaded(): boolean {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        for (const t in this._tiles) {
            const tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }

    getSource(): Source {
        return this._source;
    }

    pause() {
        this._paused = true;
    }

    resume() {
        if (!this._paused) return;
        const shouldReload = this._shouldReloadOnResume;
        this._paused = false;
        this._shouldReloadOnResume = false;
        if (shouldReload) this.reload();
        if (this.transform) this.update(this.transform);
    }

    _loadTile(tile: Tile, callback: Callback<void>) {
        return this._source.loadTile(tile, callback);
    }

    _unloadTile(tile: Tile) {
        if (this._source.unloadTile)
            return this._source.unloadTile(tile);
    }

    _abortTile(tile: Tile) {
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
     */
    getIds(): Array<number> {
        return Object.keys(this._tiles).map(Number).sort(compareKeyZoom);
    }

    getRenderableIds() {
        return this.getIds().filter(this._isIdRenderable);
    }

    _isIdRenderable(id: string) {
        return this._tiles[id].hasData() && !this._coveredTiles[id];
    }

    reload() {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._cache.reset();
        for (const i in this._tiles) {
            this._reloadTile(i, 'reloading');
        }
    }

    _reloadTile(id: string|number, state: TileState) {
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

        this._loadTile(tile, this._tileLoaded.bind(this, tile, id, state));
    }

    _tileLoaded(tile: Tile, id: string|number, previousState: TileState, err: ?Error) {
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
     */
    getTile(coord: TileCoord): Tile {
        return this.getTileByID(coord.id);
    }

    /**
     * Get a specific tile by id
     */
    getTileByID(id: string|number): Tile {
        return this._tiles[id];
    }

    /**
     * get the zoom level adjusted for the difference in map and source tilesizes
     */
    getZoom(transform: Transform): number {
        return transform.zoom + transform.scaleZoom(transform.tileSize / this._source.tileSize);
    }

    /**
     * Recursively find children of the given tile (up to maxCoveringZoom) that are already loaded;
     * adds found tiles to retain object; returns true if any child is found.
     */
    _findLoadedChildren(coord: TileCoord, maxCoveringZoom: number, retain: {[any]: boolean}): boolean {
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
                const parent = tile.coord.parent(this._source.maxzoom);
                if (!parent) break;

                tile = this._tiles[parent.id];
                if (tile && tile.hasData()) {
                    delete retain[id];
                    retain[parent.id] = true;
                }
            }
        }
        return found;
    }

    /**
     * Find a loaded parent of the given tile (up to minCoveringZoom);
     * adds the found tile to retain object and returns the tile if found
     */
    findLoadedParent(coord: TileCoord, minCoveringZoom: number, retain: {[any]: boolean}): ?Tile {
        for (let z = coord.z - 1; z >= minCoveringZoom; z--) {
            const parent = coord.parent(this._source.maxzoom);
            if (!parent) return;
            coord = parent;
            const id = String(coord.id);
            const tile = this._tiles[id];
            if (tile && tile.hasData()) {
                retain[id] = true;
                return tile;
            }
            if (this._cache.has(id)) {
                retain[id] = true;
                return this._cache.getWithoutRemoving(id);
            }
        }
    }

    /**
     * Resizes the tile cache based on the current viewport's size
     * or the maxTileCacheSize option passed during map creation
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     */
    updateCacheSize(transform: Transform) {
        const widthInTiles = Math.ceil(transform.width / transform.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / transform.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = 5;

        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const maxSize = typeof this._maxTileCacheSize === 'number' ? Math.min(this._maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;

        this._cache.setMaxSize(maxSize);
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     */
    update(transform: Transform) {
        this.transform = transform;
        if (!this._sourceLoaded || this._paused) { return; }

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
            visibleCoords = transform.getVisibleWrappedCoordinates((this._source.coord : any));
        } else {
            visibleCoords = transform.coveringTiles({
                tileSize: this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled
            });

            if (this._source.hasTile) {
                visibleCoords = visibleCoords.filter((coord) => (this._source.hasTile : any)(coord));
            }
        }

        for (i = 0; i < visibleCoords.length; i++) {
            coord = visibleCoords[i];
            tile = this._addTile(coord);

            retain[coord.id] = true;

            if (tile.hasData())
                continue;

            // The tile we require is not yet loaded.
            // Retain child or parent tiles that cover the same area.
            if (!this._findLoadedChildren(coord, maxCoveringZoom, retain)) {
                parentTile = this.findLoadedParent(coord, minCoveringZoom, retain);
                if (parentTile) {
                    this._addTile(parentTile.coord);
                }
            }
        }

        const parentsForFading = {};

        if (isRasterType(this._source.type)) {
            const ids = Object.keys(retain);
            for (let k = 0; k < ids.length; k++) {
                const id = ids[k];
                coord = TileCoord.fromID(+id);
                tile = this._tiles[id];
                if (!tile) continue;

                // If the drawRasterTile has never seen this tile, then
                // tile.fadeEndTime may be unset.  In that case, or if
                // fadeEndTime is in the future, then this tile is still
                // fading in. Find tiles to cross-fade with it.
                if (typeof tile.fadeEndTime === 'undefined' || tile.fadeEndTime >= Date.now()) {
                    if (this._findLoadedChildren(coord, maxCoveringZoom, retain)) {
                        retain[id] = true;
                    }
                    parentTile = this.findLoadedParent(coord, minCoveringZoom, parentsForFading);
                    if (parentTile) {
                        this._addTile(parentTile.coord);
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
            this._removeTile(remove[i]);
        }
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @private
     */
    _addTile(tileCoord: TileCoord): Tile {
        let tile = this._tiles[tileCoord.id];
        if (tile)
            return tile;

        tile = this._cache.get((tileCoord.id : any));
        if (tile) {
            tile.redoPlacement(this._source);
            if (this._cacheTimers[tileCoord.id]) {
                clearTimeout(this._cacheTimers[tileCoord.id]);
                delete this._cacheTimers[tileCoord.id];
                this._setTileReloadTimer(tileCoord.id, tile);
            }
        }

        const cached = Boolean(tile);
        if (!cached) {
            const zoom = tileCoord.z;
            const overscaling = zoom > this._source.maxzoom ? Math.pow(2, zoom - this._source.maxzoom) : 1;
            tile = new Tile(tileCoord, this._source.tileSize * overscaling, this._source.maxzoom);
            this._loadTile(tile, this._tileLoaded.bind(this, tile, tileCoord.id, tile.state));
        }

        // Impossible, but silence flow.
        if (!tile) return (null : any);

        tile.uses++;
        this._tiles[tileCoord.id] = tile;
        if (!cached) this._source.fire('dataloading', {tile: tile, coord: tile.coord, dataType: 'source'});

        return tile;
    }

    _setTileReloadTimer(id: string|number, tile: Tile) {
        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            }, expiryTimeout);
        }
    }

    _setCacheInvalidationTimer(id: string|number, tile: Tile) {
        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._cacheTimers[id] = setTimeout(() => {
                this._cache.remove((id : any));
                delete this._cacheTimers[id];
            }, expiryTimeout);
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     * @private
     */
    _removeTile(id: string|number) {
        const tile = this._tiles[id];
        if (!tile)
            return;

        tile.uses--;
        delete this._tiles[id];
        if (this._timers[id]) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        if (tile.uses > 0)
            return;

        tile.stopPlacementThrottler();

        if (tile.hasData()) {
            const wrappedId = tile.coord.wrapped().id;
            this._cache.add((wrappedId : any), tile);
            this._setCacheInvalidationTimer(wrappedId, tile);
        } else {
            tile.aborted = true;
            this._abortTile(tile);
            this._unloadTile(tile);
        }
    }

    /**
     * Remove all tiles from this pyramid
     */
    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;

        for (const id in this._tiles)
            this._removeTile(id);
        this._cache.reset();
    }

    /**
     * Search through our current tiles and attempt to find the tiles that
     * cover the given bounds.
     * @param queryGeometry coordinates of the corners of bounding rectangle
     * @returns {Array<Object>} result items have {tile, minX, maxX, minY, maxY}, where min/max bounding values are the given bounds transformed in into the coordinate space of this tile.
     */
    tilesIn(queryGeometry: Array<Coordinate>) {
        const tileResults = [];
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

                tileResults.push({
                    tile: tile,
                    coord: coord,
                    queryGeometry: [tileSpaceQueryGeometry],
                    scale: Math.pow(2, this.transform.zoom - tile.coord.z)
                });
            }
        }

        return tileResults;
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
 * @returns {Object} position
 * @private
 */
function coordinateToTilePoint(tileCoord: TileCoord, sourceMaxZoom: number, coord: Coordinate) {
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
