// @flow

import Point from '@mapbox/point-geometry';
import SourceCache from '../source/source_cache';
import {OverscaledTileID} from '../source/tile_id';
import Tile from '../source/tile';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import {RasterBoundsArray, TriangleIndexArray} from '../data/array_types';
import SegmentVector from '../data/segment';
import Texture from '../render/texture';
import Program from '../render/program';
import {Uniform1i, Uniform1f, Uniform2f, Uniform4f} from '../render/uniform_binding';
import {prepareDEMTexture} from '../render/draw_hillshade';
import EXTENT from '../data/extent';
import {clamp} from '../util/util';
import assert from 'assert';
import {mat4} from 'gl-matrix';
import getWorkerPool from '../util/global_worker_pool';
import Dispatcher from '../util/dispatcher';
import GeoJSONSource from '../source/geojson_source';
import ImageSource from '../source/image_source';
import Color from '../style-spec/util/color';
import StencilMode from '../gl/stencil_mode';
import {DepthStencilAttachment} from '../gl/value';
import {drawTerrainRaster, drawTerrainDepth} from './draw_terrain_raster';
import {Elevation} from './elevation';
import Framebuffer from '../gl/framebuffer';
import ColorMode from '../gl/color_mode';
import DepthMode from '../gl/depth_mode';
import CullFaceMode from '../gl/cull_face_mode';
import {clippingMaskUniformValues} from '../render/program/clipping_mask_program';
import MercatorCoordinate, {mercatorZfromAltitude} from '../geo/mercator_coordinate';

import type Map from '../ui/map';
import type Painter from '../render/painter';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';
import type DEMData from '../data/dem_data';
import type {UniformLocations} from '../render/uniform_binding';
import type Transform from '../geo/transform';

export const GRID_DIM = 128;

const FBO_POOL_SIZE = 5;

// Symbols are draped only for specific cases: see _isLayerDrapedOverTerrain
const drapedLayers = {'fill': true, 'line': true, 'background': true, "hillshade": true, "raster": true};

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
    constructor(map: Map) {
        super('proxy', {
            type: 'geojson',
            maxzoom: map.transform.maxZoom
        }, new Dispatcher(getWorkerPool(), null));

        // This source is not to be added as a map source: we use it's tile management.
        // For that, initialize internal structures used for tile cover update.
        this.map = ((this.getSource(): any): GeoJSONSource).map = map;
        this.used = this._sourceLoaded = true;
    }

    // Override for transient nature of cover here: don't cache and retain.
    update(transform: Transform, _?: boolean) {
        this.transform = transform;
        const idealTileIDs = transform.coveringTiles({
            tileSize: this._source.tileSize,
            minzoom: this._source.minzoom,
            maxzoom: this._source.maxzoom,
            roundZoom: this._source.roundZoom,
            reparseOverscaled: this._source.reparseOverscaled,
            useElevationData: true
        });

        const incoming: {[string]: string} = idealTileIDs.reduce((acc, tileID) => {
            acc[tileID.key] = '';
            if (!this._tiles[tileID.key]) {
                const tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
                tile.state = 'loaded';
                this._tiles[tileID.key] = tile;
            }
            return acc;
        }, {});

        for (const id in this._tiles) {
            if (!(id in incoming)) {
                this._tiles[id].state = 'unloaded';
                delete this._tiles[id];
            }
        }
    }
}

/**
 * Canonical, wrap and overscaledZ contain information of original source cache tile.
 * This tile gets ortho-rendered to proxy tile (defined by proxyTileKey).
 * posMatrix holds orthographic, scaling and translation information that is used
 * for rendering original tile content to a proxy tile. Proxy tile covers whole
 * or sub-rectangle of the original tile.
 */
class ProxiedTileID extends OverscaledTileID {
    proxyTileKey: string;

    constructor(tileID: OverscaledTileID, proxyTileKey: string, posMatrix: Float32Array) {
        super(tileID.overscaledZ, tileID.wrap, tileID.canonical.z, tileID.canonical.x, tileID.canonical.y);
        this.proxyTileKey = proxyTileKey;
        this.posMatrix = posMatrix;
    }
}

type OverlapStencilType = false | 'Clip' | 'Mask';

