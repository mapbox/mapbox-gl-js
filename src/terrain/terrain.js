// @flow

import SourceCache from '../source/source_cache';
import {OverscaledTileID} from '../source/tile_id';
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
import Color from '../style-spec/util/color';
import StencilMode from '../gl/stencil_mode';
import {DepthStencilAttachment} from '../gl/value';
import {drawTerrainRaster, drawTerrainDepth} from './draw_terrain_raster';
import {Elevation} from './elevation';
import Framebuffer from '../gl/framebuffer';

import type Map from '../ui/map';
import type Tile from '../source/tile';
import type Painter from '../render/painter';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type Context from '../gl/context';
import type DEMData from '../data/dem_data';
import type {UniformLocations} from '../render/uniform_binding';
import type Transform from '../geo/transform';
import type {Callback} from '../types/callback';

export const GRID_DIM = 128;

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
    renderedToTile: {[string]: boolean};

    constructor(map: Map) {
        super('proxy', {
            type: 'geojson',
            maxzoom: map.transform.maxZoom
        }, new Dispatcher(getWorkerPool(), null));

        // This source is not to be added as a map source: we use it's tile management.
        // For that, initialize internal structures used for tile cover update.
        this.map = ((this.getSource(): any): GeoJSONSource).map = map;
        this.used = this._sourceLoaded = true;

        this.renderedToTile = {};
    }

    // Override as tile shouldn't go through loading state: always loaded to prevent
    // using stale tiles.
    _loadTile(tile: Tile, callback: Callback<void>) {
        tile.state = 'loaded';
        callback(null);
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

export class Terrain extends Elevation {
    terrainTileForTile: {[string]: Tile};
    painter: Painter;
    sourceCache: SourceCache;
    gridBuffer: VertexBuffer;
    gridIndexBuffer: IndexBuffer;
    gridSegments: SegmentVector;
    gridNoSkirtSegments: SegmentVector;
    proxiedCoords: {[string]: Array<ProxiedTileID>};
    hasCoordOverlap: {[string]: boolean};
    proxyCoords: Array<OverscaledTileID>;
    proxySourceCache: ProxySourceCache;
    renderingToTexture: boolean;
    styleDirty: boolean;
    orthoMatrix: mat4;
    valid: boolean;
    // Order of rendering is such that source tiles draw order has the same proxy
    // as primary sort and zoom level as secondary. Use currentProxyTileKey to
    // track when render advances to next proxy tile.
    currentProxy: string;
    stencilModeForOverlap: StencilMode;
    _exaggeration: number;
    _depthFBO: Framebuffer;
    _depthTexture: Texture;
    _depthDone: boolean;

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
        this.hasCoordOverlap = {};
        this.proxySourceCache = new ProxySourceCache(style.map);
        this.orthoMatrix = mat4.create();
        mat4.ortho(this.orthoMatrix, 0, EXTENT, 0, EXTENT, 0, 1);
        const gl = context.gl;
        this.stencilModeForOverlap = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, 0, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);

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
        const tr = transform;
        tr.updateElevation();
        this.sourceCache.usedForTerrain = true;

        if (this.sourceCache.used) {
            // Use higher resolution for terrain, the same one that is used for hillshade.
            this.sourceCache.update(tr, true);
        } else {
            // Lower tile zoom is sufficient for terrain, given the size of terrain grid.
            const originalZoom = tr.zoom;
            tr.zoom -= tr.scaleZoom(demTileSize / GRID_DIM);
            this.sourceCache.update(tr, true);
            tr.zoom = originalZoom;
        }
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
        // Update draped tiles coordinates.
        const psc = this.proxySourceCache;
        const tr = this.painter.transform;
        const sourceCaches = this.painter.style.sourceCaches;
        psc.update(tr);
        // when zooming in, no need for handling partially loaded tiles to hide holes.
        const coords = this.proxyCoords = this.painter.options.zooming ? psc.getVisibleCoordinates(false) :
            psc.getIds().map((id) => {
                const tileID = psc.getTileByID(id).tileID;
                tileID.posMatrix = tr.calculatePosMatrix(tileID.toUnwrapped());
                return tileID;
            }).reverse();
        coords.forEach((tileID) => {
            if (psc.renderedToTile[tileID.key]) {
                psc.renderedToTile[tileID.key] = false;
            }
        });

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
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

        this.renderingToTexture = false;
        if (this.styleDirty) this.styleDirty = false;
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
    setupElevationDraw(tile: Tile, program: Program<*>, useDepthForOcclusion: ?boolean) {
        const context = this.painter.context;
        const gl = context.gl;
        context.activeTexture.set(gl.TEXTURE2);
        let demTexture = this.painter.emptyTexture;
        const cl = tile.tileID.canonical;
        let uniforms;
        const demTile: Tile = this.terrainTileForTile[tile.tileID.key];
        if (demTile && demTile.demTexture) {
            demTexture = ((demTile.demTexture: any): Texture);
            const demScaleBy = Math.pow(2, demTile.tileID.canonical.z - cl.z);
            assert(demTile.dem);
            uniforms = {
                'u_dem': 2,
                'u_dem_unpack': ((demTile.dem: any): DEMData).getUnpackVector(),
                'u_dem_tl': [tile.tileID.canonical.x * demScaleBy % 1, tile.tileID.canonical.y * demScaleBy % 1],
                'u_dem_scale': demScaleBy,
                'u_dem_size': this.sourceCache.getSource().tileSize,
                'u_exaggeration': this.exaggeration(),
                'u_depth': 3
            };
        } else {
            // If no elevation data, zero dem_unpack in vertex shader is setting sampled elevation to zero.
            uniforms = {
                'u_dem': 2,
                'u_dem_unpack': [0, 0, 0, 0],
                'u_dem_tl': [0, 0],
                'u_dem_scale': 0,
                'u_dem_size': this.sourceCache.getSource().tileSize,
                'u_exaggeration': this.exaggeration(),
                'u_depth': 3
            };
        }
        demTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE, gl.NEAREST);
        if (useDepthForOcclusion) {
            context.activeTexture.set(gl.TEXTURE3);
            this._depthTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE, gl.NEAREST);
        }
        program.setTerrainUniformValues(context, uniforms);
    }

    // If terrain handles layer rendering (rasterize it), return true.
    renderLayer(layer: StyleLayer, sourceCache: SourceCache): boolean {
        const painter = this.painter;
        if (painter.renderPass !== 'translucent') {
            // Depth texture is used only for POI symbols, to skip render of symbols occluded by e.g. hill.
            if (!this._depthDone && layer.type === 'symbol') this.drawDepth();
            return true; // Early leave: all rendering is done in translucent pass.
        }
        if (this._isLayerDrapedOverTerrain(layer)) {
            if (!this.renderingToTexture) {
                this.renderingToTexture = true;
            }
            const proxiedCoords = this.proxiedCoords[layer.source] || this.proxiedCoords[this.proxySourceCache.id];
            const coords = ((proxiedCoords: any): Array<OverscaledTileID>);
            this.currentProxy = '';
            painter.renderLayer(painter, sourceCache, layer, coords);
            if (painter.currentLayer === painter.style._order.length - 1) {
                if (this.renderingToTexture) {
                    this.drawCurrentRTT();
                }
            }
            return true;
        }
        if (this.renderingToTexture) {
            // If there's existing RTT ongoing for previous layers, render it to screen.
            this.drawCurrentRTT();
        }
        return false;
    }

    // Finish current render to texture pass by rendering it to screen.
    drawCurrentRTT() {
        assert(this.renderingToTexture);
        this.renderingToTexture = false;
        const painter = this.painter;
        const context = painter.context;
        const psc = this.proxySourceCache;
        context.bindFramebuffer.set(null);
        context.viewport.set([0, 0, painter.width, painter.height]);
        // Render to screen only tiles that were rendered to.
        const coords = this.proxyCoords.filter(coord => {
            const renderedToTile = psc.renderedToTile[coord.key];
            if (renderedToTile) { psc.renderedToTile[coord.key] = false; }
            return renderedToTile;
        });
        if (coords.length > 0) {
            drawTerrainRaster(painter, this, psc, coords);
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
        const coords = this.proxiedCoords[sourceCache.id] = [];
        const proxys = this.proxyCoords;
        for (let i = 0; i < proxys.length; i++) {
            const proxyTileID = proxys[i];
            const proxied = this._findTileCoveringTileID(proxyTileID, sourceCache);
            if (proxied) {
                coords.push(this._createProxiedId(proxyTileID, proxied));
            }
        }
        let hasOverlap = false;
        for (let i = 0; i < sourceCoords.length; i++) {
            const tile = sourceCache.getTile(sourceCoords[i]);
            if (!tile || !tile.hasData()) continue;
            const proxy = this._findTileCoveringTileID(tile.tileID, this.proxySourceCache);
            // Don't add the tile if already added in loop above.
            if (proxy && proxy.tileID.canonical.z !== tile.tileID.canonical.z) {
                coords.push(this._createProxiedId(proxy.tileID, tile));
                hasOverlap = true;
            }
        }
        hasOverlap = hasOverlap && !sourceCache.getSource().reparseOverscaled;
        this.hasCoordOverlap[sourceCache.id] = hasOverlap;
        if (hasOverlap) {
            coords.sort((a, b) => {
                return a.proxyTileKey === b.proxyTileKey ?
                    b.overscaledZ - a.overscaledZ :
                    a.proxyTileKey < b.proxyTileKey ? -1 : 1;
            });
        }
    }

    _createProxiedId(proxyTileID: OverscaledTileID, tile: Tile): ProxiedTileID {
        let matrix = this.orthoMatrix;
        if (tile.tileID.canonical.key !== proxyTileID.canonical.key) {
            const scale = proxyTileID.canonical.z - tile.tileID.canonical.z;
            assert(scale !== 0);
            matrix = mat4.create();
            let size, xOffset, yOffset;
            if (scale > 0) {
                size = EXTENT >> scale;
                xOffset = size * ((tile.tileID.canonical.x << scale) - proxyTileID.canonical.x);
                yOffset = size * ((tile.tileID.canonical.y << scale) - proxyTileID.canonical.y);
            } else {
                size = EXTENT << -scale;
                xOffset = EXTENT * (tile.tileID.canonical.x - (proxyTileID.canonical.x << -scale));
                yOffset = EXTENT * (tile.tileID.canonical.y - (proxyTileID.canonical.y << -scale));
            }
            mat4.ortho(matrix, 0, size, 0, size, 0, 1);
            mat4.translate(matrix, matrix, [xOffset, yOffset, 0]);
        }
        return new ProxiedTileID(tile.tileID, proxyTileID.key, matrix);
    }

    _findTileCoveringTileID(tileID: OverscaledTileID, sourceCache: SourceCache): ?Tile {
        let sourceTileID;
        const maxzoom = sourceCache.getSource().maxzoom;
        if (tileID.canonical.z >= maxzoom) {
            const downscale = tileID.canonical.z - maxzoom;
            const overscaledZ = sourceCache.getSource().reparseOverscaled ?
                Math.max(tileID.canonical.z + 2, sourceCache.transform.tileZoom) : maxzoom;
            sourceTileID = new OverscaledTileID(overscaledZ, tileID.wrap, maxzoom,
                tileID.canonical.x >> downscale, tileID.canonical.y >> downscale);
        } else {
            sourceTileID = tileID;
        }
        let tile = sourceCache.getTile(sourceTileID);
        if (!tile || !tile.hasData()) {
            tile = sourceCache.findLoadedParent(sourceTileID, 0);
            while (tile && !sourceCache.getTile(tile.tileID)) {
                tile = sourceCache.findLoadedParent(tile.tileID, 0);
            }
        }
        return (tile && tile.hasData()) ? tile : null;
    }

    _getCurrentLayer(): StyleLayer {
        return this.painter.style.getLayer(this.painter.style._order[this.painter.currentLayer]);
    }

    /*
     * Prepare texture and framebuffer for render to texture and bind it for
     * ortho rendering.
     * This method is called within Terrain.renderLayer: there we upcast proxiedCoords
     * to Array<OverscaledTileID> and here we downcast individual tileIds back
     * to ProxiedTileID.
     */
    prepareDrawTile(tileID: OverscaledTileID) {
        if (!this.renderingToTexture) return;
        const proxied = ((tileID: any): ProxiedTileID);
        const key = proxied.proxyTileKey;
        const tile = this.proxySourceCache.getTileByID(key);

        const context = this.painter.context;
        const gl = context.gl;
        const tileSize = tile.tileSize * 2; // *2 is to avoid upscaling bitmap on zoom.

        if (!tile.fbo) {
            context.activeTexture.set(gl.TEXTURE0);
            const texture = new Texture(context, {width: tileSize, height: tileSize, data: null}, gl.RGBA);
            texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

            const fbo = context.createFramebuffer(tileSize, tileSize, false);
            fbo.colorAttachment.set(texture.texture);
            tile.fbo = fbo;
            tile.texture = texture;
        }
        const fbo = tile.fbo;
        context.bindFramebuffer.set(fbo.framebuffer);
        context.viewport.set([0, 0, tileSize, tileSize]);

        // If needed, setup stencilling. Don't bother to remove when there is no
        // more need: in such case, if there is no overlap, stencilling is disabled.
        if (tileID.overscaledZ > tile.tileID.overscaledZ && this.hasCoordOverlap[this._getCurrentLayer().source]) {
            // Overlap is when source tile (the one that gets rendered to proxy) is of higher zoom.
            if (!fbo.depthAttachment) {
                const renderbuffer = context.createRenderbuffer(context.gl.DEPTH_STENCIL, tileSize, tileSize);
                fbo.depthAttachment = new DepthStencilAttachment(context, fbo.framebuffer);
                fbo.depthAttachment.set(renderbuffer);
            }
            if (key !== this.currentProxy) {
                context.clear({stencil: 0});
            }
            this.currentProxy = key;
        }

        if (!this.proxySourceCache.renderedToTile[key]) {
            this.proxySourceCache.renderedToTile[key] = true;
            // Clear on start as previous layers (or pass) have rendered to the same tile.
            context.clear({color: Color.transparent});
        }
    }

    stencilModeForRTTOverlap(coord: OverscaledTileID, sourceCache: SourceCache) {
        if (!this.hasCoordOverlap[sourceCache.id]) return StencilMode.disabled;
        const proxiedTileID = ((coord: any): ProxiedTileID);
        // All source tiles contributing to the same proxy are processed in sequence.
        if (proxiedTileID.proxyTileKey !== this.currentProxy) return StencilMode.disabled;
        this.stencilModeForOverlap.ref = coord.overscaledZ;
        return this.stencilModeForOverlap;
    }
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
    'u_depth': Uniform1i
|};

export const terrainUniforms = (context: Context, locations: UniformLocations): TerrainUniformsType => ({
    'u_dem': new Uniform1i(context, locations.u_dem),
    'u_dem_unpack': new Uniform4f(context, locations.u_dem_unpack),
    'u_dem_tl': new Uniform2f(context, locations.u_dem_tl),
    'u_dem_scale': new Uniform1f(context, locations.u_dem_scale),
    'u_dem_size': new Uniform1f(context, locations.u_dem_size),
    'u_exaggeration': new Uniform1f(context, locations.u_exaggeration),
    'u_depth': new Uniform1i(context, locations.u_depth)
});

