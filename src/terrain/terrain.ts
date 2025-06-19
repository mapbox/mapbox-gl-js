import Point from '@mapbox/point-geometry';
import SourceCache from '../source/source_cache';
import {OverscaledTileID} from '../source/tile_id';
import Tile from '../source/tile';
import posAttributes from '../data/pos_attributes';
import {TriangleIndexArray, PosArray} from '../data/array_types';
import SegmentVector from '../data/segment';
import Texture from '../render/texture';
import {Uniform1i, Uniform1f, Uniform2f, Uniform3f, UniformMatrix4f} from '../render/uniform_binding';
import {prepareDEMTexture} from '../render/draw_hillshade';
import EXTENT from '../style-spec/data/extent';
import {clamp, warnOnce} from '../util/util';
import assert from 'assert';
import {vec3, mat4, vec4} from 'gl-matrix';
import ImageSource from '../source/image_source';
import RasterTileSource from '../source/raster_tile_source';
import VectorTileSource from '../source/vector_tile_source';
import Color from '../style-spec/util/color';
import StencilMode from '../gl/stencil_mode';
import {DepthStencilAttachment} from '../gl/value';
import {drawTerrainRaster} from './draw_terrain_raster';
import {Elevation} from './elevation';
import ColorMode from '../gl/color_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {clippingMaskUniformValues} from '../render/program/clipping_mask_program';
import MercatorCoordinate, {mercatorZfromAltitude} from '../geo/mercator_coordinate';
import browser from '../util/browser';
import {DrapeRenderMode} from '../style/terrain';
import rasterFade from '../render/raster_fade';
import {create as createSource} from '../source/source';
import {Float32Image} from '../util/image';
import {globeMetersToEcef} from '../geo/projection/globe_util';
import {ZoomDependentExpression} from '../style-spec/expression/index';
import {number as interpolate} from '../style-spec/util/interpolate';

import type Framebuffer from '../gl/framebuffer';
import type Program from '../render/program';
import type {Callback} from '../types/callback';
import type {Map} from '../ui/map';
import type Painter from '../render/painter';
import type Style from '../style/style';
import type {TypedStyleLayer} from '../style/style_layer/typed_style_layer';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';
import type {UniformValues} from '../render/uniform_binding';
import type Transform from '../geo/transform';
import type {CanonicalTileID} from '../source/tile_id';
import type {DebugUniformsType} from '../render/program/debug_program';
import type {CircleUniformsType} from '../render/program/circle_program';
import type {SymbolUniformsType} from '../render/program/symbol_program';
import type {SourceSpecification} from '../style-spec/types';
import type {HeatmapUniformsType} from '../render/program/heatmap_program';
import type {LineUniformsType, LinePatternUniformsType} from '../render/program/line_program';
import type {CollisionUniformsType} from '../render/program/collision_program';
import type {GlobeRasterUniformsType} from './globe_raster_program';
import type {TerrainRasterUniformsType} from './terrain_raster_program';
import type {
    FillExtrusionDepthUniformsType,
    FillExtrusionPatternUniformsType
} from '../render/program/fill_extrusion_program';

const GRID_DIM = 128;

const FBO_POOL_SIZE = 5;
const RENDER_CACHE_MAX_SIZE = 50;

type RenderBatch = {
    start: number;
    end: number;
};

type ElevationDrawOptions = {
    useDepthForOcclusion?: boolean;
    useMeterToDem?: boolean;
    labelPlaneMatrixInv?: mat4 | null;
    morphing?: {
        srcDemTile: Tile;
        dstDemTile: Tile;
        phase: number;
    };
    useDenormalizedUpVectorScale?: boolean;
};

type ElevationUniformsType =
    | CircleUniformsType
    | CollisionUniformsType
    | DebugUniformsType
    | FillExtrusionDepthUniformsType
    | FillExtrusionPatternUniformsType
    | GlobeRasterUniformsType
    | GlobeUniformsType
    | HeatmapUniformsType
    | LinePatternUniformsType
    | LineUniformsType
    | SymbolUniformsType
    | TerrainRasterUniformsType;

class MockSourceCache extends SourceCache {
    constructor(map: Map) {
        const sourceSpec: SourceSpecification = {type: 'raster-dem', maxzoom: map.transform.maxZoom};
        const source = createSource('mock-dem', sourceSpec, map.style.dispatcher, map.style);

        super('mock-dem', source, false);

        source.setEventedParent(this);

        this._sourceLoaded = true;
    }

    override _loadTile(tile: Tile, callback: Callback<undefined>) {
        tile.state = 'loaded';
        callback(null);
    }
}

/**
 * Proxy source cache gets ideal screen tile cover coordinates. All the other
 * source caches's coordinates get mapped to subrects of proxy coordinates (or
 * vice versa, subrects of larger tiles from all source caches get mapped to
 * full proxy tile). This happens on every draw call in Terrain.updateTileBinding.
 * Approach is used here for terrain : all the visible source tiles of all the
 * source caches get rendered to proxy source cache textures and then draped over
 * terrain. It is in future reusable for handling overscalling as buckets could be
 * constructed only for proxy tile content, not for full overscalled vector tile.
 */
class ProxySourceCache extends SourceCache {
    renderCache: Array<FBO>;
    renderCachePool: Array<number>;
    proxyCachedFBO: Partial<Record<string | number, Partial<Record<string | number, number>>>>;

    constructor(map: Map) {

        const source = createSource('proxy', {
            type: 'geojson',
            maxzoom: map.transform.maxZoom
        }, map.style.dispatcher, map.style);

        super('proxy', source, false);

        source.setEventedParent(this);

        // This source is not to be added as a map source: we use it's tile management.
        // For that, initialize internal structures used for tile cover update.
        this.map = this.getSource().map = map;
        this.used = this._sourceLoaded = true;
        this.renderCache = [];
        this.renderCachePool = [];
        this.proxyCachedFBO = {};
    }

    // Override for transient nature of cover here: don't cache and retain.
    override update(transform: Transform, tileSize?: number, updateForTerrain?: boolean) {
        if (transform.freezeTileCoverage) { return; }
        this.transform = transform;
        const idealTileIDs = transform.coveringTiles({
            tileSize: this._source.tileSize,
            minzoom: this._source.minzoom,
            maxzoom: this._source.maxzoom,
            roundZoom: this._source.roundZoom,
            reparseOverscaled: this._source.reparseOverscaled
        });

        const incoming: {
            [key: string]: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } = idealTileIDs.reduce<Record<string, any>>((acc, tileID) => {
            acc[tileID.key] = '';
            if (!this._tiles[tileID.key]) {
                const tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor(), transform.tileZoom, undefined, undefined, this._source.worldview);
                tile.state = 'loaded';
                this._tiles[tileID.key] = tile;
            }
            return acc;
        }, {});

        for (const id in this._tiles) {
            if (!(id in incoming)) {
                this.freeFBO(id);
                this._tiles[id].unloadVectorData();
                delete this._tiles[id];
            }
        }
    }

    freeFBO(id: string) {
        const fbos = this.proxyCachedFBO[id];
        if (fbos !== undefined) {
            const fboIds = (Object.values(fbos));
            this.renderCachePool.push(...fboIds);
            delete this.proxyCachedFBO[id];
        }
    }

    deallocRenderCache() {
        this.renderCache.forEach(fbo => fbo.fb.destroy());
        this.renderCache = [];
        this.renderCachePool = [];
        this.proxyCachedFBO = {};
    }
}

/**
 * Canonical, wrap and overscaledZ contain information of original source cache tile.
 * This tile gets ortho-rendered to proxy tile (defined by proxyTileKey).
 * `posMatrix` holds orthographic, scaling and translation information that is used
 * for rendering original tile content to a proxy tile. Proxy tile covers whole
 * or sub-rectangle of the original tile.
 */
class ProxiedTileID extends OverscaledTileID {
    proxyTileKey: number;

    constructor(tileID: OverscaledTileID, proxyTileKey: number, projMatrix: Float32Array) {
        super(tileID.overscaledZ, tileID.wrap, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
        this.proxyTileKey = proxyTileKey;
        this.projMatrix = projMatrix;
    }
}

type OverlapStencilType = false | 'Clip' | 'Mask';
type FBO = {
    fb: Framebuffer;
    tex: Texture;
    dirty: boolean;
};

export class Terrain extends Elevation {
    terrainTileForTile: Partial<Record<number | string, Tile>>;
    prevTerrainTileForTile: Partial<Record<number | string, Tile>>;
    painter: Painter;
    sourceCache: SourceCache;
    gridBuffer: VertexBuffer;
    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;
    gridNoSkirtSegments: SegmentVector;
    proxiedCoords: {
        [fqid: string]: Array<ProxiedTileID>;
    };
    proxyCoords: Array<OverscaledTileID>;
    proxyToSource: {
        [key: number]: {
            [key: string]: Array<ProxiedTileID>;
        };
    };
    proxySourceCache: ProxySourceCache;
    renderingToTexture: boolean;
    _style: Style;
    _mockSourceCache: MockSourceCache;
    orthoMatrix: Float32Array;
    enabled: boolean;
    renderMode: number;