export class Terrain extends Elevation {
    terrainTileForTile: {[string]: Tile};
    painter: Painter;
    sourceCache: SourceCache;
    gridBuffer: VertexBuffer;
    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;
    gridNoSkirtSegments: SegmentVector;
    proxiedCoords: {[string]: Array<ProxiedTileID>};
    proxyCoords: Array<OverscaledTileID>;
    proxyToSource: {[string]: {[string]: Array<ProxiedTileID>}};
    proxySourceCache: ProxySourceCache;
    renderingToTexture: boolean;
    styleDirty: boolean;
    orthoMatrix: mat4;
    valid: boolean;

    drapeFirst: boolean;
    drapeFirstPending: boolean;
    forceDrapeFirst: boolean; // debugging purpose.

    _sourceTilesOverlap: {[string]: boolean};
    _overlapStencilMode: StencilMode;
    _overlapStencilType: OverlapStencilType;

    _exaggeration: number;
    _depthFBO: Framebuffer;
    _depthTexture: Texture;
    _depthDone: boolean;
    _previousZoom: number;
    pool: Array<{fb: Framebuffer, tex: Texture, dirty: boolean, ref: number}>;
    poolIndex: number;
    renderedToTile: boolean;

    _findCoveringTileCache: {[string]: {[string]: ?string}};

