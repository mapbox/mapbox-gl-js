// @flow

import Tile from './tile.js';
import {Event, ErrorEvent, Evented} from '../util/evented.js';
import TileCache from './tile_cache.js';
import {asyncAll, keysDifference, values} from '../util/util.js';
import Context from '../gl/context.js';
import Point from '@mapbox/point-geometry';
import browser from '../util/browser.js';
import {OverscaledTileID} from './tile_id.js';
import assert from 'assert';
import SourceFeatureState from './source_state.js';

import type {Source} from './source.js';
import type {SourceSpecification} from '../style-spec/types.js';
import type {default as MapboxMap} from '../ui/map.js';
import type Style from '../style/style.js';
import type Transform from '../geo/transform.js';
import type {TileState} from './tile.js';
import type {Callback} from '../types/callback.js';
import type {FeatureStates} from './source_state.js';
import type {QueryGeometry, TilespaceQueryGeometry} from '../style/query_geometry.js';

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
    map: MapboxMap;
    style: Style;

    _source: Source;
    _sourceLoaded: boolean;
    _sourceErrored: boolean;
    _tiles: {[_: string | number]: Tile};
    _prevLng: number | void;
    _cache: TileCache;
    _timers: {[_: any]: TimeoutID};
    _cacheTimers: {[_: any]: TimeoutID};
    _minTileCacheSize: ?number;
    _maxTileCacheSize: ?number;
    _paused: boolean;
    _isRaster: boolean;
    _shouldReloadOnResume: boolean;
    _coveredTiles: {[_: number | string]: boolean};
    transform: Transform;
    _isIdRenderable: (id: number, symbolLayer?: boolean) => boolean;
    used: boolean;
    usedForTerrain: boolean;
    _state: SourceFeatureState;
    _loadedParentTiles: {[_: number | string]: ?Tile};
    _onlySymbols: ?boolean;

    static maxUnderzooming: number;
    static maxOverzooming: number;

    constructor(id: string, source: Source, onlySymbols?: boolean) {
        super();
        this.id = id;
        this._onlySymbols = onlySymbols;

        source.on('data', (e) => {
            // this._sourceLoaded signifies that the TileJSON is loaded if applicable.
            // if the source type does not come with a TileJSON, the flag signifies the
            // source data has loaded (in other words, GeoJSON has been tiled on the worker and is ready)
            if (e.dataType === 'source' && e.sourceDataType === 'metadata') this._sourceLoaded = true;

            // for sources with mutable data, this event fires when the underlying data
            // to a source is changed (for example, using [GeoJSONSource#setData](https://docs.mapbox.com/mapbox-gl-js/api/sources/#geojsonsource#setdata) or [ImageSource#setCoordinates](https://docs.mapbox.com/mapbox-gl-js/api/sources/#imagesource#setcoordinates))
            if (this._sourceLoaded && !this._paused && e.dataType === "source" && e.sourceDataType === 'content') {
                this.reload();
                if (this.transform) {
                    this.update(this.transform);
                }
            }
        });

        source.on('error', () => {
            this._sourceErrored = true;
        });

        this._source = source;
        this._tiles = {};
        this._cache = new TileCache(0, this._unloadTile.bind(this));
        this._timers = {};
        this._cacheTimers = {};
        this._minTileCacheSize = source.minTileCacheSize;
        this._maxTileCacheSize = source.maxTileCacheSize;
        this._loadedParentTiles = {};

        this._coveredTiles = {};
        this._state = new SourceFeatureState();
        this._isRaster =
            this._source.type === 'raster' ||
            this._source.type === 'raster-dem' ||
            // $FlowFixMe[prop-missing]
            (this._source.type === 'custom' && this._source._dataType === 'raster');
    }

    onAdd(map: MapboxMap) {
        this.map = map;
        this._minTileCacheSize = this._minTileCacheSize === undefined && map ? map._minTileCacheSize : this._minTileCacheSize;
        this._maxTileCacheSize = this._maxTileCacheSize === undefined && map ? map._maxTileCacheSize : this._maxTileCacheSize;
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     * @private
     */
    loaded(): boolean {
        if (this._sourceErrored) { return true; }
        if (!this._sourceLoaded) { return false; }
        if (!this._source.loaded()) { return false; }
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

    _loadTile(tile: Tile, callback: Callback<void>): void {
        tile.isSymbolTile = this._onlySymbols;
        return this._source.loadTile(tile, callback);
    }

    _unloadTile(tile: Tile): void {
        if (this._source.unloadTile)
            return this._source.unloadTile(tile, () => {});
    }

    _abortTile(tile: Tile): void {
        if (this._source.abortTile)
            return this._source.abortTile(tile, () => {});
    }

    serialize(): SourceSpecification {
        return this._source.serialize();
    }

    prepare(context: Context) {
        if  (this._source.prepare) {
            this._source.prepare();
        }

        this._state.coalesceChanges(this._tiles, this.map ? this.map.painter : null);

        if (this._source.prepareTile) {
            for (const i in this._tiles) {
                const tile = this._tiles[i];
                const data = this._source.prepareTile(tile);
                if (data && this.map.painter.terrain) {
                    this.map.painter.terrain._clearRenderCacheForTile(this.id, tile.tileID);
                }

                tile.upload(context);
                tile.prepare(this.map.style.imageManager);
            }

            return;
        }

        for (const i in this._tiles) {
            const tile = this._tiles[i];
            tile.upload(context);
            tile.prepare(this.map.style.imageManager);
        }
    }

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     * @private
     */
    getIds(): Array<number> {
        return values((this._tiles: any)).map((tile: Tile) => tile.tileID).sort(compareTileId).map(id => id.key);
    }

    getRenderableIds(symbolLayer?: boolean): Array<number> {
        const renderables: Array<Tile> = [];
        for (const id in this._tiles) {
            if (this._isIdRenderable(+id, symbolLayer)) renderables.push(this._tiles[id]);
        }
        if (symbolLayer) {
            return renderables.sort((a_: Tile, b_: Tile) => {
                const a = a_.tileID;
                const b = b_.tileID;
                const rotatedA = (new Point(a.canonical.x, a.canonical.y))._rotate(this.transform.angle);
                const rotatedB = (new Point(b.canonical.x, b.canonical.y))._rotate(this.transform.angle);
                return a.overscaledZ - b.overscaledZ || rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
            }).map(tile => tile.tileID.key);
        }
        return renderables.map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
    }

    hasRenderableParent(tileID: OverscaledTileID): boolean {
        const parentTile = this.findLoadedParent(tileID, 0);
        if (parentTile) {
            return this._isIdRenderable(parentTile.tileID.key);
        }
        return false;
    }

    _isIdRenderable(id: number, symbolLayer?: boolean): boolean {
        return this._tiles[id] && this._tiles[id].hasData() &&
            !this._coveredTiles[id] && (symbolLayer || !this._tiles[id].holdingForFade());
    }

    reload() {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._cache.reset();

        for (const i in this._tiles) {
            if (this._tiles[i].state !== "errored") this._reloadTile(+i, 'reloading');
        }
    }

    _reloadTile(id: number, state: TileState) {
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

    _tileLoaded(tile: Tile, id: number, previousState: TileState, err: ?Error) {
        if (err) {
            tile.state = 'errored';
            if ((err: any).status !== 404) this._source.fire(new ErrorEvent(err, {tile}));
            else {
                // continue to try loading parent/children tiles if a tile doesn't exist (404)
                const updateForTerrain = this._source.type === 'raster-dem' && this.usedForTerrain;
                if (updateForTerrain && this.map.painter.terrain) {
                    const terrain = this.map.painter.terrain;
                    this.update(this.transform, terrain.getScaledDemTileSize(), true);
                    terrain.resetTileLookupCache(this.id);
                } else {
                    this.update(this.transform);
                }
            }
            return;
        }

        tile.timeAdded = browser.now();
        if (previousState === 'expired') tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        if (this._source.type === 'raster-dem' && tile.dem) this._backfillDEM(tile);
        this._state.initializeTileState(tile, this.map ? this.map.painter : null);

        this._source.fire(new Event('data', {dataType: 'source', tile, coord: tile.tileID, 'sourceCacheId': this.id}));
    }

    /**
    * For raster terrain source, backfill DEM to eliminate visible tile boundaries
    * @private
    */
    _backfillDEM(tile: Tile) {
        const renderables = this.getRenderableIds();
        for (let i = 0; i < renderables.length; i++) {
            const borderId = renderables[i];
            if (tile.neighboringTiles && tile.neighboringTiles[borderId]) {
                const borderTile = this.getTileByID(borderId);
                fillBorder(tile, borderTile);
                fillBorder(borderTile, tile);
            }
        }

        function fillBorder(tile, borderTile) {
            if (!tile.dem || tile.dem.borderReady) return;
            tile.needsHillshadePrepare = true;
            tile.needsDEMTextureUpload = true;
            let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
            const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
            const dim = Math.pow(2, tile.tileID.canonical.z);
            const borderId = borderTile.tileID.key;
            if (dx === 0 && dy === 0) return;

            if (Math.abs(dy) > 1) {
                return;
            }
            if (Math.abs(dx) > 1) {
                // Adjust the delta coordinate for world wraparound.
                if (Math.abs(dx + dim) === 1) {
                    dx += dim;
                } else if (Math.abs(dx - dim) === 1) {
                    dx -= dim;
                }
            }
            if (!borderTile.dem || !tile.dem) return;
            tile.dem.backfillBorder(borderTile.dem, dx, dy);
            if (tile.neighboringTiles && tile.neighboringTiles[borderId])
                tile.neighboringTiles[borderId].backfilled = true;
        }
    }
    /**
     * Get a specific tile by TileID
     * @private
     */
    getTile(tileID: OverscaledTileID): Tile {
        return this.getTileByID(tileID.key);
    }

    /**
     * Get a specific tile by id
     * @private
     */
    getTileByID(id: number): Tile {
        return this._tiles[id];
    }

    /**
     * For a given set of tiles, retain children that are loaded and have a zoom
     * between `zoom` (exclusive) and `maxCoveringZoom` (inclusive)
     * @private
     */
    _retainLoadedChildren(
        idealTiles: {[number | string]: OverscaledTileID},
        zoom: number,
        maxCoveringZoom: number,
        retain: {[number | string]: OverscaledTileID}
    ) {
        for (const id in this._tiles) {
            let tile = this._tiles[id];

            // only consider renderable tiles up to maxCoveringZoom
            if (retain[id] ||
                !tile.hasData() ||
                tile.tileID.overscaledZ <= zoom ||
                tile.tileID.overscaledZ > maxCoveringZoom
            ) continue;

            // loop through parents and retain the topmost loaded one if found
            let topmostLoadedID = tile.tileID;
            while (tile && tile.tileID.overscaledZ > zoom + 1) {
                const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);

                tile = this._tiles[parentID.key];

                if (tile && tile.hasData()) {
                    topmostLoadedID = parentID;
                }
            }

            // loop through ancestors of the topmost loaded child to see if there's one that needed it
            let tileID = topmostLoadedID;
            while (tileID.overscaledZ > zoom) {
                tileID = tileID.scaledTo(tileID.overscaledZ - 1);

                if (idealTiles[tileID.key]) {
                    // found a parent that needed a loaded child; retain that child
                    retain[topmostLoadedID.key] = topmostLoadedID;
                    break;
                }
            }
        }
    }

    /**
     * Find a loaded parent of the given tile (up to minCoveringZoom)
     * @private
     */
    findLoadedParent(tileID: OverscaledTileID, minCoveringZoom: number): ?Tile {
        if (tileID.key in this._loadedParentTiles) {
            const parent = this._loadedParentTiles[tileID.key];
            if (parent && parent.tileID.overscaledZ >= minCoveringZoom) {
                return parent;
            } else {
                return null;
            }
        }
        for (let z = tileID.overscaledZ - 1; z >= minCoveringZoom; z--) {
            const parentTileID = tileID.scaledTo(z);
            const tile = this._getLoadedTile(parentTileID);
            if (tile) {
                return tile;
            }
        }
    }

    _getLoadedTile(tileID: OverscaledTileID): ?Tile {
        const tile = this._tiles[tileID.key];
        if (tile && tile.hasData()) {
            return tile;
        }
        // TileCache ignores wrap in lookup.
        const cachedTile = this._cache.getByKey(this._source.reparseOverscaled ? tileID.wrapped().key : tileID.canonical.key);
        return cachedTile;
    }

    /**
     * Resizes the tile cache based on the current viewport's size
     * or the minTileCacheSize and maxTileCacheSize options passed during map creation
     *
     * Larger viewports use more tiles and need larger caches. Larger viewports
     * are more likely to be found on devices with more memory and on pages where
     * the map is more important.
     * @private
     */
    updateCacheSize(transform: Transform, tileSize?: number) {
        tileSize = tileSize || this._source.tileSize;
        const widthInTiles = Math.ceil(transform.width / tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = 5;

        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const minSize = typeof this._minTileCacheSize === 'number' ? Math.max(this._minTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;
        const maxSize = typeof this._maxTileCacheSize === 'number' ? Math.min(this._maxTileCacheSize, minSize) : minSize;

        this._cache.setMaxSize(maxSize);
    }

    handleWrapJump(lng: number) {
        // On top of the regular z/x/y values, TileIDs have a `wrap` value that specify
        // which copy of the world the tile belongs to. For example, at `lng: 10` you
        // might render z/x/y/0 while at `lng: 370` you would render z/x/y/1.
        //
        // When lng values get wrapped (going from `lng: 370` to `long: 10`) you expect
        // to see the same thing on the screen (370 degrees and 10 degrees is the same
        // place in the world) but all the TileIDs will have different wrap values.
        //
        // In order to make this transition seamless, we calculate the rounded difference of
        // "worlds" between the last frame and the current frame. If the map panned by
        // a world, then we can assign all the tiles new TileIDs with updated wrap values.
        // For example, assign z/x/y/1 a new id: z/x/y/0. It is the same tile, just rendered
        // in a different position.
        //
        // This enables us to reuse the tiles at more ideal locations and prevent flickering.
        const prevLng = this._prevLng === undefined ? lng : this._prevLng;
        const lngDifference = lng - prevLng;
        const worldDifference = lngDifference / 360;
        const wrapDelta = Math.round(worldDifference);
        this._prevLng = lng;

        if (wrapDelta) {
            const tiles: {[_: string | number]: Tile} = {};
            for (const key in this._tiles) {
                const tile = this._tiles[key];
                tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
                tiles[tile.tileID.key] = tile;
            }
            this._tiles = tiles;

            // Reset tile reload timers
            for (const id in this._timers) {
                clearTimeout(this._timers[id]);
                delete this._timers[id];
            }
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                this._setTileReloadTimer(+id, tile);
            }
        }
    }

    /**
     * Removes tiles that are outside the viewport and adds new tiles that
     * are inside the viewport.
     * @private
     * @param {boolean} updateForTerrain Signals to update tiles even if the
     * source is not used (this.used) by layers: it is used for terrain.
     * @param {tileSize} tileSize If needed to get lower resolution ideal cover,
     * override source.tileSize used in tile cover calculation.
     */
    update(transform: Transform, tileSize?: number, updateForTerrain?: boolean) {
        this.transform = transform;
        if (!this._sourceLoaded || this._paused || this.transform.freezeTileCoverage) { return; }
        assert(!(updateForTerrain && !this.usedForTerrain));
        if (this.usedForTerrain && !updateForTerrain) {
            // If source is used for both terrain and hillshade, don't update it twice.
            return;
        }

        this.updateCacheSize(transform, tileSize);
        if (this.transform.projection.name !== 'globe') {
            this.handleWrapJump(this.transform.center.lng);
        }

        // Covered is a list of retained tiles who's areas are fully covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = {};

        let idealTileIDs;
        if (!this.used && !this.usedForTerrain) {
            idealTileIDs = [];
        } else if (this._source.tileID) {
            idealTileIDs = transform.getVisibleUnwrappedCoordinates(this._source.tileID)
                .map((unwrapped) => new OverscaledTileID(unwrapped.canonical.z, unwrapped.wrap, unwrapped.canonical.z, unwrapped.canonical.x, unwrapped.canonical.y));
        } else {
            idealTileIDs = transform.coveringTiles({
                tileSize: tileSize || this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this._source.roundZoom && !updateForTerrain,
                reparseOverscaled: this._source.reparseOverscaled,
                isTerrainDEM: this.usedForTerrain
            });

            if (this._source.hasTile) {
                idealTileIDs = idealTileIDs.filter((coord) => (this._source.hasTile: any)(coord));
            }
        }

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        const retain = this._updateRetainedTiles(idealTileIDs);

        if (isRasterType(this._source.type) && idealTileIDs.length !== 0) {
            const parentsForFading: {[_: string | number]: OverscaledTileID} = {};
            const fadingTiles = {};
            const ids = Object.keys(retain);
            for (const id of ids) {
                const tileID = retain[id];
                assert(tileID.key === +id);

                const tile = this._tiles[id];
                if (!tile || (tile.fadeEndTime && tile.fadeEndTime <= browser.now())) continue;

                // if the tile is loaded but still fading in, find parents to cross-fade with it
                const parentTile = this.findLoadedParent(tileID, Math.max(tileID.overscaledZ - SourceCache.maxOverzooming, this._source.minzoom));
                if (parentTile) {
                    this._addTile(parentTile.tileID);
                    parentsForFading[parentTile.tileID.key] = parentTile.tileID;
                }

                fadingTiles[id] = tileID;
            }

            // for children tiles with parent tiles still fading in,
            // retain the children so the parent can fade on top
            const minZoom = idealTileIDs[idealTileIDs.length - 1].overscaledZ;
            for (const id in this._tiles) {
                const childTile = this._tiles[id];
                if (retain[id] || !childTile.hasData()) {
                    continue;
                }

                let parentID = childTile.tileID;
                while (parentID.overscaledZ > minZoom) {
                    parentID = parentID.scaledTo(parentID.overscaledZ - 1);
                    const tile = this._tiles[parentID.key];
                    if (tile && tile.hasData() && fadingTiles[parentID.key]) {
                        retain[id] = childTile.tileID;
                        break;
                    }
                }
            }

            for (const id in parentsForFading) {
                if (!retain[id]) {
                    // If a tile is only needed for fading, mark it as covered so that it isn't rendered on it's own.
                    this._coveredTiles[id] = true;
                    retain[id] = parentsForFading[id];
                }
            }
        }

        for (const retainedId in retain) {
            // Make sure retained tiles always clear any existing fade holds
            // so that if they're removed again their fade timer starts fresh.
            this._tiles[retainedId].clearFadeHold();
        }

        // Remove the tiles we don't need anymore.
        const remove = keysDifference((this._tiles: any), (retain: any));
        for (const tileID of remove) {
            const tile = this._tiles[tileID];
            if (tile.hasSymbolBuckets && !tile.holdingForFade()) {
                tile.setHoldDuration(this.map._fadeDuration);
            } else if (!tile.hasSymbolBuckets || tile.symbolFadeFinished()) {
                this._removeTile(+tileID);
            }
        }

        // Construct a cache of loaded parents
        this._updateLoadedParentTileCache();

        if (this._onlySymbols && this._source.afterUpdate) {
            this._source.afterUpdate();
        }
    }

    releaseSymbolFadeTiles() {
        for (const id in this._tiles) {
            if (this._tiles[id].holdingForFade()) {
                this._removeTile(+id);
            }
        }
    }

    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>): {[_: number | string]: OverscaledTileID} {
        const retain: {[_: number | string]: OverscaledTileID} = {};
        if (idealTileIDs.length === 0) { return retain; }

        const checked: {[_: number | string]: boolean } = {};
        const minZoom = idealTileIDs.reduce((min, id) => Math.min(min, id.overscaledZ), Infinity);
        const maxZoom = idealTileIDs[0].overscaledZ;
        assert(minZoom <= maxZoom);
        const minCoveringZoom = Math.max(maxZoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(maxZoom + SourceCache.maxUnderzooming,  this._source.minzoom);

        const missingTiles = {};
        for (const tileID of idealTileIDs) {
            const tile = this._addTile(tileID);

            // retain the tile even if it's not loaded because it's an ideal tile.
            retain[tileID.key] = tileID;

            if (tile.hasData()) continue;

            if (minZoom < this._source.maxzoom) {
                // save missing tiles that potentially have loaded children
                missingTiles[tileID.key] = tileID;
            }
        }

        // retain any loaded children of ideal tiles up to maxCoveringZoom
        this._retainLoadedChildren(missingTiles, minZoom, maxCoveringZoom, retain);

        for (const tileID of idealTileIDs) {
            let tile = this._tiles[tileID.key];

            if (tile.hasData()) continue;

            // The tile we require is not yet loaded or does not exist;
            // Attempt to find children that fully cover it.

            if (tileID.canonical.z >= this._source.maxzoom) {
                // We're looking for an overzoomed child tile.
                const childCoord = tileID.children(this._source.maxzoom)[0];
                const childTile = this.getTile(childCoord);
                if (!!childTile && childTile.hasData()) {
                    retain[childCoord.key] = childCoord;
                    continue; // tile is covered by overzoomed child
                }
            } else {
                // Check if all 4 immediate children are loaded (in other words, the missing ideal tile is covered)
                const children = tileID.children(this._source.maxzoom);

                if (retain[children[0].key] &&
                    retain[children[1].key] &&
                    retain[children[2].key] &&
                    retain[children[3].key]) continue; // tile is covered by children
            }

            // We couldn't find child tiles that entirely cover the ideal tile; look for parents now.

            // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
            // tile has been previously requested (and errored because we only loop over tiles with no data)
            // in order to determine if we need to request its parent.
            let parentWasRequested = tile.wasRequested();

            for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = tileID.scaledTo(overscaledZ);

                // Break parent tile ascent if this route has been previously checked by another child.
                if (checked[parentId.key]) break;
                checked[parentId.key] = true;

                tile = this.getTile(parentId);
                if (!tile && parentWasRequested) {
                    tile = this._addTile(parentId);
                }
                if (tile) {
                    retain[parentId.key] = parentId;
                    // Save the current values, since they're the parent of the next iteration
                    // of the parent tile ascent loop.
                    parentWasRequested = tile.wasRequested();
                    if (tile.hasData()) break;
                }
            }
        }

        return retain;
    }

    _updateLoadedParentTileCache() {
        this._loadedParentTiles = {};

        for (const tileKey in this._tiles) {
            const path = [];
            let parentTile: ?Tile;
            let currentId = this._tiles[tileKey].tileID;

            // Find the closest loaded ancestor by traversing the tile tree towards the root and
            // caching results along the way
            while (currentId.overscaledZ > 0) {

                // Do we have a cached result from previous traversals?
                if (currentId.key in this._loadedParentTiles) {
                    parentTile = this._loadedParentTiles[currentId.key];
                    break;
                }

                path.push(currentId.key);

                // Is the parent loaded?
                const parentId = currentId.scaledTo(currentId.overscaledZ - 1);
                parentTile = this._getLoadedTile(parentId);
                if (parentTile) {
                    break;
                }

                currentId = parentId;
            }

            // Cache the result of this traversal to all newly visited tiles
            for (const key of path) {
                this._loadedParentTiles[key] = parentTile;
            }
        }
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @private
     */
    _addTile(tileID: OverscaledTileID): Tile {
        let tile = this._tiles[tileID.key];
        if (tile) {
            if (this._source.prepareTile) this._source.prepareTile(tile);
            return tile;
        }

        tile = this._cache.getAndRemove(tileID);
        if (tile) {
            this._setTileReloadTimer(tileID.key, tile);
            // set the tileID because the cached tile could have had a different wrap value
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
            if (this._cacheTimers[tileID.key]) {
                clearTimeout(this._cacheTimers[tileID.key]);
                delete this._cacheTimers[tileID.key];
                this._setTileReloadTimer(tileID.key, tile);
            }
        }

        const cached = Boolean(tile);
        if (!cached) {
            const painter = this.map ? this.map.painter : null;
            tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor(), this.transform.tileZoom, painter, this._isRaster);
            if (this._source.prepareTile) {
                const data = this._source.prepareTile(tile);
                if (!data) this._loadTile(tile, this._tileLoaded.bind(this, tile, tileID.key, tile.state));
            } else {
                this._loadTile(tile, this._tileLoaded.bind(this, tile, tileID.key, tile.state));
            }
        }

        // Impossible, but silence flow.
        if (!tile) return (null: any);

        tile.uses++;
        this._tiles[tileID.key] = tile;
        if (!cached) this._source.fire(new Event('dataloading', {tile, coord: tile.tileID, dataType: 'source'}));

        return tile;
    }

    _setTileReloadTimer(id: number, tile: Tile) {
        if (id in this._timers) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }

        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            }, expiryTimeout);
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     * @private
     */
    _removeTile(id: number) {
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

        if (tile.hasData() && tile.state !== 'reloading') {
            this._cache.add(tile.tileID, tile, tile.getExpiryTimeout());
        } else {
            tile.aborted = true;
            this._abortTile(tile);
            this._unloadTile(tile);
        }
    }

    /**
     * Remove all tiles from this pyramid.
     * @private
     */
    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;

        for (const id in this._tiles)
            this._removeTile(+id);

        if (this._source._clear) this._source._clear();

        this._cache.reset();

        if (this.map && this.usedForTerrain && this.map.painter.terrain) {
            this.map.painter.terrain.resetTileLookupCache(this.id);
        }
    }

    /**
     * Search through our current tiles and attempt to find the tiles that cover the given `queryGeometry`.
     *
     * @param {QueryGeometry} queryGeometry
     * @param {boolean} [visualizeQueryGeometry=false]
     * @param {boolean} use3DQuery
     * @returns
     * @private
     */
    tilesIn(queryGeometry: QueryGeometry, use3DQuery: boolean, visualizeQueryGeometry: boolean): TilespaceQueryGeometry[] {
        const tileResults = [];

        const transform = this.transform;
        if (!transform) return tileResults;

        for (const tileID in this._tiles) {
            const tile = this._tiles[tileID];
            if (visualizeQueryGeometry) {
                tile.clearQueryDebugViz();
            }
            if (tile.holdingForFade()) {
                // Tiles held for fading are covered by tiles that are closer to ideal
                continue;
            }

            const tileResult = queryGeometry.containsTile(tile, transform, use3DQuery);
            if (tileResult) {
                tileResults.push(tileResult);
            }
        }
        return tileResults;
    }

    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID> {
        const coords = this.getRenderableIds(symbolLayer).map((id) => this._tiles[id].tileID);
        for (const coord of coords) {
            coord.projMatrix = this.transform.calculateProjMatrix(coord.toUnwrapped());
        }
        return coords;
    }

    hasTransition(): boolean {
        if (this._source.hasTransition()) {
            return true;
        }

        if (isRasterType(this._source.type)) {
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                if (tile.fadeEndTime !== undefined && tile.fadeEndTime >= browser.now()) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Set the value of a particular state for a feature
     * @private
     */
    setFeatureState(sourceLayer?: string, featureId: number | string, state: Object) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.updateState(sourceLayer, featureId, state);
    }

    /**
     * Resets the value of a particular state key for a feature
     * @private
     */
    removeFeatureState(sourceLayer?: string, featureId?: number | string, key?: string) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.removeFeatureState(sourceLayer, featureId, key);
    }

    /**
     * Get the entire state object for a feature
     * @private
     */
    getFeatureState(sourceLayer?: string, featureId: number | string): FeatureStates {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        return this._state.getState(sourceLayer, featureId);
    }

    /**
     * Sets the set of keys that the tile depends on. This allows tiles to
     * be reloaded when their dependencies change.
     * @private
     */
    setDependencies(tileKey: number, namespace: string, dependencies: Array<string>) {
        const tile = this._tiles[tileKey];
        if (tile) {
            tile.setDependencies(namespace, dependencies);
        }
    }

    /**
     * Reloads all tiles that depend on the given keys.
     * @private
     */
    reloadTilesForDependencies(namespaces: Array<string>, keys: Array<string>) {
        for (const id in this._tiles) {
            const tile = this._tiles[id];
            if (tile.hasDependency(namespaces, keys)) {
                this._reloadTile(+id, 'reloading');
            }
        }
        this._cache.filter(tile => !tile.hasDependency(namespaces, keys));
    }

    /**
     * Preloads all tiles that will be requested for one or a series of transformations
     *
     * @private
     * @returns {Object} Returns `this` | Promise.
     */
    _preloadTiles(transform: Transform | Array<Transform>, callback: Callback<any>) {
        const coveringTilesIDs: Map<number, OverscaledTileID> = new Map();
        const transforms = Array.isArray(transform) ? transform : [transform];

        const terrain = this.map.painter.terrain;
        const tileSize = this.usedForTerrain && terrain ? terrain.getScaledDemTileSize() : this._source.tileSize;

        for (const tr of transforms) {
            const tileIDs = tr.coveringTiles({
                tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this._source.roundZoom && !this.usedForTerrain,
                reparseOverscaled: this._source.reparseOverscaled,
                isTerrainDEM: this.usedForTerrain
            });

            for (const tileID of tileIDs) {
                coveringTilesIDs.set(tileID.key, tileID);
            }

            if (this.usedForTerrain) {
                tr.updateElevation(false);
            }
        }

        const tileIDs = Array.from(coveringTilesIDs.values());

        asyncAll(tileIDs, (tileID, done) => {
            const tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor(), this.transform.tileZoom, this.map.painter, this._isRaster);
            this._loadTile(tile, (err) => {
                if (this._source.type === 'raster-dem' && tile.dem) this._backfillDEM(tile);
                done(err, tile);
            });
        }, callback);
    }
}

SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;

function compareTileId(a: OverscaledTileID, b: OverscaledTileID): number {
    // Different copies of the world are sorted based on their distance to the center.
    // Wrap values are converted to unsigned distances by reserving odd number for copies
    // with negative wrap and even numbers for copies with positive wrap.
    const aWrap = Math.abs(a.wrap * 2) - +(a.wrap < 0);
    const bWrap = Math.abs(b.wrap * 2) - +(b.wrap < 0);
    return a.overscaledZ - b.overscaledZ || bWrap - aWrap || b.canonical.y - a.canonical.y || b.canonical.x - a.canonical.x;
}

function isRasterType(type): boolean {
    return type === 'raster' || type === 'image' || type === 'video';
}

export default SourceCache;