    _visibleDemTiles: Array<Tile>;
    _sourceTilesOverlap: {
        [key: string]: boolean;
    };
    _overlapStencilMode: StencilMode;
    _overlapStencilType: OverlapStencilType;
    _stencilRef: number;

    _exaggeration: number;
    _evaluationZoom: number | null | undefined;
    _attenuationRange: [number, number] | null;
    _previousCameraAltitude: number | null | undefined;
    _previousUpdateTimestamp: number | null | undefined;
    _previousZoom: number;
    _updateTimestamp: number;
    _useVertexMorphing: boolean;
    pool: Array<FBO>;
    renderedToTile: boolean;
    _drapedRenderBatches: Array<RenderBatch>;
    _sharedDepthStencil: WebGLRenderbuffer | null | undefined;

    _findCoveringTileCache: {
        [key: string]: {
            [key: number]: number | null | undefined;
        };
    };

    _tilesDirty: {
        [key: string]: {
            [key: number]: boolean;
        };
    };
    invalidateRenderCache: boolean;

    _emptyDEMTexture: Texture | null | undefined;
    _initializing: boolean | null | undefined;
    _emptyDEMTextureDirty: boolean | null | undefined;

    _pendingGroundEffectLayers: Array<number>;
    framebufferCopyTexture: Texture | null | undefined;

    _debugParams: {
        sortTilesHiZFirst: boolean;
        disableRenderCache: boolean;
    };

    constructor(painter: Painter, style: Style) {
        super();

        this._debugParams = {sortTilesHiZFirst: true, disableRenderCache: false};
        painter.tp.registerParameter(this._debugParams, ["Terrain"], "sortTilesHiZFirst", {}, () => {
            this._style.map.triggerRepaint();
        });
        painter.tp.registerParameter(this._debugParams, ["Terrain"], "disableRenderCache", {}, () => {
            this._style.map.triggerRepaint();
        });
        painter.tp.registerButton(["Terrain"], "Invalidate Render Cache", () => {
            this.invalidateRenderCache = true;
            this._style.map.triggerRepaint();
        });

        this.painter = painter;
        this.terrainTileForTile = {};
        this.prevTerrainTileForTile = {};

        // Terrain rendering grid is 129x129 cell grid, made by 130x130 points.
        // 130 vertices map to 128 DEM data + 1px padding on both sides.
        // DEM texture is padded (1, 1, 1, 1) and padding pixels are backfilled
        // by neighboring tile edges. This way we achieve tile stitching as
        // edge vertices from neighboring tiles evaluate to the same 3D point.
        const [triangleGridArray, triangleGridIndices, skirtIndicesOffset] = createGrid(GRID_DIM + 1);
        const context = painter.context;
        this.gridBuffer = context.createVertexBuffer(triangleGridArray, posAttributes.members);
        this.gridIndexBuffer = context.createIndexBuffer(triangleGridIndices);
        this.gridSegments = SegmentVector.simpleSegment(0, 0, triangleGridArray.length, triangleGridIndices.length);
        this.gridNoSkirtSegments = SegmentVector.simpleSegment(0, 0, triangleGridArray.length, skirtIndicesOffset);
        this.proxyCoords = [];
        this.proxiedCoords = {};
        this._visibleDemTiles = [];
        this._drapedRenderBatches = [];
        this._sourceTilesOverlap = {};
        this.proxySourceCache = new ProxySourceCache(style.map);
        this.orthoMatrix = mat4.create() as Float32Array;
        const epsilon = this.painter.transform.projection.name === 'globe' ?  .015 : 0; // Experimentally the smallest value to avoid rendering artifacts (https://github.com/mapbox/mapbox-gl-js/issues/11975)
        mat4.ortho(this.orthoMatrix, epsilon, EXTENT, 0, EXTENT, 0, 1);
        const gl = context.gl;
        this._overlapStencilMode = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, 0, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
        this._previousZoom = painter.transform.zoom;
        this.pool = [];
        this._findCoveringTileCache = {};
        this._tilesDirty = {};
        this.style = style;
        this._useVertexMorphing = true;
        this._exaggeration = 1;
        this._mockSourceCache = new MockSourceCache(style.map);
        this._pendingGroundEffectLayers = [];
    }

    set style(style: Style) {
        style.on('data', this._onStyleDataEvent.bind(this));
        this._style = style;
        this._style.map.on('moveend', () => {
            this._clearLineLayersFromRenderCache();
        });
    }

    /*
     * Validate terrain and update source cache used for elevation.
     * Explicitly pass transform to update elevation (Transform.updateElevation)
     * before using transform for source cache update.
     */
    update(style: Style, transform: Transform, adaptCameraAltitude: boolean) {
        if (style && style.terrain) {
            if (this._style !== style) {
                this.style = style;
                this._evaluationZoom = undefined;
            }
            const terrainProps = style.terrain.properties;
            const isDrapeModeDeferred = style.terrain.drapeRenderMode === DrapeRenderMode.deferred;
            const zoomDependentExaggeration = style.terrain.isZoomDependent();

            this._previousUpdateTimestamp = this.enabled ? this._updateTimestamp : undefined;
            this._updateTimestamp = browser.now();

            const scope = style.terrain && style.terrain.scope;
            const sourceCacheId = terrainProps.get('source');
            const sourceCache = isDrapeModeDeferred ?
                this._mockSourceCache :

                style.getSourceCache(sourceCacheId, scope);

            if (!sourceCache) {
                warnOnce(`Couldn't find terrain source "${sourceCacheId}".`);
                return;
            }

            this.sourceCache = sourceCache;

            this._attenuationRange = style.terrain.getAttenuationRange();
            this._exaggeration = zoomDependentExaggeration ? this.calculateExaggeration(transform) : terrainProps.get('exaggeration');
            if (!transform.projection.requiresDraping && zoomDependentExaggeration && this._exaggeration === 0) {
                this._disable();
                return;
            }

            this.enabled = true;

            const updateSourceCache = () => {
                if (this.sourceCache.used) {
                    warnOnce(`Raster DEM source '${this.sourceCache.id}' is used both for terrain and as layer source.\n` +
                        'This leads to lower resolution of hillshade. For full hillshade resolution but higher memory consumption, define another raster DEM source.');
                }
                // Lower tile zoom is sufficient for terrain, given the size of terrain grid.
                const scaledDemTileSize = this.getScaledDemTileSize();
                // Dem tile needs to be parent or at least of the same zoom level as proxy tile.
                // Tile cover roundZoom behavior is set to the same as for proxy (false) in SourceCache.update().
                this.sourceCache.update(transform, scaledDemTileSize, true);
                // As a result of update, we get new set of tiles: reset lookup cache.
                this.resetTileLookupCache(this.sourceCache.id);
            };

            if (!this.sourceCache.usedForTerrain) {
                // Init cache entry.
                this.resetTileLookupCache(this.sourceCache.id);
                // When toggling terrain on/off load available terrain tiles from cache
                // before reading elevation at center.
                this.sourceCache.usedForTerrain = true;
                updateSourceCache();
                this._initializing = true;
            }

            updateSourceCache();
            // Camera gets constrained over terrain. Issue constrainCameraOverTerrain = true
            // here to cover potential under terrain situation on data, style, or other camera changes.
            transform.updateElevation(true, adaptCameraAltitude);

            // Reset tile lookup cache and update draped tiles coordinates.
            this.resetTileLookupCache(this.proxySourceCache.id);
            this.proxySourceCache.update(transform);

            this._emptyDEMTextureDirty = true;
            this._previousZoom = transform.zoom;
        } else {
            this._disable();
        }
    }

    calculateExaggeration(transform: Transform): number {
        if (this._attenuationRange && transform.zoom >= Math.ceil(this._attenuationRange[1])) {
            const terrainStyle = this._style.terrain;
            return terrainStyle.getExaggeration(transform.zoom);
        }
        const previousAltitude = this._previousCameraAltitude;
        const altitude = transform.getFreeCameraOptions().position.z / transform.pixelsPerMeter * transform.worldSize;
        this._previousCameraAltitude = altitude;
        // 2 meters as threshold for constant sea elevation movement.
        const altitudeDelta = previousAltitude != null ? (altitude - previousAltitude) : Number.MAX_VALUE;
        if (Math.abs(altitudeDelta) < 2) {
            // Returns current value and avoids any unpleasant terrain change.
            return this._exaggeration;
        }

        const cameraZoom = transform.zoom;

        assert(this._style.terrain);
        const terrainStyle = this._style.terrain;

        if (!this._previousUpdateTimestamp) {
            // covers also 0 (timestamp in render tests is 0).
            return terrainStyle.getExaggeration(cameraZoom);
        }
        let zoomDelta = cameraZoom - this._previousZoom;
        const previousUpdateTimestamp = this._previousUpdateTimestamp;

        let z = cameraZoom;
        if (this._evaluationZoom != null) {
            z = this._evaluationZoom;
            assert(previousAltitude != null);
            // incorporate any difference of _evaluationZoom and real zoom here.
            // Smoothening below resolves flicker.
            if (Math.abs(cameraZoom - z) > 0.5) {
                zoomDelta = 0.5 * (cameraZoom - z + zoomDelta);
            }
            if (zoomDelta * altitudeDelta < 0) {
                // if they have different sign, e.g. zooming in and recenter calculates lower zoom, do not advance.
                z += zoomDelta;
            }
        }
        this._evaluationZoom = z;

        const evaluatedExaggeration = terrainStyle.getExaggeration(z);
        assert(this._previousUpdateTimestamp != null);

        // evaluate if we are in area with fixed exaggeration. 0.1 is random - idea is to
        // interpolate faster to desired value.
        const evaluatedExaggerationLowerZ = terrainStyle.getExaggeration(Math.max(0, z - 0.1));
        const fixedExaggeration = evaluatedExaggeration === evaluatedExaggerationLowerZ;

        const lowExaggerationTreshold = 0.1;
        const exaggerationSmoothTarget = 0.01;
        if (fixedExaggeration && Math.abs(evaluatedExaggeration - this._exaggeration) < exaggerationSmoothTarget) {
            return evaluatedExaggeration;
        }

        // smoothen the changes further to reduce flickering
        let interpolateStrength = Math.min(0.1, (this._updateTimestamp - previousUpdateTimestamp) * 0.00375); // Empiric value, e.g. ~0.06 at 60 FPS
        if (fixedExaggeration || evaluatedExaggeration < lowExaggerationTreshold || Math.abs(zoomDelta) < 0.0001) {
            // interpolate faster, when out of dynamic exaggeration range, near zero or when zooming out/in stops.
            interpolateStrength = Math.min(0.2, interpolateStrength * 4);
        }
        return interpolate(this._exaggeration, evaluatedExaggeration, interpolateStrength);
    }