    constructor(painter: Painter, style: Style) {
        super();
        this.painter = painter;

        // Terrain rendering grid is 129x129 cell grid, made by 130x130 points.
        // 130 vertices map to 128 DEM data + 1px padding on both sides.
        // DEM texture is padded (1, 1, 1, 1) and padding pixels are backfilled
        // by neighboring tile edges. This way we achieve tile stitching as
        // edge vertices from neighboring tiles evaluate to the same 3D point.
        const [triangleGridArray, triangleGridIndices, skirtIndicesOffset] = createGrid(GRID_DIM + 1);
        const context = painter.context;
        this.gridBuffer = context.createVertexBuffer(triangleGridArray, rasterBoundsAttributes.members);
        this.gridIndexBuffer = context.createIndexBuffer(triangleGridIndices);
        this.gridSegments = SegmentVector.simpleSegment(0, 0, triangleGridArray.length, triangleGridIndices.length);
        this.gridNoSkirtSegments = SegmentVector.simpleSegment(0, 0, triangleGridArray.length, skirtIndicesOffset);
        this.proxyCoords = [];
        this.proxiedCoords = {};
        this._sourceTilesOverlap = {};
        this.proxySourceCache = new ProxySourceCache(style.map);
        this.orthoMatrix = mat4.create();
        mat4.ortho(this.orthoMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
        const gl = context.gl;
        this._overlapStencilMode = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, 0, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
        this._previousZoom = painter.transform.zoom;
        this.pool = [];
        this._findCoveringTileCache = {};

        style.on('data', (event) => {
            this.styleDirty = this.styleDirty || event.dataType === 'style';
        });
    }

    /*
     * Validate terrain and update source cache used for elevation.
     * Explicitly pass transform to update elevation (Transform.updateElevation)
     * before using transform for source cache update.
     */
    update(style: Style, transform: Transform) {
        const sourceId = style.terrain.properties.get('source');
        this.valid = false;
        if (!sourceId) return console.warn(`Terrain source is not defined.`);
        const sourceCaches = style.sourceCaches;
        this.sourceCache = sourceCaches[sourceId];
        if (!this.sourceCache) return console.warn(`Terrain source "${sourceId}" is not defined.`);
        if (this.sourceCache.getSource().type !== 'raster-dem') {
            return console.warn(`Terrain cannot use source "${sourceId}" for terrain. Only 'raster-dem' source type is supported.`);
        }
        this._exaggeration = style.terrain.properties.get('exaggeration');
        const demTileSize = this.sourceCache.getSource().tileSize;
        this.valid = true;

        const updateSourceCache = () => {
            if (this.sourceCache.used) {
                // Use higher resolution for terrain, the same one that is used for hillshade.
                this.sourceCache.update(transform, true);
            } else {
                // Lower tile zoom is sufficient for terrain, given the size of terrain grid.
                const tr = transform.clone();
                tr.zoom -= tr.scaleZoom(demTileSize / GRID_DIM);
                this.sourceCache.update(tr, true);
            }
        };

        // Ensure there's cache entry:
        this._findCoveringTileCache[this.sourceCache.id] = this._findCoveringTileCache[this.sourceCache.id] || {};
        if (!this.sourceCache.usedForTerrain) {
            // When toggling terrain on/off load available terrain tiles from cache
            // before reading elevation at center.
            this.sourceCache.usedForTerrain = true;
            updateSourceCache();
        }

        transform.updateElevation();
        updateSourceCache();

        // Reset tile lookup caches and update draped tiles coordinates.
        this._findCoveringTileCache = {[this.proxySourceCache.id]: {}, [this.sourceCache.id]: {}};
        this.proxySourceCache.update(transform);

        this._depthDone = false;
    }

    // Implements Elevation::_source.
    _source(): ?SourceCache {
        return this.valid ? this.sourceCache : null;
    }

    // Implements Elevation::exaggeration.
    exaggeration(): number {
        return this._exaggeration;
    }

    // For every renderable coordinate in every source cache, assign one proxy
    // tile (see _setupProxiedCoordsForOrtho). Mapping of source tile to proxy
    // tile is modeled by ProxiedTileID. In general case, source and proxy tile
    // are of different zoom: ProxiedTileID.posMatrix models ortho, scale and
    // translate from source to proxy. This matrix is used when rendering source
    // tile to proxy tile's texture.
    // One proxy tile can have multiple source tiles, or pieces of source tiles,
    // that get rendered to it.
    // For each proxy tile we assign one terrain tile (_assignTerrainTiles). The
    // terrain tile provides elevation data when rendering (draping) proxy tile
    // texture over terrain grid.
    updateTileBinding(sourcesCoords: {[string]: Array<OverscaledTileID>}) {
        if (!this.valid) return;
        this.terrainTileForTile = {};
        this.proxyToSource = {};
        const psc = this.proxySourceCache;
        const tr = this.painter.transform;
        // when zooming in, no need for handling partially loaded tiles to hide holes.
        const coords = this.proxyCoords = this.painter.options.zooming && tr.zoom > this._previousZoom ? psc.getVisibleCoordinates(false) :
            psc.getIds().map((id) => {
                const tileID = psc.getTileByID(id).tileID;
                tileID.posMatrix = tr.calculatePosMatrix(tileID.toUnwrapped());
                return tileID;
            });
        sortByDistanceToCamera(coords, this.painter);
        this._previousZoom = tr.zoom;
        coords.forEach((tileID) => {
            this.proxyToSource[tileID.key] = {};
        });
        const sourceCaches = this.painter.style.sourceCaches;
        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (!sourceCache.getSource().loaded()) continue;
            this._setupProxiedCoordsForOrtho(sourceCache, sourcesCoords[id]);
            if (sourceCache.usedForTerrain) continue;
            const coordinates = sourcesCoords[id];
            if (sourceCache.getSource().reparseOverscaled) {
                // Do this for layers that are not rasterized to proxy tile.
                this._assignTerrainTiles(coordinates);
            }
        }
        // Background has no source. Using proxy coords with 1-1 ortho (this.proxiedCoords[psc.id])
        // when rendering background to proxy tiles.
        this.proxiedCoords[psc.id] = coords.map(tileID => new ProxiedTileID(tileID, tileID.key, this.orthoMatrix));
        this._assignTerrainTiles(coords);
        this._prepareDEMTextures();

        const options = this.painter.options;
        this.drapeFirst = options.zooming || options.moving || options.rotating || this.forceDrapeFirst;
        this.drapeFirstPending = this.drapeFirst;
        this.renderingToTexture = false;
        if (this.styleDirty) this.styleDirty = false;
        this._initFBOPool();
    }

