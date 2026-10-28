import assert from '../style-spec/util/assert';
import Point from '@mapbox/point-geometry';
import Tile from './tile';
import {RenderSourceType} from './render_source_type';
import {createRasterArrayTile} from './raster_array_plugin';
import {Event, ErrorEvent, Evented} from '../util/evented';
import TileCache from './tile_cache';
import {asyncAll, clamp} from '../util/util';
import browser from '../util/browser';
import {OverscaledTileID} from './tile_id';
import SourceFeatureState from './source_state';
import MercatorCoordinate, {mercatorXfromLng} from '../geo/mercator_coordinate';
import {isHttpNotFound} from '../util/ajax';
import LazySource from './lazy_source';
import {TilePlacementRelationsIndex} from '../placement/tile_placement_relations_index';

import type {CanonicalTileID} from './tile_id';
import type Context from '../gl/context';
import type {vec3} from 'gl-matrix';
import type {ISource, Source} from './source';
import type RasterArrayTileSource from './raster_array_tile_source';
import type {SourceSpecification} from '../style-spec/types';
import type {Map as MapboxMap} from '../ui/map';
import type Transform from '../geo/transform';
import type {TileState} from './tile';
import type {Callback} from '../types/callback';
import type {FeatureState} from '../style-spec/expression/index';
import type {QueryGeometry, TilespaceQueryGeometry} from '../style/query_geometry';
import type {StringifiedImageId} from '../style-spec/expression/types/image_id';
import type {LoadVectorTileResult} from './load_vector_tile';
import type RasterArrayTile from './raster_array_tile';

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
    map!: MapboxMap;

    _source!: ISource;
    _sourceLoaded!: boolean;
    _sourceErrored!: boolean;
    _tiles: Map<number, Tile>;
    _prevLng: number | undefined;
    _cache: TileCache;
    _timers: Map<number, number>;
    _minTileCacheSize?: number;
    _maxTileCacheSize?: number;
    _paused!: boolean;
    _isRaster: boolean;
    _supportsFading: boolean;
    _isRasterElevatedOverTerrain: boolean;
    _shouldReloadOnResume!: boolean;
    _coveredTiles: Set<number>;
    transform!: Transform;
    used!: boolean;
    usedForTerrain!: boolean;
    castsShadows: boolean;
    tileCoverLift: number;
    _state: SourceFeatureState;
    _loadedParentTiles: Map<number, Tile | null | undefined>;
    placementRelations: TilePlacementRelationsIndex;
    _renderSourceType: RenderSourceType | null | undefined;
    _maxzoomOverride: number | null;
    _shadowCasterTiles: Set<number>;

    static maxUnderzooming: number;
    static maxOverzooming: number;

    constructor(id: string, source: Source, renderSourceType?: RenderSourceType | null) {
        super();
        this.id = id;
        this._renderSourceType = renderSourceType;
        this._maxzoomOverride = null;

        this.setSource(source);
        this._tiles = new Map();

        this._cache = new TileCache(0, this._unloadTile.bind(this));
        this._timers = new Map();
        this._minTileCacheSize = source.minTileCacheSize;
        this._maxTileCacheSize = source.maxTileCacheSize;
        this._loadedParentTiles = new Map();
        this.placementRelations = new TilePlacementRelationsIndex();
        this.castsShadows = false;
        this.tileCoverLift = 0.0;

        this._coveredTiles = new Set();
        this._shadowCasterTiles = new Set();
        this._state = new SourceFeatureState();

        // Sources that use tiled raster data
        this._isRaster =
            this._source.type === 'raster' ||
            this._source.type === 'raster-dem' ||
            this._source.type === 'raster-array' ||
            (this._source.type === 'custom' && '_dataType' in this._source && this._source._dataType === 'raster');

        // Sources that use fade transitions between zoom levels
        this._supportsFading =
            this._source.type === 'raster' ||
            this._source.type === 'raster-array' ||
            this._source.type === 'image' ||
            this._source.type === 'video' ||
            this._source.type === 'custom';

        this._isRasterElevatedOverTerrain = false;
    }

    onAdd(map: MapboxMap) {
        this.map = map;
        this._minTileCacheSize = this._minTileCacheSize === undefined && map ? map._minTileCacheSize : this._minTileCacheSize;
        this._maxTileCacheSize = this._maxTileCacheSize === undefined && map ? map._maxTileCacheSize : this._maxTileCacheSize;
    }

    /**
     * Set the source backing this cache and subscribe to its lifecycle events. Called at
     * construction, and again when a lazily-loaded module replaces a {@link LazySource}
     * placeholder with the real source — keeping the `SourceCache` identity stable. Such an
     * upgrade is only valid from a placeholder of the same source `type` (so the raster/fading
     * flags derived at construction still hold); the real source's `onAdd` (which begins
     * loading) is the caller's responsibility, mirroring the normal `addSource` flow.
     * @private
     */
    setSource(source: ISource) {
        source.on('data', (e: {dataType?: string; sourceDataType?: string}) => {
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
    }

    /**
     * Return true if no tile data is pending, tiles will not change unless
     * an additional API call is received.
     * @private
     */
    loaded(): boolean {
        if (this._sourceErrored) { return true; }
        // A placeholder whose module load is still deferred never fires `metadata`, but it has
        // nothing pending either, so let it report as loaded and not block `Style#loaded`.
        if (this._source instanceof LazySource) { return this._source.loaded(); }
        if (!this._sourceLoaded) { return false; }
        if (!this._source.loaded()) { return false; }
        for (const tile of this._tiles.values()) {
            if (!tile.loaded()) return false;
        }
        return true;
    }

    getSource<T extends Source>(): T {
        return this._source as T;
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

    setMaxzoomOverride(maxzoom: number | null) {
        this._maxzoomOverride = maxzoom;
    }

    _loadTile(tile: Tile, callback: Callback<undefined>): void {
        tile.renderSourceType = this._renderSourceType;
        tile.isExtraShadowCaster = this._shadowCasterTiles.has(tile.tileID.key);
        return this._source.loadTile(tile, callback);
    }

    _unloadTile(tile: Tile): void {
        // A removed tile can still have loads in flight (e.g. an expiry refresh); late responses must not touch it
        tile.aborted = true;
        this._abortTile(tile);
        if (this._source.unloadTile)
            return this._source.unloadTile(tile);
    }

    _abortTile(tile: Tile): void {
        if (this._source.abortTile)
            return this._source.abortTile(tile);
    }

    serialize(): SourceSpecification | {type: 'custom', [key: string]: unknown} {
        return this._source.serialize();
    }

    prepare(context: Context) {
        if (this._source.prepare) {
            this._source.prepare();
        }

        this._state.coalesceChanges(this._tiles, this.map ? this.map.painter : null);

        for (const [id, tile] of this._tiles) {
            tile.upload(context, this.map ? this.map.painter : undefined);
            // the atlas texture was evicted after its pixels had been dropped, so only a reload can bring it back
            if (tile.imageAtlas && !tile.imageAtlasTexture && tile.state === 'loaded') this._reloadTile(id, 'reloading');
            tile.prepare(this.map.style.imageManager, this.map ? this.map.painter : null, this._source.scope);
        }
    }

    /**
     * Return all tile ids ordered with z-order, and cast to numbers
     * @private
     */
    getIds(): Array<number> {
        return Array.from(this._tiles.values(), (tile: Tile) => tile.tileID).sort(compareTileId).map(id => id.key);
    }

    getRenderableIds(symbolLayer?: boolean, includeShadowCasters?: boolean): Array<number> {
        const renderables: Array<Tile> = [];
        for (const tile of this._tiles.values()) {
            if (this._isTileRenderable(tile, symbolLayer, includeShadowCasters)) renderables.push(tile);
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

    _isIdRenderable(id: number, symbolLayer?: boolean, includeShadowCasters?: boolean): boolean {
        const tile = this._tiles.get(id);
        return !!tile && this._isTileRenderable(tile, symbolLayer, includeShadowCasters);
    }

    _isTileRenderable(tile: Tile, symbolLayer?: boolean, includeShadowCasters?: boolean): boolean {
        const id = tile.tileID.key;
        return tile.hasData() && !this._coveredTiles.has(id) && (symbolLayer || !tile.holdingForFade()) &&
            (includeShadowCasters || !this._shadowCasterTiles.has(id));
    }

    reload() {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }

        this._cache.reset();

        for (const [id, tile] of this._tiles) {
            if (tile.state !== "errored") this._reloadTile(id, 'reloading');
        }
    }

    _reloadTile(id: number, state: TileState) {
        const tile = this._tiles.get(id);

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

    _tileLoaded(tile: Tile, id: number, previousState: TileState, err?: Error | null, data?: LoadVectorTileResult | null) {
        // Sources call back with no error for aborted tiles; these are already unloaded and out of the
        // pyramid, so arming a reload timer for them would leak it past clearTiles() and retain the map.
        if (tile.aborted) return;

        if (err) {
            tile.state = 'errored';
            if (isHttpNotFound(err)) {
                // If the requested tile is missing, try to load the parent tile
                // to use it as an overscaled tile instead of the missing one.
                // Fire a `data` event with an `error` source data type to trigger map render
                this._source.fire(new Event('data', {dataType: 'source', sourceDataType: 'error', sourceId: this._source.id, tile}));

                // If there are no parent tiles to load, stop tiles loading fallback
                const hasParent = this._loadedParentTiles.has(tile.tileID.key);
                if (!hasParent) return;

                // Otherwise, continue trying to load the parent tile until we find one that loads successfully
                const updateForTerrain = this._source.type === 'raster-dem' && this.usedForTerrain;
                if (updateForTerrain && this.map.painter.terrain) {
                    const terrain = this.map.painter.terrain;
                    this.update(this.transform, terrain.getScaledDemTileSize(), true);
                    terrain.resetTileLookupCache(this.id);
                } else {
                    this.update(this.transform);
                }
            } else {
                this._source.fire(new ErrorEvent(err, {tile}));
            }
            return;
        }

        tile.timeAdded = browser.now();
        if (previousState === 'expired') tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        if (this._source.type === 'raster-dem' && tile.dem) this._backfillDEM(tile);
        this._state.initializeTileState(tile, this.map ? this.map.painter : null);

        let responseHeaders: Headers = new Headers();
        if (data && data.headers) responseHeaders = data.headers;

        this._syncPlacementRelations();

        this._source.fire(new Event('data', {dataType: 'source', tile, coord: tile.tileID, 'sourceCacheId': this.id, responseHeaders}));
    }

    // Keeps the relations between rendered symbol tiles current for global placement. Runs whenever
    // the rendered set can change: a tile (re)loads, coverage is recomputed, or tiles are held for
    // fading, retained again or removed.
    _syncPlacementRelations() {
        if (!this.map || this.map._placementAlgorithm !== 'global') return;
        const tiles: Array<Tile> = [];
        for (const tile of this._tiles.values()) {
            if (this._isTileRenderable(tile, true)) tiles.push(tile);
        }
        this.placementRelations.sync(tiles);
    }

    _hasTunnelGeometry(): boolean {
        for (const tile of this._tiles.values()) {
            if (tile.hasTunnelGeometry) return true;
        }
        return false;
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

        function fillBorder(tile: Tile, borderTile: Tile) {
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
        return this._tiles.get(id);
    }

    /**
     * For a given set of tiles, retain children that are loaded and have a zoom
     * between `zoom` (exclusive) and `maxCoveringZoom` (inclusive)
     * @private
     */
    _retainLoadedChildren(
        idealTiles: Set<number>,
        zoom: number,
        maxCoveringZoom: number,
        retain: Map<number, OverscaledTileID>
    ) {
        const isRasterArray = this._source.type === 'raster-array';
        for (const [id, child] of this._tiles) {
            let tile = child;

            // only consider renderable tiles up to maxCoveringZoom
            if (retain.has(id) ||
                !tile.hasData() ||
                tile.tileID.overscaledZ <= zoom ||
                tile.tileID.overscaledZ > maxCoveringZoom
            ) continue;

            // Client-side overzoomed raster-array tiles are synthetic crops of
            // a lower-zoom parent — not authoritative data at their zoom. If
            // we retain them as "loaded children" of a missing lower-zoom
            // ideal tile, the renderer keeps painting them on top of the new
            // ideal tile after the user zooms out, doubling raster-particle
            // density and causing ghosting.
            if (isRasterArray && (tile as RasterArrayTile).parentTile) continue;

            // loop through parents and retain the topmost loaded one if found
            let topmostLoadedID = tile.tileID;
            while (tile && tile.tileID.overscaledZ > zoom + 1) {
                const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);

                tile = this._tiles.get(parentID.key);

                if (tile && tile.hasData()) {
                    topmostLoadedID = parentID;
                }
            }

            // loop through ancestors of the topmost loaded child to see if there's one that needed it
            let tileID = topmostLoadedID;
            while (tileID.overscaledZ > zoom) {
                tileID = tileID.scaledTo(tileID.overscaledZ - 1);

                if (idealTiles.has(tileID.key)) {
                    // found a parent that needed a loaded child; retain that child
                    retain.set(topmostLoadedID.key, topmostLoadedID);
                    const standIn = this._tiles.get(topmostLoadedID.key);
                    if (standIn) standIn.dashIdealZ = tileID.overscaledZ;
                    break;
                }
            }
        }
    }

    /**
     * Find a loaded parent of the given tile (up to minCoveringZoom)
     * @private
     */
    findLoadedParent(tileID: OverscaledTileID, minCoveringZoom: number): Tile | null | undefined {
        if (this._loadedParentTiles.has(tileID.key)) {
            const parent = this._loadedParentTiles.get(tileID.key);
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

    _getLoadedTile(tileID: OverscaledTileID): Tile | null | undefined {
        const tile = this._tiles.get(tileID.key);
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
            const tiles = new Map<number, Tile>();
            for (const tile of this._tiles.values()) {
                tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
                tiles.set(tile.tileID.key, tile);
            }
            this._tiles = tiles;

            // Reset tile reload timers
            for (const timer of this._timers.values()) clearTimeout(timer);
            this._timers.clear();
            for (const [id, tile] of this._tiles) {
                this._setTileReloadTimer(id, tile);
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
    update(transform: Transform, tileSize?: number, updateForTerrain?: boolean, directionalLight?: vec3, elevatedLayers?: boolean) {
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

        // Tiles acting as shadow casters can be included in the ideal set
        // even though they might not be visible on the screen.
        this._shadowCasterTiles = new Set();

        // Covered is a list of retained tiles who's areas are fully covered by other,
        // better, retained tiles. They are not drawn separately.
        this._coveredTiles = new Set();

        const isBatchedModelType = this._source.type === 'batched-model';
        let idealTileIDs: OverscaledTileID[];

        let maxZoom = this._source.maxzoom;
        // Apply max-source-zoom override (prevents loading tiles above this zoom)
        if (this._maxzoomOverride !== null) {
            maxZoom = Math.min(maxZoom, this._maxzoomOverride);
        }
        const terrain = this.map && this.map.painter ? this.map.painter._terrain : null;
        const sourceUsedForTerrain = terrain && terrain.sourceCache === this;
        if (sourceUsedForTerrain && terrain.attenuationRange()) {
            const minAttenuationZoom = terrain.attenuationRange()[0];
            const demMaxZoom = Math.floor(minAttenuationZoom) - Math.log2(terrain.getDemUpscale());
            if (maxZoom > demMaxZoom) {
                maxZoom = demMaxZoom;
            }
        }

        // When maxzoom override is set, prevent overscaling (don't create overscaledZ > canonical.z tiles)
        const reparseOverscaled = this._maxzoomOverride !== null ? false : this._source.reparseOverscaled;

        if (!this.used && !this.usedForTerrain) {
            idealTileIDs = [];
        } else if (this._source.tileID) {
            idealTileIDs = transform.getVisibleUnwrappedCoordinates((this._source.tileID))
                .map((unwrapped) => new OverscaledTileID(unwrapped.canonical.z, unwrapped.wrap, unwrapped.canonical.z, unwrapped.canonical.x, unwrapped.canonical.y));
        } else if (this.tileCoverLift !== 0.0) {
            // Extended tile cover to load elevated tiles
            const modifiedTransform = transform.clone();
            modifiedTransform.tileCoverLift = this.tileCoverLift;
            idealTileIDs = modifiedTransform.coveringTiles({
                tileSize: tileSize || this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: maxZoom,
                roundZoom: this._source.roundZoom && !updateForTerrain,
                reparseOverscaled,
                isTerrainDEM: this.usedForTerrain,
                calculateQuadrantVisibility: isBatchedModelType
            });

            // Add zoom level 1 tiles to cover area behind globe
            if (this._source.minzoom <= 1.0 && transform.projection.name === 'globe') {
                idealTileIDs.push(new OverscaledTileID(1, 0, 1, 0, 0));
                idealTileIDs.push(new OverscaledTileID(1, 0, 1, 1, 0));
                idealTileIDs.push(new OverscaledTileID(1, 0, 1, 0, 1));
                idealTileIDs.push(new OverscaledTileID(1, 0, 1, 1, 1));
            }
        } else {
            idealTileIDs = transform.coveringTiles({
                tileSize: tileSize || this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: maxZoom,
                roundZoom: this._source.roundZoom && !updateForTerrain,
                reparseOverscaled,
                isTerrainDEM: this.usedForTerrain,
                calculateQuadrantVisibility: isBatchedModelType
            });
        }

        if (idealTileIDs.length > 0 && this.transform.projection.name !== 'globe' &&
            !this.usedForTerrain && !this._supportsFading) {
            // compute desired max zoom level
            const coveringZoom = transform.coveringZoomLevel({
                tileSize: tileSize || this._source.tileSize,
                roundZoom: this._source.roundZoom && !updateForTerrain
            });
            const idealZoom = Math.min(coveringZoom, maxZoom);

            if (isBatchedModelType) {
                const batchedModelTileIDs = transform.extendTileCover(idealTileIDs, idealZoom);
                for (const id of batchedModelTileIDs) {
                    idealTileIDs.push(id);
                }
            } else if (elevatedLayers) {
                const frustum = this.transform.getFrustum(idealZoom);

                const elevatedTileIDs = transform.extendTileCoverToNearPlane(idealTileIDs, frustum, idealZoom);
                for (const id of elevatedTileIDs) {
                    idealTileIDs.push(id);
                }

                // Extend tile cover beyond the ground-level horizon for underground tunnel geometry.
                // Only extend if zoom >= 18 and any already-loaded tile contains tunnel features.
                if (idealZoom >= 18 && this._hasTunnelGeometry()) {
                    const TUNNEL_TILE_COVER_DEPTH = 20.0; // meters
                    const tunnelTileIDs = transform.extendTileCoverForTunnels(idealTileIDs, frustum, idealZoom, TUNNEL_TILE_COVER_DEPTH);
                    for (const id of tunnelTileIDs) {
                        idealTileIDs.push(id);
                    }
                }
            } else if (this.castsShadows && directionalLight) {
                // find shadowCasterTiles
                // Start adding shadow caster extra tiles on zoom 16 to reduce the number of tiles in zoom 15.
                // With this we eliminate extra shadows requests on zoom 15 at the price of a small (tiny)
                // visual deffect.
                const SHADOWS_MIN_ZOOM_EXTRA_TILES = 16.0;
                const shadowCasterTileIDs = transform.extendTileCover(idealTileIDs, idealZoom, directionalLight, SHADOWS_MIN_ZOOM_EXTRA_TILES);
                for (const id of shadowCasterTileIDs) {
                    this._shadowCasterTiles.add(id.key);
                    idealTileIDs.push(id);
                }
            }
        }

        // Reset dash stand-in anchoring; _updateRetainedTiles marks retained
        // parents/children with the ideal overscaledZ they substitute for.
        for (const tile of this._tiles.values()) {
            tile.dashIdealZ = tile.tileID.overscaledZ;
        }

        if (this._source.hasTile) {
            idealTileIDs = idealTileIDs.filter((coord) => this._source.hasTile(coord));
        }

        // Retain is a list of tiles that we shouldn't delete, even if they are not
        // the most ideal tile for the current viewport. This may include tiles like
        // parent or child tiles that are *already* loaded.
        const retain = this._updateRetainedTiles(idealTileIDs);

        if (this._supportsFading && idealTileIDs.length !== 0) {
            const parentsForFading = new Map<number, OverscaledTileID>();
            const fadingTiles = new Set<number>();
            const now = browser.now();
            for (const [id, tileID] of retain) {
                const tile = this._tiles.get(id);
                if (!tile || (tile.fadeEndTime !== undefined && tile.fadeEndTime <= now)) continue;

                // if the tile is loaded but still fading in, find parents to cross-fade with it
                const parentTile = this.findLoadedParent(tileID, Math.max(tileID.overscaledZ - SourceCache.maxOverzooming, this._source.minzoom));
                if (parentTile) {
                    this._addTile(parentTile.tileID);
                    parentsForFading.set(parentTile.tileID.key, parentTile.tileID);
                }

                fadingTiles.add(id);
            }

            // for children tiles with parent tiles still fading in,
            // retain the children so the parent can fade on top
            const minZoom = idealTileIDs.at(-1).overscaledZ;
            for (const [id, childTile] of this._tiles) {
                if (retain.has(id) || !childTile.hasData()) {
                    continue;
                }

                let parentID = childTile.tileID;
                while (parentID.overscaledZ > minZoom) {
                    parentID = parentID.scaledTo(parentID.overscaledZ - 1);
                    const tile = this._tiles.get(parentID.key);
                    if (tile && tile.hasData() && fadingTiles.has(parentID.key)) {
                        retain.set(id, childTile.tileID);
                        break;
                    }
                }
            }

            for (const [id, tileID] of parentsForFading) {
                if (!retain.has(id)) {
                    // If a tile is only needed for fading, mark it as covered so that it isn't rendered on it's own.
                    this._coveredTiles.add(id);
                    retain.set(id, tileID);
                }
            }
        }

        for (const id of retain.keys()) {
            // Make sure retained tiles always clear any existing fade holds
            // so that if they're removed again their fade timer starts fresh.
            this._tiles.get(id).clearFadeHold();
        }

        // Remove the tiles we don't need anymore.
        for (const [id, tile] of this._tiles) {
            if (retain.has(id)) continue;
            if (tile.hasSymbolBuckets && !tile.holdingForFade()) {
                tile.setHoldDuration(this.map._fadeDuration);
            } else if (!tile.hasSymbolBuckets || tile.symbolFadeFinished()) {
                this._removeTile(id);
            }
        }

        // Construct a cache of loaded parents
        this._updateLoadedParentTileCache();

        this._syncPlacementRelations();

        if (this._renderSourceType === RenderSourceType.Symbol && this._source.afterUpdate) {
            this._source.afterUpdate();
        }
    }

    releaseSymbolFadeTiles() {
        let someTileWasRemoved = false;
        for (const [id, tile] of this._tiles) {
            if (tile.holdingForFade()) {
                this._removeTile(id);
                someTileWasRemoved = true;
            }
        }
        if (someTileWasRemoved) {
            this._syncPlacementRelations();
        }
    }

    _updateRetainedTiles(idealTileIDs: Array<OverscaledTileID>): Map<number, OverscaledTileID> {
        const retain = new Map<number, OverscaledTileID>();
        if (idealTileIDs.length === 0) { return retain; }

        const checked = new Set<number>();
        const minZoom = idealTileIDs.reduce((min, id) => Math.min(min, id.overscaledZ), Infinity);
        const maxZoom = idealTileIDs[0].overscaledZ;
        assert(minZoom <= maxZoom);
        const minCoveringZoom = Math.max(maxZoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(maxZoom + SourceCache.maxUnderzooming,  this._source.minzoom);

        const missingTiles = new Set<number>();
        for (const tileID of idealTileIDs) {
            const tile = this._addTile(tileID);

            // retain the tile even if it's not loaded because it's an ideal tile.
            retain.set(tileID.key, tileID);

            if (tile.hasData()) continue;

            if (minZoom < this._source.maxzoom) {
                // save missing tiles that potentially have loaded children
                missingTiles.add(tileID.key);
            }
        }

        // retain any loaded children of ideal tiles up to maxCoveringZoom
        this._retainLoadedChildren(missingTiles, minZoom, maxCoveringZoom, retain);

        // Retain parent tiles that client-side overzoomed raster-array tiles depend on.
        if (this._source.type === 'raster-array') {
            const rasterArraySource = this._source as RasterArrayTileSource;
            const tiles = this._tiles as Map<number, RasterArrayTile>;
            for (const id of rasterArraySource.collectOverzoomParentTileIDs(tiles, idealTileIDs)) {
                retain.set(id.key, id);
            }
        }

        for (const tileID of idealTileIDs) {
            let tile = this._tiles.get(tileID.key);

            if (tile.hasData()) continue;

            // The tile we require is not yet loaded or does not exist;
            // Attempt to find children that fully cover it.

            if (tileID.canonical.z >= this._source.maxzoom) {
                // We're looking for an overzoomed child tile.
                const childCoord = tileID.children(this._source.maxzoom)[0];
                const childTile = this.getTile(childCoord);
                if (!!childTile && childTile.hasData()) {
                    retain.set(childCoord.key, childCoord);
                    childTile.dashIdealZ = tileID.overscaledZ;
                    continue; // tile is covered by overzoomed child
                }
            } else {
                // Check if all 4 immediate children are loaded (in other words, the missing ideal tile is covered)
                const children = tileID.children(this._source.maxzoom);

                if (retain.has(children[0].key) &&
                    retain.has(children[1].key) &&
                    retain.has(children[2].key) &&
                    retain.has(children[3].key)) continue; // tile is covered by children
            }

            // We couldn't find child tiles that entirely cover the ideal tile; look for parents now.

            // As we ascend up the tile pyramid of the ideal tile, we check whether the parent
            // tile has been previously requested (and errored because we only loop over tiles with no data)
            // in order to determine if we need to request its parent.
            let parentWasRequested = tile.wasRequested();

            for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = tileID.scaledTo(overscaledZ);

                // Break parent tile ascent if this route has been previously checked by another child.
                if (checked.has(parentId.key)) break;
                checked.add(parentId.key);

                tile = this.getTile(parentId);
                if (!tile && parentWasRequested) {
                    tile = this._addTile(parentId);
                }
                if (tile) {
                    retain.set(parentId.key, parentId);
                    tile.dashIdealZ = tileID.overscaledZ;
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
        this._loadedParentTiles.clear();

        for (const tile of this._tiles.values()) {
            const path: number[] = [];
            let parentTile: Tile | null | undefined;
            let currentId = tile.tileID;

            // Find the closest loaded ancestor by traversing the tile tree towards the root and
            // caching results along the way
            while (currentId.overscaledZ > 0) {

                // Do we have a cached result from previous traversals?
                if (this._loadedParentTiles.has(currentId.key)) {
                    parentTile = this._loadedParentTiles.get(currentId.key);
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
                this._loadedParentTiles.set(key, parentTile);
            }
        }
    }

    /**
     * Add a tile, given its coordinate, to the pyramid.
     * @private
     */
    _addTile(tileID: OverscaledTileID): Tile {
        let tile: Tile | null | undefined = this._tiles.get(tileID.key);
        const isExtraShadowCaster = this._shadowCasterTiles.has(tileID.key);
        if (tile) {
            if (tile.isExtraShadowCaster === true && !isExtraShadowCaster) {
                // If the tile changed shadow visibility we need to relayout
                this._reloadTile(tileID.key, 'reloading');
            }
            return tile;
        }
        tile = this._cache.getAndRemove(tileID);
        if (tile) {
            this._setTileReloadTimer(tileID.key, tile);
            // set the tileID because the cached tile could have had a different wrap value
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
            // The tile was out of the render set while cached, so new placement has not seen it and
            // its symbols' visibility has gone stale (see Tile#resetPlacementVisibility).
            tile.resetPlacementVisibility();
        }

        const cached = Boolean(tile);
        if (!cached) {
            const painter = this.map ? this.map.painter : null;
            const size = this._source.tileSize * tileID.overscaleFactor();
            const isRasterArray = this._source.type === 'raster-array';

            tile = isRasterArray ?
                createRasterArrayTile(tileID, size, this.transform.tileZoom, painter, this._isRaster) :
                new Tile(tileID, size, this.transform.tileZoom, painter, this._isRaster, this._source.worldview);

            this._loadTile(tile, this._tileLoaded.bind(this, tile, tileID.key, tile.state));
        }

        tile.uses++;
        this._tiles.set(tileID.key, tile);
        if (!cached) this._source.fire(new Event('dataloading', {tile, coord: tile.tileID, dataType: 'source'}));

        return tile;
    }

    _setTileReloadTimer(id: number, tile: Tile) {
        clearTimeout(this._timers.get(id));
        this._timers.delete(id);

        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers.set(id, setTimeout(() => {
                this._reloadTile(id, 'expired');
                this._timers.delete(id);
            }, expiryTimeout));
        }
    }

    /**
     * Remove a tile, given its id, from the pyramid
     * @private
     */
    _removeTile(id: number) {
        const tile = this._tiles.get(id);
        if (!tile)
            return;

        tile.uses--;
        this._tiles.delete(id);
        clearTimeout(this._timers.get(id));
        this._timers.delete(id);

        if (tile.uses > 0)
            return;

        if ((tile.hasData() && tile.state !== 'reloading') || tile.state === 'empty') {
            this._cache.add(tile.tileID, tile, tile.getExpiryTimeout() as number | undefined);
        } else {
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

        for (const id of this._tiles.keys())
            this._removeTile(id);

        if (this._source._clear)
            this._source._clear();

        this._cache.reset();
        this.placementRelations.clear();

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
    tilesIn(
        queryGeometry: QueryGeometry,
        use3DQuery: boolean,
        visualizeQueryGeometry: boolean,
    ): TilespaceQueryGeometry[] {
        const tileResults: TilespaceQueryGeometry[] = [];

        const transform = this.transform;
        if (!transform) return tileResults;

        const isGlobe = transform.projection.name === 'globe';
        const centerX = mercatorXfromLng(transform.center.lng);
        // Camera position is constant across the query; compute it once rather than per tile.
        const cameraMercator = transform.getFreeCameraOptions().position || new MercatorCoordinate(0, 0, 0);

        for (const tile of this._tiles.values()) {
            if (visualizeQueryGeometry) {
                tile.clearQueryDebugViz();
            }
            if (tile.holdingForFade()) {
                // Tiles held for fading are covered by tiles that are closer to ideal
                continue;
            }

            // An array of wrap values for the tile [-1, 0, 1]. The default value is 0 but -1 or 1 wrapping
            // might be required in globe view due to globe's surface being continuous.
            let tilesToCheck: number[];

            if (isGlobe) {
                // Compare distances to copies of the tile to see if a wrapped one should be used.
                const id = tile.tileID.canonical;
                assert(tile.tileID.wrap === 0);

                if (id.z === 0) {
                    // Render the zoom level 0 tile twice as the query polygon might span over the antimeridian
                    const distances = [
                        Math.abs(clamp(centerX, ...tileBoundsX(id, -1)) - centerX),
                        Math.abs(clamp(centerX, ...tileBoundsX(id, 1)) - centerX)
                    ];

                    tilesToCheck = [0, distances.indexOf(Math.min(...distances)) * 2 - 1];
                } else {
                    const distances = [
                        Math.abs(clamp(centerX, ...tileBoundsX(id, -1)) - centerX),
                        Math.abs(clamp(centerX, ...tileBoundsX(id, 0)) - centerX),
                        Math.abs(clamp(centerX, ...tileBoundsX(id, 1)) - centerX)
                    ];

                    tilesToCheck = [distances.indexOf(Math.min(...distances)) - 1];
                }
            } else {
                tilesToCheck = [0];
            }

            for (const wrap of tilesToCheck) {
                const tileResult = queryGeometry.containsTile(tile, transform, use3DQuery, wrap, cameraMercator);
                if (tileResult) {
                    tileResults.push(tileResult);
                }
            }
        }
        return tileResults;
    }

    getShadowCasterCoordinates(): Array<OverscaledTileID> {
        return this._getRenderableCoordinates(false, true);
    }

    getVisibleCoordinates(symbolLayer?: boolean): Array<OverscaledTileID> {
        return this._getRenderableCoordinates(symbolLayer);
    }

    _getRenderableCoordinates(symbolLayer?: boolean, includeShadowCasters?: boolean): Array<OverscaledTileID> {
        if (!this.transform) return []; // HdRoadCoverage caches are created before the first update() sets transform
        const coords = this.getRenderableIds(symbolLayer, includeShadowCasters).map((id) => this._tiles.get(id).tileID);
        const isGlobe = this.transform.projection.name === 'globe';
        for (const coord of coords) {
            coord.projMatrix = this.transform.calculateProjMatrix(coord.toUnwrapped());
            if (isGlobe) {
                coord.expandedProjMatrix = this.transform.calculateProjMatrix(coord.toUnwrapped(), false, true);
            } else {
                coord.expandedProjMatrix = coord.projMatrix;
            }
        }
        return coords;
    }

    sortCoordinatesByDistance(coords: Array<OverscaledTileID>): Array<OverscaledTileID> {
        if (!this.transform) return coords.slice(); // dedicated provider caches may exist before the first update() sets transform
        const sortedCoords = coords.slice();

        const camPos = this.transform._camera.position;
        const camFwd = this.transform._camera.forward();

        const precomputedDistances = new Map<number, number>();

        // Precompute distances of tile center points to the camera plane
        for (const id of sortedCoords) {
            const invTiles = 1.0 / (1 << id.canonical.z);
            const centerX = (id.canonical.x + 0.5) * invTiles + id.wrap;
            const centerY = (id.canonical.y + 0.5) * invTiles;

            precomputedDistances.set(id.key, (centerX - camPos[0]) * camFwd[0] + (centerY - camPos[1]) * camFwd[1] - camPos[2] * camFwd[2]);
        }

        sortedCoords.sort((a, b) => precomputedDistances.get(a.key) - precomputedDistances.get(b.key));
        return sortedCoords;
    }

    hasTransition(): boolean {
        if (this._source.hasTransition()) {
            return true;
        }

        if (this._supportsFading) {
            const now = browser.now();
            for (const tile of this._tiles.values()) {
                if (tile.fadeEndTime !== undefined && tile.fadeEndTime >= now) {
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
    setFeatureState(sourceLayer: string | null | undefined, featureId: number | string, state: FeatureState) {
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
    getFeatureState(sourceLayer: string | null | undefined, featureId: number | string): FeatureState {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        return this._state.getState(sourceLayer, featureId);
    }

    /**
     * Sets the set of keys that the tile depends on. This allows tiles to
     * be reloaded when their dependencies change.
     * @private
     */
    setDependencies(tileKey: number, namespace: string, dependencies: StringifiedImageId[]) {
        const tile = this._tiles.get(tileKey);
        if (tile) {
            tile.setDependencies(namespace, dependencies);
        }
    }

    /**
     * Reloads all tiles that depend on the given keys.
     * @private
     */
    reloadTilesForDependencies(namespaces: Array<string>, keys: StringifiedImageId[]) {
        for (const [id, tile] of this._tiles) {
            if (tile.hasDependency(namespaces, keys)) {
                this._reloadTile(id, 'reloading');
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
    _preloadTiles(transform: Transform | Array<Transform>, callback: Callback<Tile[]>) {
        if (!this._sourceLoaded) {
            const waitUntilSourceLoaded = () => {
                if (!this._sourceLoaded) return;
                this._source.off('data', waitUntilSourceLoaded);
                this._preloadTiles(transform, callback);
            };

            this._source.on('data', waitUntilSourceLoaded);
            return;
        }

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
            const tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor(), this.transform.tileZoom, this.map.painter, this._isRaster, this._source.worldview);
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

function tileBoundsX(id: CanonicalTileID, wrap: number): [number, number] {
    const tiles = 1 << id.z;
    return [id.x / tiles + wrap, (id.x + 1) / tiles + wrap];
}

export default SourceCache;