    resetTileLookupCache(sourceCacheID: string) {
        this._findCoveringTileCache[sourceCacheID] = {};
    }

    attenuationRange(): [number, number] | null {
        return this._attenuationRange;
    }

    getDemUpscale(): number {
        const proxyTileSize = this.proxySourceCache.getSource().tileSize;
        return proxyTileSize / GRID_DIM;
    }

    getScaledDemTileSize(): number {
        const demScale = this.sourceCache.getSource().tileSize / GRID_DIM;
        const proxyTileSize = this.proxySourceCache.getSource().tileSize;
        return demScale * proxyTileSize;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _onStyleDataEvent(event: any) {
        if (event.coord && event.dataType === 'source') {
            this._clearRenderCacheForTile(event.sourceCacheId, event.coord);
        } else if (event.dataType === 'style') {
            this.invalidateRenderCache = true;
            this._evaluationZoom = undefined;
            this._previousUpdateTimestamp = undefined;
            this._previousCameraAltitude = undefined;
        }
    }

    // Terrain
    _disable() {
        if (!this.enabled) return;
        this.enabled = false;
        this._emptyDEMTextureDirty = true;
        this._sharedDepthStencil = undefined;
        this._evaluationZoom = undefined;
        this._previousUpdateTimestamp = undefined;
        this.proxySourceCache.deallocRenderCache();
        if (this._style) {
            for (const id in this._style._mergedSourceCaches) {
                this._style._mergedSourceCaches[id].usedForTerrain = false;
            }
        }
    }

    destroy() {
        this._disable();
        if (this._emptyDEMTexture) this._emptyDEMTexture.destroy();
        this.pool.forEach(fbo => fbo.fb.destroy());
        this.pool = [];
        if (this.framebufferCopyTexture) this.framebufferCopyTexture.destroy();
    }

    // Implements Elevation::_source.
    override _source(): SourceCache | null | undefined {
        return this.enabled ? this.sourceCache : null;
    }

    override isUsingMockSource(): boolean {
        return this.sourceCache === this._mockSourceCache;
    }

    // Implements Elevation::exaggeration.
    override exaggeration(): number {
        return this.enabled ? this._exaggeration : 0;
    }

    override get visibleDemTiles(): Array<Tile> {
        return this._visibleDemTiles;
    }

    get drapeBufferSize(): [number, number] {
        const extent = this.proxySourceCache.getSource().tileSize * 2; // *2 is to avoid upscaling bitmap on zoom.
        return [extent, extent];
    }

    set useVertexMorphing(enable: boolean) {
        this._useVertexMorphing = enable;
    }

    // For every renderable coordinate in every source cache, assign one proxy
    // tile (see _setupProxiedCoordsForOrtho). Mapping of source tile to proxy
    // tile is modeled by ProxiedTileID. In general case, source and proxy tile
    // are of different zoom: ProxiedTileID.projMatrix models ortho, scale and
    // translate from source to proxy. This matrix is used when rendering source
    // tile to proxy tile's texture.
    // One proxy tile can have multiple source tiles, or pieces of source tiles,
    // that get rendered to it.
    // For each proxy tile we assign one terrain tile (_assignTerrainTiles). The
    // terrain tile provides elevation data when rendering (draping) proxy tile
    // texture over terrain grid.
    updateTileBinding(sourcesCoords: {
        [key: string]: Array<OverscaledTileID>;
    }) {
        if (!this.enabled) return;
        this.prevTerrainTileForTile = this.terrainTileForTile;

        const proxySourceCache = this.proxySourceCache;
        const tr = this.painter.transform;
        if (this._initializing) {
            // Don't activate terrain until center tile gets loaded.
            this._initializing = tr._centerAltitude === 0 && this.getAtPointOrZero(MercatorCoordinate.fromLngLat(tr.center), -1) === -1;
            this._emptyDEMTextureDirty = !this._initializing;
        }

        const coords = this.proxyCoords = proxySourceCache.getIds().map((id) => {
            const tileID = proxySourceCache.getTileByID(id).tileID;
            tileID.projMatrix = tr.calculateProjMatrix(tileID.toUnwrapped()) as Float32Array;
            return tileID;
        });
        sortByDistanceToCamera(coords, this.painter);

        const previousProxyToSource = this.proxyToSource || {};
        this.proxyToSource = {};
        coords.forEach((tileID) => {
            this.proxyToSource[tileID.key] = {};
        });

        this.terrainTileForTile = {};
        const sourceCaches = this._style._mergedSourceCaches;

        for (const fqid in sourceCaches) {
            const sourceCache = sourceCaches[fqid];
            if (!sourceCache.used) continue;
            if (sourceCache !== this.sourceCache) this.resetTileLookupCache(sourceCache.id);
            this._setupProxiedCoordsForOrtho(sourceCache, sourcesCoords[fqid], previousProxyToSource);
            if (sourceCache.usedForTerrain) continue;
            const coordinates = sourcesCoords[fqid];
            if (sourceCache.getSource().reparseOverscaled) {
                // Do this for layers that are not rasterized to proxy tile.
                this._assignTerrainTiles(coordinates);
            }
        }

        // Background has no source. Using proxy coords with 1-1 ortho (this.proxiedCoords[proxySourceCache.id])
        // when rendering background to proxy tiles.
        this.proxiedCoords[proxySourceCache.id] = coords.map(tileID => new ProxiedTileID(tileID, tileID.key, this.orthoMatrix));
        this._assignTerrainTiles(coords);
        this._prepareDEMTextures();
        this._setupDrapedRenderBatches();
        this._initFBOPool();
        this._setupRenderCache(previousProxyToSource);

        this.renderingToTexture = false;

        // Gather all dem tiles that are assigned to proxy tiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const visibleKeys: Record<string, any> = {};
        this._visibleDemTiles = [];

        for (const id of this.proxyCoords) {
            const demTile = this.terrainTileForTile[id.key];
            if (!demTile)
                continue;
            const key = demTile.tileID.key;
            if (key in visibleKeys)
                continue;
            this._visibleDemTiles.push(demTile);
            visibleKeys[key] = key;
        }

    }

    _assignTerrainTiles(coords: Array<OverscaledTileID>) {
        if (this._initializing) return;
        coords.forEach((tileID) => {
            if (this.terrainTileForTile[tileID.key]) return;
            const demTile = this._findTileCoveringTileID(tileID, this.sourceCache);
            if (demTile) this.terrainTileForTile[tileID.key] = demTile;
        });
    }

    _prepareDEMTextures() {
        const context = this.painter.context;
        const gl = context.gl;
        for (const key in this.terrainTileForTile) {
            const tile = this.terrainTileForTile[key];
            const dem = tile.dem;
            if (dem && (!tile.demTexture || tile.needsDEMTextureUpload)) {
                context.activeTexture.set(gl.TEXTURE1);
                prepareDEMTexture(this.painter, tile, dem);
            }
        }
    }

    _prepareDemTileUniforms(
        proxyTile: Tile,
        demTile: Tile | null | undefined,
        uniforms: UniformValues<TerrainUniformsType>,
        uniformSuffix?: string | null,
    ): boolean {
        if (!demTile || demTile.demTexture == null)
            return false;

        assert(demTile.dem);
        const proxyId = proxyTile.tileID.canonical;
        const demId = demTile.tileID.canonical;
        const demScaleBy = Math.pow(2, demId.z - proxyId.z);
        const suffix = uniformSuffix || "";
        uniforms[`u_dem_tl${suffix}`] = [proxyId.x * demScaleBy % 1, proxyId.y * demScaleBy % 1];
        uniforms[`u_dem_scale${suffix}`] = demScaleBy;
        return true;
    }

    get emptyDEMTexture(): Texture {
        return !this._emptyDEMTextureDirty && this._emptyDEMTexture ?
            this._emptyDEMTexture : this._updateEmptyDEMTexture();
    }

    _getLoadedAreaMinimum(): number {
        if (!this.enabled) return 0;
        let nonzero = 0;
        const min = this._visibleDemTiles.reduce((acc, tile) => {
            if (!tile.dem) return acc;
            const m = tile.dem.tree.minimums[0];
            acc += m;
            if (m > 0) nonzero++;
            return acc;
        }, 0);
        return nonzero ? min / nonzero : 0;
    }

    _updateEmptyDEMTexture(): Texture {
        const context = this.painter.context;
        const gl = context.gl;
        context.activeTexture.set(gl.TEXTURE2);

        const min = this._getLoadedAreaMinimum();
        const image = new Float32Image({width: 1, height: 1}, new Float32Array([min]));

        this._emptyDEMTextureDirty = false;
        let texture = this._emptyDEMTexture;
        if (!texture) {
            texture = this._emptyDEMTexture = new Texture(context, image, gl.R32F, {premultiply: false});
        } else {
            texture.update(image, {premultiply: false});
        }
        return texture;
    }

    // useDepthForOcclusion: Pre-rendered depth texture is used for occlusion
    // useMeterToDem: u_meter_to_dem uniform is not used for all terrain programs,
    // optimization to avoid unnecessary computation and upload.
    setupElevationDraw(tile: Tile, program: Program<ElevationUniformsType>, options?: ElevationDrawOptions) {
        const context = this.painter.context;
        const gl = context.gl;
        const uniforms = defaultTerrainUniforms();

        uniforms['u_exaggeration'] = this.exaggeration();

        let demTile = null;
        let prevDemTile = null;
        let morphingPhase = 1.0;

        if (options && options.morphing && this._useVertexMorphing) {
            const srcTile = options.morphing.srcDemTile;
            const dstTile = options.morphing.dstDemTile;
            morphingPhase = options.morphing.phase;

            if (srcTile && dstTile) {
                if (this._prepareDemTileUniforms(tile, srcTile, uniforms, "_prev"))
                    prevDemTile = srcTile;
                if (this._prepareDemTileUniforms(tile, dstTile, uniforms))
                    demTile = dstTile;
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const filteringForDemTile = (tile: any) => {
            if (!tile || !tile.demTexture) {
                return gl.NEAREST;
            }

            return this.painter.linearFloatFilteringSupported() ? gl.LINEAR : gl.NEAREST;
        };

        const setDemSizeUniform = (demTexture: Texture) => {
            uniforms['u_dem_size'] = demTexture.size[0] === 1 ? 1 : demTexture.size[0] - 2;
        };

        let demTexture = null;
        if (!this.enabled) {
            demTexture = this.emptyDEMTexture;
        } else if (prevDemTile && demTile) {
            // Both DEM textures are expected to be correctly set if geomorphing is enabled
            demTexture = demTile.demTexture;
            context.activeTexture.set(gl.TEXTURE4);
            (prevDemTile.demTexture).bind(filteringForDemTile(prevDemTile), gl.CLAMP_TO_EDGE);
            uniforms["u_dem_lerp"] = morphingPhase;
        } else {
            demTile = this.terrainTileForTile[tile.tileID.key];
            demTexture = this._prepareDemTileUniforms(tile, demTile, uniforms) ?
                (demTile.demTexture) : this.emptyDEMTexture;
        }
        assert(demTexture);
        context.activeTexture.set(gl.TEXTURE2);
        if (demTexture) {
            setDemSizeUniform(demTexture);
            demTexture.bind(filteringForDemTile(demTile), gl.CLAMP_TO_EDGE);
        }

        this.painter.setupDepthForOcclusion(options && options.useDepthForOcclusion, program, uniforms);

        if (options && options.useMeterToDem && demTile) {
            const meterToDEM = (1 << demTile.tileID.canonical.z) * mercatorZfromAltitude(1, this.painter.transform.center.lat) * this.sourceCache.getSource().tileSize;
            uniforms['u_meter_to_dem'] = meterToDEM;
        }
        if (options && options.labelPlaneMatrixInv) {
            uniforms['u_label_plane_matrix_inv'] = options.labelPlaneMatrixInv as Float32Array;
        }
        program.setTerrainUniformValues(context, uniforms);

        if (this.painter.transform.projection.name === 'globe') {
            const globeUniforms = this.globeUniformValues(this.painter.transform, tile.tileID.canonical, options && options.useDenormalizedUpVectorScale);
            program.setGlobeUniformValues(context, globeUniforms);
        }
    }

    globeUniformValues(
        tr: Transform,
        id: CanonicalTileID,
        useDenormalizedUpVectorScale?: boolean | null,
    ): UniformValues<GlobeUniformsType> {
        const projection = tr.projection;
        return {
            'u_tile_tl_up': projection.upVector(id, 0, 0),
            'u_tile_tr_up': projection.upVector(id, EXTENT, 0),
            'u_tile_br_up': projection.upVector(id, EXTENT, EXTENT),
            'u_tile_bl_up': projection.upVector(id, 0, EXTENT),
            'u_tile_up_scale': useDenormalizedUpVectorScale ? globeMetersToEcef(1) : projection.upVectorScale(id, tr.center.lat, tr.worldSize).metersToTile
        };
    }

    renderToBackBuffer(accumulatedDrapes: Array<OverscaledTileID>) {
        const painter = this.painter;
        const context = this.painter.context;

        if (accumulatedDrapes.length === 0) {
            return;
        }

        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);

        painter.gpuTimingDeferredRenderStart();

        this.renderingToTexture = false;
        drawTerrainRaster(painter, this, this.proxySourceCache, accumulatedDrapes, this._updateTimestamp);
        this.renderingToTexture = true;

        painter.gpuTimingDeferredRenderEnd();

        accumulatedDrapes.splice(0, accumulatedDrapes.length);
    }

    // For each proxy tile, render all layers until the non-draped layer (and
    // render the tile to the screen) before advancing to the next proxy tile.
    // Returns the last drawn index that is used as a start
    // layer for interleaved draped rendering.
    // Apart to layer-by-layer rendering used in 2D, here we have proxy-tile-by-proxy-tile
    // rendering.
    renderBatch(startLayerIndex: number): number {
        if (this._drapedRenderBatches.length === 0) {
            return startLayerIndex + 1;
        }

        this.renderingToTexture = true;
        const painter = this.painter;
        const context = this.painter.context;
        const proxySourceCache = this.proxySourceCache;
        const proxies = this.proxiedCoords[proxySourceCache.id];

        // Consume batch of sequential drape layers and move next
        const drapedLayerBatch = this._drapedRenderBatches.shift();
        assert(drapedLayerBatch.start === startLayerIndex);

        const layerIds = painter.style.order;

        const accumulatedDrapes = [];

        let poolIndex = 0;
        for (const proxy of proxies) {
            // bind framebuffer and assign texture to the tile (texture used in drawTerrainRaster).
            const tile = proxySourceCache.getTileByID(proxy.proxyTileKey);
            const renderCacheIndex = proxySourceCache.proxyCachedFBO[proxy.key] ? proxySourceCache.proxyCachedFBO[proxy.key][startLayerIndex] : undefined;
            const fbo = renderCacheIndex !== undefined ? proxySourceCache.renderCache[renderCacheIndex] : this.pool[poolIndex++];
            const useRenderCache = renderCacheIndex !== undefined;

            tile.texture = fbo.tex;

            if (useRenderCache && !fbo.dirty) {
                // Use cached render from previous pass, no need to render again.
                accumulatedDrapes.push(tile.tileID);
                continue;
            }

            context.bindFramebuffer.set(fbo.fb.framebuffer);
            this.renderedToTile = false; // reset flag.
            if (fbo.dirty) {
                // Clear on start.
                context.clear({color: Color.transparent, stencil: 0});
                fbo.dirty = false;
            }

            let currentStencilSource; // There is no need to setup stencil for the same source for consecutive layers.
            for (let j = drapedLayerBatch.start; j <= drapedLayerBatch.end; ++j) {
                const layer = painter.style._mergedLayers[layerIds[j]];
                const hidden = layer.isHidden(painter.transform.zoom);
                assert(this._style.isLayerDraped(layer) || hidden);
                if (hidden) continue;

                const sourceCache = painter.style.getLayerSourceCache(layer);
                const proxiedCoords = sourceCache ? this.proxyToSource[proxy.key][sourceCache.id] : [proxy];
                if (!proxiedCoords) continue; // when tile is not loaded yet for the source cache.

                const coords = (proxiedCoords as Array<OverscaledTileID>);
                context.viewport.set([0, 0, fbo.fb.width, fbo.fb.height]);
                if (currentStencilSource !== (sourceCache ? sourceCache.id : null)) {
                    this._setupStencil(fbo, proxiedCoords, layer, sourceCache);
                    currentStencilSource = sourceCache ? sourceCache.id : null;
                }
                painter.renderLayer(painter, sourceCache, layer, coords);
            }

            const isLastBatch = this._drapedRenderBatches.length === 0;
            if (isLastBatch) {
                for (const id of this._pendingGroundEffectLayers) {
                    const layer = painter.style._mergedLayers[layerIds[id]];
                    if (layer.isHidden(painter.transform.zoom)) continue;

                    const sourceCache = painter.style.getLayerSourceCache(layer);
                    const proxiedCoords = sourceCache ? this.proxyToSource[proxy.key][sourceCache.id] : [proxy];
                    if (!proxiedCoords) continue;

                    const coords = (proxiedCoords as Array<OverscaledTileID>);
                    context.viewport.set([0, 0, fbo.fb.width, fbo.fb.height]);
                    if (currentStencilSource !== (sourceCache ? sourceCache.id : null)) {
                        this._setupStencil(fbo, proxiedCoords, layer, sourceCache);
                        currentStencilSource = sourceCache ? sourceCache.id : null;
                    }
                    painter.renderLayer(painter, sourceCache, layer, coords);
                }
            }

            if (this.renderedToTile) {
                fbo.dirty = true;
                accumulatedDrapes.push(tile.tileID);
            } else if (!useRenderCache) {
                --poolIndex;
                assert(poolIndex >= 0);
            }
            if (poolIndex === FBO_POOL_SIZE) {
                poolIndex = 0;
                this.renderToBackBuffer(accumulatedDrapes);
            }
        }

        // Reset states and render last drapes
        this.renderToBackBuffer(accumulatedDrapes);
        this.renderingToTexture = false;

        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);

        return drapedLayerBatch.end + 1;
    }

    postRender() {
        // Make sure we consumed all the draped terrain batches at this point
        assert(this._drapedRenderBatches.length === 0);
    }

    isLayerOrderingCorrect(style: Style): boolean {
        const layerCount = style.order.length;

        let drapedMax = -1;
        let immediateMin = layerCount;
        for (let i = 0; i < layerCount; ++i) {
            const layer = style._mergedLayers[style.order[i]];
            if (this._style.isLayerDraped(layer)) {
                drapedMax = Math.max(drapedMax, i);
            } else {
                immediateMin = Math.min(immediateMin, i);
            }
        }

        return immediateMin > drapedMax;
    }

    override getMinElevationBelowMSL(): number {
        let min = 0.0;
        // The maximum DEM error in meters to be conservative (SRTM).
        const maxDEMError = 30.0;
        this._visibleDemTiles.filter(tile => tile.dem).forEach(tile => {
            const minMaxTree = tile.dem.tree;
            min = Math.min(min, minMaxTree.minimums[0]);
        });
        return min === 0.0 ? min : (min - maxDEMError) * this._exaggeration;
    }

    // Performs raycast against visible DEM tiles on the screen and returns the distance travelled along the ray.
    // x & y components of the position are expected to be in normalized mercator coordinates [0, 1] and z in meters.
    override raycast(pos: vec3, dir: vec3, exaggeration: number): number | null | undefined {
        if (!this._visibleDemTiles)
            return null;

        // Perform initial raycasts against root nodes of the available dem tiles
        // and use this information to sort them from closest to furthest.
        const preparedTiles = this._visibleDemTiles.filter(tile => tile.dem).map(tile => {
            const id = tile.tileID;
            const tiles = 1 << id.overscaledZ;
            const {x, y} = id.canonical;

            // Compute tile boundaries in mercator coordinates
            const minx = x / tiles;
            const maxx = (x + 1) / tiles;
            const miny = y / tiles;
            const maxy = (y + 1) / tiles;
            const tree = tile.dem.tree;

            return {
                minx, miny, maxx, maxy,
                t: tree.raycastRoot(minx, miny, maxx, maxy, pos, dir, exaggeration),
                tile
            };
        });

        preparedTiles.sort((a, b) => {
            const at = a.t !== null ? a.t : Number.MAX_VALUE;
            const bt = b.t !== null ? b.t : Number.MAX_VALUE;
            return at - bt;
        });

        for (const obj of preparedTiles) {
            if (obj.t == null)
                return null;

            // Perform more accurate raycast against the dem tree. First intersection is the closest on
            // as all tiles are sorted from closest to furthest
            const tree = obj.tile.dem.tree;
            const t = tree.raycast(obj.minx, obj.miny, obj.maxx, obj.maxy, pos, dir, exaggeration);

            if (t != null)
                return t;
        }

        return null;
    }

    _createFBO(): FBO {
        const painter = this.painter;
        const context = painter.context;
        const gl = context.gl;
        const bufferSize = this.drapeBufferSize;
        context.activeTexture.set(gl.TEXTURE0);
        const tex = new Texture(context, {width: bufferSize[0], height: bufferSize[1], data: null}, gl.RGBA8);
        tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
        const fb = context.createFramebuffer(bufferSize[0], bufferSize[1], true, null);
        fb.colorAttachment.set(tex.texture);
        fb.depthAttachment = new DepthStencilAttachment(context, fb.framebuffer);

        if (this._sharedDepthStencil === undefined) {
            this._sharedDepthStencil = context.createRenderbuffer(context.gl.DEPTH_STENCIL, bufferSize[0], bufferSize[1]);
            this._stencilRef = 0;
            fb.depthAttachment.set(this._sharedDepthStencil);
            context.clear({stencil: 0});
        } else {
            fb.depthAttachment.set(this._sharedDepthStencil);
        }

        if (context.extTextureFilterAnisotropic) {
            gl.texParameterf(gl.TEXTURE_2D,
                context.extTextureFilterAnisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
                context.extTextureFilterAnisotropicMax);
        }

        return {fb, tex, dirty: false};
    }

    _initFBOPool() {
        while (this.pool.length < Math.min(FBO_POOL_SIZE, this.proxyCoords.length)) {
            this.pool.push(this._createFBO());
        }
    }

    _shouldDisableRenderCache(): boolean {
        if (this._debugParams.disableRenderCache) {
            return true;
        }

        // Disable render caches on dynamic events due to fading or transitioning.
        if (this._style.hasLightTransitions()) {
            return true;
        }

        for (const id in this._style._mergedSourceCaches) {
            if (this._style._mergedSourceCaches[id].hasTransition()) {
                return true;
            }
        }

        const isTransitioning = (id: string) => {
            const layer = this._style._mergedLayers[id];
            const isHidden = layer.isHidden(this.painter.transform.zoom);
            if (layer.type === 'hillshade') {
                return !isHidden && layer.shouldRedrape();
            }
            if (layer.type === 'custom') {
                return !isHidden && layer.shouldRedrape();
            }
            return !isHidden && layer.hasTransition();
        };
        return this._style.order.some(isTransitioning);
    }

    _clearLineLayersFromRenderCache() {
        let hasVectorSource = false;
        for (const source of this._style.getSources()) {
            if (source instanceof VectorTileSource) {
                hasVectorSource = true;
                break;
            }
        }

        if (!hasVectorSource) return;

        const clearSourceCaches: Record<string, boolean> = {};
        for (let i = 0; i < this._style.order.length; ++i) {
            const layer = this._style._mergedLayers[this._style.order[i]];
            const sourceCache = this._style.getLayerSourceCache(layer);
            if (!sourceCache || clearSourceCaches[sourceCache.id]) continue;

            const isHidden = layer.isHidden(this.painter.transform.zoom);
            if (isHidden || layer.type !== 'line') continue;

            // Check if layer has a zoom dependent "line-width" expression
            const widthExpression = layer.widthExpression();
            if (!(widthExpression instanceof ZoomDependentExpression)) continue;

            // Mark sourceCache as cleared
            clearSourceCaches[sourceCache.id] = true;
            for (const proxy of this.proxyCoords) {
                const proxiedCoords = this.proxyToSource[proxy.key][sourceCache.id];
                const coords = (proxiedCoords as Array<OverscaledTileID>);
                if (!coords) continue;

                for (const coord of coords) {
                    this._clearRenderCacheForTile(sourceCache.id, coord);
                }
            }
        }
    }

    _clearRasterLayersFromRenderCache() {
        let hasRasterSource = false;
        for (const id in this._style._mergedSourceCaches) {
            if (this._style._mergedSourceCaches[id]._source instanceof RasterTileSource) {
                hasRasterSource = true;
                break;
            }
        }

        if (!hasRasterSource) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const clearSourceCaches: Record<string, any> = {};
        for (let i = 0; i < this._style.order.length; ++i) {
            const layer = this._style._mergedLayers[this._style.order[i]];
            const sourceCache = this._style.getLayerSourceCache(layer);
            if (!sourceCache || clearSourceCaches[sourceCache.id]) continue;

            const isHidden = layer.isHidden(this.painter.transform.zoom);
            if (isHidden || layer.type !== 'raster') continue;

            // Check if any raster tile is in a fading state
            const fadeDuration = layer.paint.get('raster-fade-duration');
            for (const proxy of this.proxyCoords) {
                const proxiedCoords = this.proxyToSource[proxy.key][sourceCache.id];
                const coords = (proxiedCoords as Array<OverscaledTileID>);
                if (!coords) continue;

                for (const coord of coords) {
                    const tile = sourceCache.getTile(coord);
                    const parent = sourceCache.findLoadedParent(coord, 0);

                    const fade = rasterFade(tile, parent, sourceCache, this.painter.transform, fadeDuration);
                    const isFading = fade.opacity !== 1 || fade.mix !== 0;
                    if (isFading) {
                        this._clearRenderCacheForTile(sourceCache.id, coord);
                    }
                }
            }
        }
    }

    _setupDrapedRenderBatches() {
        // It's possible that the draping status of a layer has changed, which requires reordering of the layers
        this._style.updateDrapeFirstLayers();

        const layerIds = this._style.order;
        const layerCount = layerIds.length;
        if (layerCount === 0) {
            return;
        }

        const batches: Array<RenderBatch> = [];
        this._pendingGroundEffectLayers = [];

        let currentLayer = 0;
        let layer = this._style._mergedLayers[layerIds[currentLayer]];
        while (!this._style.isLayerDraped(layer) && layer.isHidden(this.painter.transform.zoom) && ++currentLayer < layerCount) {
            layer = this._style._mergedLayers[layerIds[currentLayer]];
        }

        let batchStart: number | undefined;
        for (; currentLayer < layerCount; ++currentLayer) {
            const layer = this._style._mergedLayers[layerIds[currentLayer]];
            if (layer.isHidden(this.painter.transform.zoom)) {
                continue;
            }
            if (!this._style.isLayerDraped(layer)) {
                if (layer.type === 'fill-extrusion') {
                    this._pendingGroundEffectLayers.push(currentLayer);
                }
                if (batchStart !== undefined) {
                    batches.push({start: batchStart, end: currentLayer - 1});
                    batchStart = undefined;
                }
                continue;
            }
            if (batchStart === undefined) {
                batchStart = currentLayer;
            }
        }

        if (batchStart !== undefined) {
            batches.push({start: batchStart, end: currentLayer - 1});
        }

        // Draped first approach should result in a single or no batch
        assert(batches.length === 1 || batches.length === 0);

        if (batches.length !== 0) {
            const lastBatch = batches[batches.length - 1];
            const groundEffectLayersComeLast = this._pendingGroundEffectLayers.every((id: number) => {
                return id > lastBatch.end;
            });
            if (!groundEffectLayersComeLast) {
                warnOnce('fill-extrusion with flood lighting and/or ground ambient occlusion should be moved to be on top of all draped layers.');
            }
        }

        this._drapedRenderBatches = batches;
    }

    _setupRenderCache(previousProxyToSource: {
        [key: number]: {
            [key: string]: Array<ProxiedTileID>;
        };
    }) {
        const psc = this.proxySourceCache;
        if (this._shouldDisableRenderCache() || this.invalidateRenderCache) {
            this.invalidateRenderCache = false;
            if (psc.renderCache.length > psc.renderCachePool.length) {
                const used = (Object.values(psc.proxyCachedFBO));
                psc.proxyCachedFBO = {};
                for (let i = 0; i < used.length; ++i) {
                    const fbos = (Object.values(used[i]));
                    psc.renderCachePool.push(...fbos);
                }
                assert(psc.renderCache.length === psc.renderCachePool.length);
            }
            return;
        }

        this._clearRasterLayersFromRenderCache();

        const coords = this.proxyCoords;
        const dirty = this._tilesDirty;
        for (let i = coords.length - 1; i >= 0; i--) {
            const proxy = coords[i];
            const tile = psc.getTileByID(proxy.key);

            if (psc.proxyCachedFBO[proxy.key] !== undefined) {
                assert(tile.texture);
                const prev = previousProxyToSource[proxy.key];
                assert(prev);
                // Reuse previous render from cache if there was no change of
                // content that was used to render proxy tile.
                const current = this.proxyToSource[proxy.key];
                let equal = 0;
                for (const source in current) {
                    const tiles = current[source];
                    const prevTiles = prev[source];
                    if (!prevTiles || prevTiles.length !== tiles.length ||
                        tiles.some((t, index) => (t !== prevTiles[index] ||
                            (dirty[source] && dirty[source].hasOwnProperty(t.key)
                            )))
                    ) {
                        equal = -1;
                        break;
                    }
                    ++equal;
                }
                // dirty === false: doesn't need to be rendered to, just use cached render.
                for (const proxyFBO in psc.proxyCachedFBO[proxy.key]) {
                    psc.renderCache[psc.proxyCachedFBO[proxy.key][proxyFBO]].dirty = equal < 0 || equal !== Object.values(prev).length;
                }
            }
        }

        const sortedRenderBatches = [...this._drapedRenderBatches];
        sortedRenderBatches.sort((batchA, batchB) => {
            const batchASize = batchA.end - batchA.start;
            const batchBSize = batchB.end - batchB.start;
            return batchBSize - batchASize;
        });

        for (const batch of sortedRenderBatches) {
            for (const id of coords) {
                if (psc.proxyCachedFBO[id.key]) {
                    continue;
                }

                // Assign renderCache FBO if there are available FBOs in pool.
                let index = psc.renderCachePool.pop();
                if (index === undefined && psc.renderCache.length < RENDER_CACHE_MAX_SIZE) {
                    index = psc.renderCache.length;
                    psc.renderCache.push(this._createFBO());
                }
                if (index !== undefined) {
                    psc.proxyCachedFBO[id.key] = {};
                    psc.proxyCachedFBO[id.key][batch.start] = index;
                    psc.renderCache[index].dirty = true; // needs to be rendered to.
                }
            }
        }
        this._tilesDirty = {};
    }

    _setupStencil(fbo: FBO, proxiedCoords: Array<ProxiedTileID>, layer: TypedStyleLayer, sourceCache?: SourceCache) {
        if (!sourceCache || !this._sourceTilesOverlap[sourceCache.id]) {
            if (this._overlapStencilType) this._overlapStencilType = false;
            return;
        }
        const context = this.painter.context;
        const gl = context.gl;

        // If needed, setup stencilling. Don't bother to remove when there is no
        // more need: in such case, if there is no overlap, stencilling is disabled.
        if (proxiedCoords.length <= 1) { this._overlapStencilType = false; return; }

        let stencilRange;
        if (layer.isTileClipped()) {
            stencilRange = proxiedCoords.length;
            this._overlapStencilMode.test = {func: gl.EQUAL, mask: 0xFF};
            this._overlapStencilType = 'Clip';
        } else if (proxiedCoords[0].overscaledZ > proxiedCoords[proxiedCoords.length - 1].overscaledZ) {
            stencilRange = 1;
            this._overlapStencilMode.test = {func: gl.GREATER, mask: 0xFF};
            this._overlapStencilType = 'Mask';
        } else {
            this._overlapStencilType = false;
            return;
        }
        if (this._stencilRef + stencilRange > 255) {
            context.clear({stencil: 0});
            this._stencilRef = 0;
        }
        this._stencilRef += stencilRange;
        this._overlapStencilMode.ref = this._stencilRef;
        if (layer.isTileClipped()) {
            this._renderTileClippingMasks(proxiedCoords, this._overlapStencilMode.ref);
        }
    }

    clipOrMaskOverlapStencilType(): boolean {
        return this._overlapStencilType === 'Clip' || this._overlapStencilType === 'Mask';
    }

    stencilModeForRTTOverlap(id: OverscaledTileID): Readonly<StencilMode> {
        if (!this.renderingToTexture || !this._overlapStencilType) {
            return StencilMode.disabled;
        }
        // All source tiles contributing to the same proxy are processed in sequence, in zoom descending order.
        // For raster / hillshade overlap masking, ref is based on zoom dif.
        // For vector layer clipping, every tile gets dedicated stencil ref.
        if (this._overlapStencilType === 'Clip') {
            // In immediate 2D mode, we render rects to mark clipping area and handle behavior on tile borders.
            // Here, there is no need for now for this:
            // 1. overlap is handled by proxy render to texture tiles (there is no overlap there)
            // 2. here we handle only brief zoom out semi-transparent color intensity flickering
            //    and that is avoided fine by stenciling primitives as part of drawing (instead of additional tile quad step).
            this._overlapStencilMode.ref = this.painter._tileClippingMaskIDs[id.key];
        } // else this._overlapStencilMode.ref is set to a single value used per proxy tile, in _setupStencil.
        return this._overlapStencilMode;
    }

    _renderTileClippingMasks(proxiedCoords: Array<ProxiedTileID>, ref: number) {
        const painter = this.painter;
        const context = this.painter.context;
        const gl = context.gl;
        painter._tileClippingMaskIDs = {};
        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        const program = painter.getOrCreateProgram('clippingMask');

        for (const tileID of proxiedCoords) {
            const id = painter._tileClippingMaskIDs[tileID.key] = --ref;
            program.draw(painter, gl.TRIANGLES, DepthMode.disabled,
                // Tests will always pass, and ref value will be written to stencil buffer.
                new StencilMode({func: gl.ALWAYS, mask: 0}, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
                ColorMode.disabled, CullFaceMode.disabled, clippingMaskUniformValues(tileID.projMatrix),
                '$clipping', painter.tileExtentBuffer,
                painter.quadTriangleIndexBuffer, painter.tileExtentSegments);
        }
    }

    // Casts a ray from a point on screen and returns the intersection point with the terrain.
    // The returned point contains the mercator coordinates in its first 3 components, and elevation
    // in meter in its 4th coordinate.
    override pointCoordinate(screenPoint: Point): vec4 | null | undefined {
        const transform = this.painter.transform;
        if (screenPoint.x < 0 || screenPoint.x > transform.width ||
            screenPoint.y < 0 || screenPoint.y > transform.height) {
            return null;
        }

        const far: [number, number, number, number] = [screenPoint.x, screenPoint.y, 1, 1];
        vec4.transformMat4(far, far, transform.pixelMatrixInverse);
        vec4.scale(far, far, 1.0 / far[3]);
        // x & y in pixel coordinates, z is altitude in meters
        far[0] /= transform.worldSize;
        far[1] /= transform.worldSize;
        const camera = transform._camera.position;
        const mercatorZScale = mercatorZfromAltitude(1, transform.center.lat);
        const p: [number, number, number, number] = [camera[0], camera[1], camera[2] / mercatorZScale, 0.0];
        const dir = vec3.subtract([] as unknown as vec3, far.slice(0, 3) as vec3, p as unknown as vec3);
        vec3.normalize(dir, dir);

        const exaggeration = this._exaggeration;
        const distanceAlongRay = this.raycast(p as unknown as vec3, dir, exaggeration);

        if (distanceAlongRay === null || !distanceAlongRay) return null;
        vec3.scaleAndAdd(p as unknown as vec3, p as unknown as vec3, dir, distanceAlongRay);
        p[3] = p[2];
        p[2] *= mercatorZScale;
        return p;
    }

    _setupProxiedCoordsForOrtho(
        sourceCache: SourceCache,
        sourceCoords: Array<OverscaledTileID>,
        previousProxyToSource: {
            [key: number]: {
                [key: string]: Array<ProxiedTileID>;
            };
        },
    ): void {
        if (sourceCache.getSource() instanceof ImageSource) {
            return this._setupProxiedCoordsForImageSource(sourceCache, sourceCoords, previousProxyToSource);
        }
        this._findCoveringTileCache[sourceCache.id] = this._findCoveringTileCache[sourceCache.id] || {};
        const coords = this.proxiedCoords[sourceCache.id] = [];
        const proxys = this.proxyCoords;
        for (let i = 0; i < proxys.length; i++) {
            const proxyTileID = proxys[i];
            const proxied = this._findTileCoveringTileID(proxyTileID, sourceCache);
            if (proxied) {
                assert(proxied.hasData());
                const id = this._createProxiedId(proxyTileID, proxied, previousProxyToSource[proxyTileID.key] && previousProxyToSource[proxyTileID.key][sourceCache.id]);
                coords.push(id);
                this.proxyToSource[proxyTileID.key][sourceCache.id] = [id];
            }
        }
        let hasOverlap = false;
        const proxiesToSort = new Set<ProxiedTileID[]>();
        for (let i = 0; i < sourceCoords.length; i++) {
            const tile = sourceCache.getTile(sourceCoords[i]);
            if (!tile || !tile.hasData()) continue;
            const proxy = this._findTileCoveringTileID(tile.tileID, this.proxySourceCache);
            // Don't add the tile if already added in loop above.
            if (proxy && proxy.tileID.canonical.z !== tile.tileID.canonical.z) {
                const array = this.proxyToSource[proxy.tileID.key][sourceCache.id];
                const id = this._createProxiedId(proxy.tileID, tile, previousProxyToSource[proxy.tileID.key] && previousProxyToSource[proxy.tileID.key][sourceCache.id]);
                if (!array) {
                    this.proxyToSource[proxy.tileID.key][sourceCache.id] = [id];
                } else {
                    array.splice(array.length - 1, 0, id);
                }
                const arr = this.proxyToSource[proxy.tileID.key][sourceCache.id];
                if (!proxiesToSort.has(arr)) {
                    proxiesToSort.add(arr);
                }
                coords.push(id);
                hasOverlap = true;
            }
        }
        this._sourceTilesOverlap[sourceCache.id] = hasOverlap;
        if (hasOverlap && this._debugParams.sortTilesHiZFirst) {
            for (const arr of proxiesToSort) {
                arr.sort((a, b) => {
                    return b.overscaledZ - a.overscaledZ;
                });
            }
        }
    }

    _setupProxiedCoordsForImageSource(sourceCache: SourceCache, sourceCoords: Array<OverscaledTileID>, previousProxyToSource: {
        [key: number]: {
            [key: string]: Array<ProxiedTileID>;
        };
    }) {
        if (!sourceCache.getSource().loaded()) return;

        const coords = this.proxiedCoords[sourceCache.id] = [];
        const proxys = this.proxyCoords;
        const imageSource: ImageSource = sourceCache.getSource();
        // Special case where image is rendered outside of the map's bounds (eg. pole caps)
        const tileID = imageSource.tileID;
        if (!tileID) return;

        const anchor = new Point(tileID.x, tileID.y)._div(1 << tileID.z);
        const aabb = imageSource.coordinates.map(MercatorCoordinate.fromLngLat).reduce((acc, coord) => {
            acc.min.x = Math.min(acc.min.x, coord.x - anchor.x);
            acc.min.y = Math.min(acc.min.y, coord.y - anchor.y);
            acc.max.x = Math.max(acc.max.x, coord.x - anchor.x);
            acc.max.y = Math.max(acc.max.y, coord.y - anchor.y);
            return acc;
        }, {min: new Point(Number.MAX_VALUE, Number.MAX_VALUE), max: new Point(-Number.MAX_VALUE, -Number.MAX_VALUE)});

        // Fast conservative check using aabb: content outside proxy tile gets clipped out by on render, anyway.
        const tileOutsideImage = (tileID: OverscaledTileID, imageTileID: OverscaledTileID) => {
            const x = tileID.wrap + tileID.canonical.x / (1 << tileID.canonical.z);
            const y = tileID.canonical.y / (1 << tileID.canonical.z);
            const d = EXTENT / (1 << tileID.canonical.z);

            const ix = imageTileID.wrap + imageTileID.canonical.x / (1 << imageTileID.canonical.z);
            const iy = imageTileID.canonical.y / (1 << imageTileID.canonical.z);

            return x + d < ix + aabb.min.x || x > ix + aabb.max.x || y + d < iy + aabb.min.y || y > iy + aabb.max.y;
        };

        for (let i = 0; i < proxys.length; i++) {
            const proxyTileID = proxys[i];
            for (let j = 0; j < sourceCoords.length; j++) {
                const tile = sourceCache.getTile(sourceCoords[j]);
                if (!tile || !tile.hasData()) continue;

                // Setup proxied -> proxy mapping only if image on given tile wrap intersects the proxy tile.
                if (tileOutsideImage(proxyTileID, tile.tileID)) continue;

                const id = this._createProxiedId(proxyTileID, tile, previousProxyToSource[proxyTileID.key] && previousProxyToSource[proxyTileID.key][sourceCache.id]);
                const array = this.proxyToSource[proxyTileID.key][sourceCache.id];
                if (!array) {
                    this.proxyToSource[proxyTileID.key][sourceCache.id] = [id];
                } else {
                    array.push(id);
                }
                coords.push(id);
            }
        }
    }

    // recycle is previous pass content that likely contains proxied ID combining proxy and source tile.
    _createProxiedId(proxyTileID: OverscaledTileID, tile: Tile, recycle: Array<ProxiedTileID>): ProxiedTileID {
        let matrix = this.orthoMatrix;
        if (recycle) {
            const recycled = recycle.find(proxied => (proxied.key === tile.tileID.key));
            if (recycled) return recycled;
        }
        if (tile.tileID.key !== proxyTileID.key) {
            const scale = proxyTileID.canonical.z - tile.tileID.canonical.z;
            matrix = mat4.create() as Float32Array;
            let size: number, xOffset: number, yOffset: number;
            const wrap = (tile.tileID.wrap - proxyTileID.wrap) << proxyTileID.overscaledZ;
            if (scale > 0) {
                size = EXTENT >> scale;
                xOffset = size * ((tile.tileID.canonical.x << scale) - proxyTileID.canonical.x + wrap);
                yOffset = size * ((tile.tileID.canonical.y << scale) - proxyTileID.canonical.y);
            } else {
                size = EXTENT << -scale;
                xOffset = EXTENT * (tile.tileID.canonical.x - ((proxyTileID.canonical.x + wrap) << -scale));
                yOffset = EXTENT * (tile.tileID.canonical.y - (proxyTileID.canonical.y << -scale));
            }
            mat4.ortho(matrix, 0, size, 0, size, 0, 1);
            mat4.translate(matrix, matrix, [xOffset, yOffset, 0]);
        }
        return new ProxiedTileID(tile.tileID, proxyTileID.key, matrix);
    }

    // A variant of SourceCache.findLoadedParent that considers only visible
    // tiles (and doesn't check SourceCache._cache). Another difference is in
    // caching "not found" results along the lookup, to leave the lookup early.
    // Not found is cached by this._findCoveringTileCache[key] = null;
    _findTileCoveringTileID(tileID: OverscaledTileID, sourceCache: SourceCache): Tile | null | undefined {
        let tile: Tile | null | undefined = sourceCache.getTile(tileID);
        if (tile && tile.hasData()) return tile;

        const lookup = this._findCoveringTileCache[sourceCache.id];
        const key = lookup[tileID.key];
        tile = key ? sourceCache.getTileByID(key) : null;
        if ((tile && tile.hasData()) || key === null) return tile;

        assert(!key || tile);

        let sourceTileID = tile ? tile.tileID : tileID;
        let z = sourceTileID.overscaledZ;
        const minzoom = sourceCache.getSource().minzoom;
        const path = [];
        if (!key) {
            const maxzoom = sourceCache.getSource().maxzoom;
            if (tileID.canonical.z >= maxzoom) {
                const downscale = tileID.canonical.z - maxzoom;
                if (sourceCache.getSource().reparseOverscaled) {
                    z = Math.max(tileID.canonical.z + 2, sourceCache.transform.tileZoom);
                    sourceTileID = new OverscaledTileID(z, tileID.wrap, maxzoom,
                        tileID.canonical.x >> downscale, tileID.canonical.y >> downscale);
                } else if (downscale !== 0) {
                    z = maxzoom;
                    sourceTileID = new OverscaledTileID(z, tileID.wrap, maxzoom,
                        tileID.canonical.x >> downscale, tileID.canonical.y >> downscale);
                }
            }
            if (sourceTileID.key !== tileID.key) {
                path.push(sourceTileID.key);
                tile = sourceCache.getTile(sourceTileID);
            }
        }

        const pathToLookup = (key?: number | null) => {
            path.forEach(id => { lookup[id] = key; });
            path.length = 0;
        };

        for (z = z - 1; z >= minzoom && !(tile && tile.hasData()); z--) {
            if (tile) {
                pathToLookup(tile.tileID.key); // Store lookup to parents not loaded (yet).
            }
            const id = sourceTileID.calculateScaledKey(z);
            tile = sourceCache.getTileByID(id);
            if (tile && tile.hasData()) break;
            const key = lookup[id];
            if (key === null) {
                break; // There's no tile loaded and no point searching further.
            } else if (key !== undefined) {
                tile = sourceCache.getTileByID(key);
                assert(tile);
                continue;
            }
            path.push(id);
        }

        pathToLookup(tile ? tile.tileID.key : null);
        return tile && tile.hasData() ? tile : null;
    }

    override findDEMTileFor(tileID: OverscaledTileID): Tile | null | undefined {
        return this.enabled ? this._findTileCoveringTileID(tileID, this.sourceCache) : null;
    }

    /*
     * Bookkeeping if something gets rendered to the tile.
     */
    prepareDrawTile() {
        this.renderedToTile = true;
    }

    _clearRenderCacheForTile(sourceCacheFQID: string, coord: OverscaledTileID) {
        let sourceTiles = this._tilesDirty[sourceCacheFQID];
        if (!sourceTiles) sourceTiles = this._tilesDirty[sourceCacheFQID] = {};
        sourceTiles[coord.key] = true;
    }
}

function sortByDistanceToCamera(tileIDs: Array<OverscaledTileID>, painter: Painter) {
    const cameraCoordinate = painter.transform.pointCoordinate(painter.transform.getCameraPoint());
    const cameraPoint = new Point(cameraCoordinate.x, cameraCoordinate.y);
    tileIDs.sort((a, b) => {
        if (b.overscaledZ - a.overscaledZ) return b.overscaledZ - a.overscaledZ;
        const aPoint = new Point(a.canonical.x + (1 << a.canonical.z) * a.wrap, a.canonical.y);
        const bPoint = new Point(b.canonical.x + (1 << b.canonical.z) * b.wrap, b.canonical.y);
        const cameraScaled = cameraPoint.mult(1 << a.canonical.z);
        cameraScaled.x -= 0.5;
        cameraScaled.y -= 0.5;
        return cameraScaled.distSqr(aPoint) - cameraScaled.distSqr(bPoint);
    });
}

/**
 * Creates uniform grid of triangles, covering EXTENT x EXTENT square, with two
 * adjustent traigles forming a quad, so that there are |count| columns and rows
 * of these quads in EXTENT x EXTENT square.
 * e.g. for count of 2:
 *  -------------
 *  |    /|    /|
 *  |  /  |  /  |
 *  |/    |/    |
 *  -------------
 *  |    /|    /|
 *  |  /  |  /  |
 *  |/    |/    |
 *  -------------
 * @param {number} count Count of rows and columns
 * @private
 */
function createGrid(count: number): [PosArray, TriangleIndexArray, number] {
    const boundsArray = new PosArray();
    // Around the grid, add one more row/column padding for "skirt".
    const indexArray = new TriangleIndexArray();
    const size = count + 2;
    boundsArray.reserve(size * size);
    indexArray.reserve((size - 1) * (size - 1) * 2);
    const step = EXTENT / (count - 1);
    const gridBound = EXTENT + step / 2;
    const bound = gridBound + step;

    // Skirt offset of 0x5FFF is chosen randomly to encode boolean value (skirt
    // on/off) with x position (max value EXTENT = 4096) to 16-bit signed integer.
    const skirtOffset = 24575; // 0x5FFF
    for (let y = -step; y < bound; y += step) {
        for (let x = -step; x < bound; x += step) {
            const offset = (x < 0 || x > gridBound || y < 0 || y > gridBound) ? skirtOffset : 0;
            const xi = clamp(Math.round(x), 0, EXTENT);
            const yi = clamp(Math.round(y), 0, EXTENT);
            boundsArray.emplaceBack(xi + offset, yi);
        }
    }

    // For cases when there's no need to render "skirt", the "inner" grid indices
    // are followed by skirt indices.
    const skirtIndicesOffset = (size - 3) * (size - 3) * 2;
    const quad = (i: number, j: number) => {
        const index = j * size + i;
        indexArray.emplaceBack(index + 1, index, index + size);
        indexArray.emplaceBack(index + size, index + size + 1, index + 1);
    };
    for (let j = 1; j < size - 2; j++) {
        for (let i = 1; i < size - 2; i++) {
            quad(i, j);
        }
    }
    // Padding (skirt) indices:
    [0, size - 2].forEach(j => {
        for (let i = 0; i < size - 1; i++) {
            quad(i, j);
            quad(j, i);
        }
    });
    return [boundsArray, indexArray, skirtIndicesOffset];
}

export type TerrainUniformsType = {
    ['u_dem']: Uniform1i;
    ['u_dem_prev']: Uniform1i;
    ['u_dem_tl']: Uniform2f;
    ['u_dem_scale']: Uniform1f;
    ['u_dem_tl_prev']: Uniform2f;
    ['u_dem_scale_prev']: Uniform1f;
    ['u_dem_size']: Uniform1f;
    ['u_dem_lerp']: Uniform1f;
    ["u_exaggeration"]: Uniform1f;
    ['u_depth']: Uniform1i;
    ['u_depth_size_inv']: Uniform2f;
    ['u_depth_range_unpack']: Uniform2f;
    ['u_occluder_half_size']: Uniform1f;
    ['u_occlusion_depth_offset']: Uniform1f;
    ['u_meter_to_dem']?: Uniform1f;
    ['u_label_plane_matrix_inv']?: UniformMatrix4f;
};

export const terrainUniforms = (context: Context): TerrainUniformsType => ({
    'u_dem': new Uniform1i(context),
    'u_dem_prev': new Uniform1i(context),
    'u_dem_tl': new Uniform2f(context),
    'u_dem_scale': new Uniform1f(context),
    'u_dem_tl_prev': new Uniform2f(context),
    'u_dem_scale_prev': new Uniform1f(context),
    'u_dem_size': new Uniform1f(context),
    'u_dem_lerp': new Uniform1f(context),
    'u_exaggeration': new Uniform1f(context),
    'u_depth': new Uniform1i(context),
    'u_depth_size_inv': new Uniform2f(context),
    'u_depth_range_unpack': new Uniform2f(context),
    'u_occluder_half_size': new Uniform1f(context),
    'u_occlusion_depth_offset': new Uniform1f(context),
    'u_meter_to_dem': new Uniform1f(context),
    'u_label_plane_matrix_inv': new UniformMatrix4f(context),
});

export function defaultTerrainUniforms(): UniformValues<TerrainUniformsType> {
    return {
        'u_dem': 2,
        'u_dem_prev': 4,
        'u_dem_tl': [0, 0],
        'u_dem_tl_prev': [0, 0],
        'u_dem_scale': 0,
        'u_dem_scale_prev': 0,
        'u_dem_size': 0,
        'u_dem_lerp': 1.0,
        'u_depth': 3,
        'u_depth_size_inv': [0, 0],
        'u_depth_range_unpack': [0, 1],
        'u_occluder_half_size': 16,
        'u_occlusion_depth_offset': -0.0001,
        'u_exaggeration': 0,
    };
}

export type GlobeUniformsType = {
    ['u_tile_tl_up']: Uniform3f;
    ['u_tile_tr_up']: Uniform3f;
    ['u_tile_br_up']: Uniform3f;
    ['u_tile_bl_up']: Uniform3f;
    ['u_tile_up_scale']: Uniform1f;
};

export const globeUniforms = (context: Context): GlobeUniformsType => ({
    'u_tile_tl_up': new Uniform3f(context),
    'u_tile_tr_up': new Uniform3f(context),
    'u_tile_br_up': new Uniform3f(context),
    'u_tile_bl_up': new Uniform3f(context),
    'u_tile_up_scale': new Uniform1f(context)
});