    _assignTerrainTiles(coords: Array<OverscaledTileID>) {
        coords.forEach((tileID) => {
            if (this.terrainTileForTile[tileID.key]) return;
            let demTile = this.sourceCache.getTile(tileID) || this.sourceCache.findLoadedParent(tileID, 0);
            while (demTile && !demTile.dem) {
                demTile = this.sourceCache.findLoadedParent(demTile.tileID, 0);
            }
            if (!demTile || !demTile.dem) return;
            this.sourceCache._addTile(demTile.tileID); // If not in _tiles, promote from _cache to _tiles.
            this.terrainTileForTile[tileID.key] = demTile;
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

    // useDepthForOcclusion: Pre-rendered depth to texture (this._depthTexture) is
    // used to hide (actually moves all object's vertices out of viewport).
    // useMeterToDem: u_meter_to_dem uniform is not used for all terrain programs,
    // optimization to avoid unnecessary computation and upload.
    setupElevationDraw(tile: Tile, program: Program<*>,
        options?: {
            useDepthForOcclusion?: boolean,
            useMeterToDem?: boolean
        }) {
        const context = this.painter.context;
        const gl = context.gl;
        context.activeTexture.set(gl.TEXTURE2);
        let demTexture = this.painter.emptyTexture;
        const cl = tile.tileID.canonical;
        const uniforms = {
            'u_dem': 2,
            'u_dem_unpack': [0, 0, 0, 0],
            'u_dem_tl': [0, 0],
            'u_dem_scale': 0,
            'u_dem_size': this.sourceCache.getSource().tileSize,
            'u_exaggeration': this.exaggeration(),
            'u_depth': 3,
            'u_meter_to_dem': 0
        };

        const demTile: Tile = this.terrainTileForTile[tile.tileID.key];
        if (demTile && demTile.demTexture) {
            demTexture = ((demTile.demTexture: any): Texture);
            const demScaleBy = Math.pow(2, demTile.tileID.canonical.z - cl.z);
            assert(demTile.dem);
            uniforms['u_dem_unpack'] = ((demTile.dem: any): DEMData).getUnpackVector();
            uniforms['u_dem_tl'][0] = tile.tileID.canonical.x * demScaleBy % 1;
            uniforms['u_dem_tl'][1] = tile.tileID.canonical.y * demScaleBy % 1;
            uniforms['u_dem_scale'] = demScaleBy;
        }
        demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE, gl.NEAREST);
        if (options && options.useDepthForOcclusion) {
            context.activeTexture.set(gl.TEXTURE3);
            this._depthTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE, gl.NEAREST);
        }
        if (options && options.useMeterToDem && demTile) {
            const meterToDEM = (1 << demTile.tileID.canonical.z) * mercatorZfromAltitude(1, this.painter.transform.center.lat) * this.sourceCache.getSource().tileSize;
            uniforms['u_meter_to_dem'] = meterToDEM;
        }
        program.setTerrainUniformValues(context, uniforms);
    }

    // If terrain handles layer rendering (rasterize it), return true.
    renderLayer(layer: StyleLayer, _: SourceCache): boolean {
        const painter = this.painter;
        if (painter.renderPass !== 'translucent') {
            // Depth texture is used only for POI symbols, to skip render of symbols occluded by e.g. hill.
            if (!this._depthDone && layer.type === 'symbol') this.drawDepth();
            return true; // Early leave: all rendering is done in translucent pass.
        }
        if (this.drapeFirst && this.drapeFirstPending) {
            this.render();
            this.drapeFirstPending = false;
            return true;
        } else if (this._isLayerDrapedOverTerrain(layer)) {
            if (this.drapeFirst && !this.renderingToTexture) {
                // It's done. nothing to do for this layer but to advance.
                return true;
            }
            this.render();
            return true;
        }
        return false;
    }

    // For each proxy tile, render all layers until the non-draped layer (and
    // render the tile to the screen) before advancing to the next proxy tile.
    // Apart to layer-by-layer rendering used in 2D, here we have proxy-tile-by-proxy-tile
    // rendering.
    render() {
        this.renderingToTexture = true;
        const painter = this.painter;
        const context = this.painter.context;
        const sourceCaches = this.painter.style.sourceCaches;
        const proxies = this.proxiedCoords[this.proxySourceCache.id];
        const start = painter.currentLayer;
        let end = start;
        const layerIds = painter.style._order;

        let j = 0;
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];

            // assign fbo and texture to the tile.
            const tile = this.proxySourceCache.getTileByID(proxy.proxyTileKey);
            this.poolIndex = i % FBO_POOL_SIZE;
            const pool = this.pool[this.poolIndex];
            tile.texture = pool.tex;
            context.bindFramebuffer.set(pool.fb.framebuffer);
            this.renderedToTile = false; // reset flag.
            if (pool.dirty) {
                // Clear on start.
                context.clear({color: Color.transparent});
                pool.dirty = false;
            }

            let currentStencilSource; // There is no need to setup stencil for the same source for consecutive layers.
            for (painter.currentLayer = start; painter.currentLayer < layerIds.length; painter.currentLayer++) {
                const layer = painter.style._layers[layerIds[painter.currentLayer]];
                if (layer.isHidden(painter.transform.zoom)) continue;

                if (this.drapeFirst && !this._isLayerDrapedOverTerrain(layer)) continue;
                if (painter.currentLayer > end) {
                    if (!this._isLayerDrapedOverTerrain(layer)) break;
                    end++;
                }
                const sourceCache = sourceCaches[layer.source];
                const proxiedCoords = sourceCache ? this.proxyToSource[proxy.key][sourceCache.id] : [proxy];
                if (!proxiedCoords) continue; // when tile is not loaded yet for the source cache.
                const coords = ((proxiedCoords: any): Array<OverscaledTileID>);
                context.viewport.set([0, 0, pool.fb.width, pool.fb.height]);
                if (currentStencilSource !== layer.source) {
                    this._setupStencil(proxiedCoords, layer);
                    currentStencilSource = layer.source;
                }
                painter.renderLayer(painter, sourceCache, layer, coords);
            }
            pool.dirty = this.renderedToTile;

            if ((i + 1) % FBO_POOL_SIZE === 0 || i === proxies.length - 1) {
                // End of pool or tiles to render: render prepared to screen.
                const coords = [];
                const psc = this.proxySourceCache;
                for (; j <= i; j++) {
                    if (this.pool[j % FBO_POOL_SIZE].dirty) {
                        const proxy = proxies[j];
                        const tile = psc.getTileByID(proxy.proxyTileKey);
                        coords.push(tile.tileID);
                    }
                }

                if (coords.length > 0) {
                    context.bindFramebuffer.set(null);
                    context.viewport.set([0, 0, painter.width, painter.height]);
                    this.renderingToTexture = false;
                    drawTerrainRaster(painter, this, psc, coords);
                    this.renderingToTexture = true;
                }
            }
        }
        this.renderingToTexture = false;
        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);
        painter.currentLayer = this.drapeFirst ? -1 : end;
        assert(!this.drapeFirst || (start === 0 && painter.currentLayer === -1));
    }

    _initFBOPool() {
        const painter = this.painter;
        const context = painter.context;
        const gl = context.gl;
        while (this.pool.length < Math.min(FBO_POOL_SIZE, this.proxyCoords.length)) {
            const tileSize = this.proxySourceCache.getSource().tileSize * 2; // *2 is to avoid upscaling bitmap on zoom.
            context.activeTexture.set(gl.TEXTURE0);
            const tex = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
            tex.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);
            const fb = context.createFramebuffer(tileSize, tileSize, false);
            fb.colorAttachment.set(tex.texture);
            this.pool.push({fb, tex, dirty: false, ref: 1});
        }
    }

    _setupStencil(proxiedCoords: Array<ProxiedTileID>, layer: StyleLayer) {
        if (!this._sourceTilesOverlap[layer.source]) {
            if (this._overlapStencilType) this._overlapStencilType = false;
            return;
        }
        const context = this.painter.context;
        const gl = context.gl;

        // If needed, setup stencilling. Don't bother to remove when there is no
        // more need: in such case, if there is no overlap, stencilling is disabled.
        if (proxiedCoords.length <= 1) { this._overlapStencilType = false; return; }

        const pool = this.pool[this.poolIndex];
        const fbo = pool.fb;
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
        if (!fbo.depthAttachment) {
            const renderbuffer = context.createRenderbuffer(context.gl.DEPTH_STENCIL, fbo.width, fbo.height);
            fbo.depthAttachment = new DepthStencilAttachment(context, fbo.framebuffer);
            fbo.depthAttachment.set(renderbuffer);
            context.clear({stencil: 0});
        }
        if (pool.ref + stencilRange > 256) {
            context.clear({stencil: 0});
            pool.ref = 0;
        }
        pool.ref += stencilRange;
        this._overlapStencilMode.ref = pool.ref;
        if (layer.isTileClipped()) {
            this._renderTileClippingMasks(proxiedCoords, this._overlapStencilMode.ref);
        }
    }

    stencilModeForRTTOverlap(id: OverscaledTileID) {
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

        const program = painter.useProgram('clippingMask');

        for (const tileID of proxiedCoords) {
            const id = painter._tileClippingMaskIDs[tileID.key] = --ref;
            program.draw(context, gl.TRIANGLES, DepthMode.disabled,
                // Tests will always pass, and ref value will be written to stencil buffer.
                new StencilMode({func: gl.ALWAYS, mask: 0}, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
                ColorMode.disabled, CullFaceMode.disabled, clippingMaskUniformValues(tileID.posMatrix),
                '$clipping', painter.tileExtentBuffer,
                painter.quadTriangleIndexBuffer, painter.tileExtentSegments);
        }
    }

    drawDepth() {
        const painter = this.painter;
        const context = painter.context;
        const psc = this.proxySourceCache;

        const width = Math.ceil(painter.width), height = Math.ceil(painter.height);
        if (this._depthFBO && (this._depthFBO.width !== width || this._depthFBO.height !== height)) {
            this._depthFBO.destroy();
            delete this._depthFBO;
            delete this._depthTexture;
        }
        if (!this._depthFBO) {
            const gl = context.gl;
            const fbo = context.createFramebuffer(width, height, true);
            context.activeTexture.set(gl.TEXTURE0);
            const texture = new Texture(context, {width, height, data: null}, gl.RGBA);
            texture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            fbo.colorAttachment.set(texture.texture);
            const renderbuffer = context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, width, height);
            fbo.depthAttachment.set(renderbuffer);
            this._depthFBO = fbo;
            this._depthTexture = texture;
        }
        context.bindFramebuffer.set(this._depthFBO.framebuffer);
        context.viewport.set([0, 0, width, height]);

        drawTerrainDepth(painter, this, psc, this.proxyCoords);
        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);

        this._depthDone = true;
    }

    _isLayerDrapedOverTerrain(styleLayer: StyleLayer): boolean {
        if (!this.valid) return false;
        return drapedLayers.hasOwnProperty(styleLayer.type);
    }

    _setupProxiedCoordsForOrtho(sourceCache: SourceCache, sourceCoords: Array<OverscaledTileID>) {
        if (sourceCache.getSource() instanceof ImageSource) {
            return this._setupProxiedCoordsForImageSource(sourceCache, sourceCoords);
        }
        this._findCoveringTileCache[sourceCache.id] = this._findCoveringTileCache[sourceCache.id] || {};
        const coords = this.proxiedCoords[sourceCache.id] = [];
        const proxys = this.proxyCoords;
        for (let i = 0; i < proxys.length; i++) {
            const proxyTileID = proxys[i];
            const proxied = this._findTileCoveringTileID(proxyTileID, sourceCache);
            if (proxied) {
                assert(proxied.hasData());
                const id = this._createProxiedId(proxyTileID, proxied);
                coords.push(id);
                this.proxyToSource[proxyTileID.key][sourceCache.id] = [id];
            }
        }
        let hasOverlap = false;
        for (let i = 0; i < sourceCoords.length; i++) {
            const tile = sourceCache.getTile(sourceCoords[i]);
            if (!tile || !tile.hasData()) continue;
            const proxy = this._findTileCoveringTileID(tile.tileID, this.proxySourceCache);
            // Don't add the tile if already added in loop above.
            if (proxy && proxy.tileID.canonical.z !== tile.tileID.canonical.z) {
                const array = this.proxyToSource[proxy.tileID.key][sourceCache.id];
                const id = this._createProxiedId(proxy.tileID, tile);
                if (!array) {
                    this.proxyToSource[proxy.tileID.key][sourceCache.id] = [id];
                } else {
                    // The last element is parent added in loop above. This way we get
                    // a list in Z descending order which is needed for stencil masking.
                    array.splice(array.length - 1, 0, id);
                }
                coords.push(id);
                hasOverlap = true;
            }
        }
        this._sourceTilesOverlap[sourceCache.id] = hasOverlap;
    }

    _setupProxiedCoordsForImageSource(sourceCache: SourceCache, sourceCoords: Array<OverscaledTileID>) {
        const coords = this.proxiedCoords[sourceCache.id] = [];
        const proxys = this.proxyCoords;
        const imageSource: ImageSource = ((sourceCache.getSource(): any): ImageSource);

        const anchor = new Point(imageSource.tileID.x, imageSource.tileID.y)._div(1 << imageSource.tileID.z);
        const aabb = imageSource.coordinates.map(MercatorCoordinate.fromLngLat).reduce((acc, coord) => {
            acc.min.x = Math.min(acc.min.x, coord.x - anchor.x);
            acc.min.y = Math.min(acc.min.y, coord.y - anchor.y);
            acc.max.x = Math.max(acc.max.x, coord.x - anchor.x);
            acc.max.y = Math.max(acc.max.y, coord.y - anchor.y);
            return acc;
        }, {min: new Point(Number.MAX_VALUE, Number.MAX_VALUE), max: new Point(-Number.MAX_VALUE, -Number.MAX_VALUE)});

        // Fast conservative check using aabb: content outside proxy tile gets clipped out by on render, anyway.
        const tileOutsideImage = (tileID, imageTileID) => {
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

                const id = this._createProxiedId(proxyTileID, tile);
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

    _createProxiedId(proxyTileID: OverscaledTileID, tile: Tile): ProxiedTileID {
        let matrix = this.orthoMatrix;
        if (tile.tileID.key !== proxyTileID.key) {
            const scale = proxyTileID.canonical.z - tile.tileID.canonical.z;
            matrix = mat4.create();
            let size, xOffset, yOffset;
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
    _findTileCoveringTileID(tileID: OverscaledTileID, sourceCache: SourceCache): ?Tile {
        let tile = sourceCache.getTile(tileID);
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

        const pathToLookup = (key) => {
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

    findDEMTileFor(tileID: OverscaledTileID): ?Tile {
        return this._findTileCoveringTileID(tileID, this.sourceCache);
    }

    /*
     * Bookkeeping if something gets rendered to the tile.
     */
    prepareDrawTile(_: OverscaledTileID) {
        if (!this.renderedToTile) {
            this.renderedToTile = true;
        }
    }
}

function sortByDistanceToCamera(tileIDs, painter) {
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
function createGrid(count: number): [RasterBoundsArray, TriangleIndexArray, number] {
    const boundsArray = new RasterBoundsArray();
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
            boundsArray.emplaceBack(xi + offset, yi, xi, yi);
        }
    }

    // For cases when there's no need to render "skirt", the "inner" grid indices
    // are followed by skirt indices.
    const skirtIndicesOffset = (size - 3) * (size - 3) * 2;
    const quad = (i, j) => {
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

export type TerrainUniformsType = {|
    'u_dem': Uniform1i,
    'u_dem_unpack': Uniform4f,
    'u_dem_tl': Uniform2f,
    'u_dem_scale': Uniform1f,
    'u_dem_size': Uniform1f,
    "u_exaggeration": Uniform1f,
    'u_depth': Uniform1i,
    'u_meter_to_dem': Uniform1f
|};

export const terrainUniforms = (context: Context, locations: UniformLocations): TerrainUniformsType => ({
    'u_dem': new Uniform1i(context, locations.u_dem),
    'u_dem_unpack': new Uniform4f(context, locations.u_dem_unpack),
    'u_dem_tl': new Uniform2f(context, locations.u_dem_tl),
    'u_dem_scale': new Uniform1f(context, locations.u_dem_scale),
    'u_dem_size': new Uniform1f(context, locations.u_dem_size),
    'u_exaggeration': new Uniform1f(context, locations.u_exaggeration),
    'u_depth': new Uniform1i(context, locations.u_depth),
    'u_meter_to_dem': new Uniform1f(context, locations.u_meter_to_dem)
});

