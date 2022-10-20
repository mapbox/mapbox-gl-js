// @flow

import browser from '../util/browser.js';
import window from '../util/window.js';

import {mat4} from 'gl-matrix';
import SourceCache from '../source/source_cache.js';
import EXTENT from '../data/extent.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import SegmentVector from '../data/segment.js';
import {PosArray, TileBoundsArray, TriangleIndexArray, LineStripIndexArray} from '../data/array_types.js';
import {values} from '../util/util.js';
import {isMapAuthenticated} from '../util/mapbox.js';
import posAttributes from '../data/pos_attributes.js';
import boundsAttributes from '../data/bounds_attributes.js';
import ProgramConfiguration from '../data/program_configuration.js';
import CrossTileSymbolIndex from '../symbol/cross_tile_symbol_index.js';
import shaders from '../shaders/shaders.js';
import Program from './program.js';
import {programUniforms} from './program/program_uniforms.js';
import Context from '../gl/context.js';
import {fogUniformValues} from '../render/fog.js';
import DepthMode from '../gl/depth_mode.js';
import StencilMode from '../gl/stencil_mode.js';
import ColorMode from '../gl/color_mode.js';
import CullFaceMode from '../gl/cull_face_mode.js';
import Texture from './texture.js';
import {clippingMaskUniformValues} from './program/clipping_mask_program.js';
import Color from '../style-spec/util/color.js';
import symbol from './draw_symbol.js';
import circle from './draw_circle.js';
import assert from 'assert';
import heatmap from './draw_heatmap.js';
import line from './draw_line.js';
import fill from './draw_fill.js';
import fillExtrusion from './draw_fill_extrusion.js';
import hillshade from './draw_hillshade.js';
import raster from './draw_raster.js';
import background from './draw_background.js';
import debug, {drawDebugPadding, drawDebugQueryGeometry} from './draw_debug.js';
import custom from './draw_custom.js';
import sky from './draw_sky.js';
import drawAtmosphere from './draw_atmosphere.js';
import {GlobeSharedBuffers, globeToMercatorTransition} from '../geo/projection/globe_util.js';
import {AtmosphereBuffer} from '../render/atmosphere_buffer.js';
import {Terrain} from '../terrain/terrain.js';
import {Debug} from '../util/debug.js';
import Tile from '../source/tile.js';
import {RGBAImage} from '../util/image.js';

const draw = {
    symbol,
    circle,
    heatmap,
    line,
    fill,
    'fill-extrusion': fillExtrusion,
    hillshade,
    raster,
    background,
    sky,
    debug,
    custom
};

import type Transform from '../geo/transform.js';
import type {OverscaledTileID, UnwrappedTileID} from '../source/tile_id.js';
import type Style from '../style/style.js';
import type StyleLayer from '../style/style_layer.js';
import type {CrossFaded} from '../style/properties.js';
import type ImageManager from './image_manager.js';
import type GlyphManager from './glyph_manager.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../gl/types.js';
import type ResolvedImage from '../style-spec/expression/types/resolved_image.js';
import type {DynamicDefinesType} from './program/program_uniforms.js';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent' | 'sky';
export type CanvasCopyInstances = {
    canvasCopies: WebGLTexture[],
    timeStamps: number[]
}

type PainterOptions = {
    showOverdrawInspector: boolean,
    showTileBoundaries: boolean,
    showTerrainWireframe: boolean,
    showQueryGeometry: boolean,
    showTileAABBs: boolean,
    showPadding: boolean,
    rotating: boolean,
    zooming: boolean,
    moving: boolean,
    gpuTiming: boolean,
    gpuTimingDeferredRender: boolean,
    fadeDuration: number,
    isInitialLoad: boolean,
    speedIndexTiming: boolean
}

type TileBoundsBuffers = {|
  tileBoundsBuffer: VertexBuffer,
  tileBoundsIndexBuffer: IndexBuffer,
  tileBoundsSegments: SegmentVector,
|};

type GPUTimers = {[layerId: string]: any};

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {
    context: Context;
    transform: Transform;
    _tileTextures: {[_: number]: Array<Texture> };
    numSublayers: number;
    depthEpsilon: number;
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    tileExtentBuffer: VertexBuffer;
    tileExtentSegments: SegmentVector;
    debugBuffer: VertexBuffer;
    debugIndexBuffer: IndexBuffer;
    debugSegments: SegmentVector;
    viewportBuffer: VertexBuffer;
    viewportSegments: SegmentVector;
    quadTriangleIndexBuffer: IndexBuffer;
    mercatorBoundsBuffer: VertexBuffer;
    mercatorBoundsSegments: SegmentVector;
    _tileClippingMaskIDs: {[_: number]: number };
    stencilClearMode: StencilMode;
    style: Style;
    options: PainterOptions;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    depthRangeFor3D: DepthRangeType;
    opaquePassCutoff: number;
    frameCounter: number;
    renderPass: RenderPass;
    currentLayer: number;
    currentStencilSource: ?string;
    nextStencilID: number;
    id: string;
    _showOverdrawInspector: boolean;
    cache: {[_: string]: Program<*> };
    crossTileSymbolIndex: CrossTileSymbolIndex;
    symbolFadeChange: number;
    gpuTimers: GPUTimers;
    deferredRenderGpuTimeQueries: Array<any>;
    emptyTexture: Texture;
    identityMat: Float32Array;
    debugOverlayTexture: Texture;
    debugOverlayCanvas: HTMLCanvasElement;
    _terrain: ?Terrain;
    globeSharedBuffers: ?GlobeSharedBuffers;
    atmosphereBuffer: AtmosphereBuffer;
    tileLoaded: boolean;
    frameCopies: Array<WebGLTexture>;
    loadTimeStamps: Array<number>;
    _backgroundTiles: {[key: number]: Tile};

    constructor(gl: WebGLRenderingContext, transform: Transform) {
        this.context = new Context(gl);
        this.transform = transform;
        this._tileTextures = {};
        this.frameCopies = [];
        this.loadTimeStamps = [];

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.crossTileSymbolIndex = new CrossTileSymbolIndex();

        this.deferredRenderGpuTimeQueries = [];
        this.gpuTimers = {};
        this.frameCounter = 0;
        this._backgroundTiles = {};
    }

    updateTerrain(style: Style, cameraChanging: boolean) {
        const enabled = !!style && !!style.terrain && this.transform.projection.supportsTerrain;
        if (!enabled && (!this._terrain || !this._terrain.enabled)) return;
        if (!this._terrain) {
            this._terrain = new Terrain(this, style);
        }
        const terrain: Terrain = this._terrain;
        this.transform.elevation = enabled ? terrain : null;
        terrain.update(style, this.transform, cameraChanging);
    }

    _updateFog(style: Style) {
        // Globe makes use of thin fog overlay with a fixed fog range,
        // so we can skip updating fog tile culling for this projection
        const isGlobe = this.transform.projection.name === 'globe';

        const fog = style.fog;
        if (!fog || isGlobe || fog.getOpacity(this.transform.pitch) < 1 || fog.properties.get('horizon-blend') < 0.03) {
            this.transform.fogCullDistSq = null;
            return;
        }

        // We start culling where the fog opacity function hits
        // 98% which leaves a non-noticeable change threshold.
        const [start, end] = fog.getFovAdjustedRange(this.transform._fov);

        if (start > end) {
            this.transform.fogCullDistSq = null;
            return;
        }

        const fogBoundFraction = 0.78;
        const fogCullDist = start + (end - start) * fogBoundFraction;

        this.transform.fogCullDistSq = fogCullDist * fogCullDist;
    }

    get terrain(): ?Terrain {
        return this.transform._terrainEnabled() && this._terrain && this._terrain.enabled ? this._terrain : null;
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     */
    resize(width: number, height: number) {
        this.width = width * browser.devicePixelRatio;
        this.height = height * browser.devicePixelRatio;
        this.context.viewport.set([0, 0, this.width, this.height]);

        if (this.style) {
            for (const layerId of this.style.order) {
                this.style._layers[layerId].resize();
            }
        }
    }

    setup() {
        const context = this.context;

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        this.tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(EXTENT, EXTENT);
        this.debugBuffer = context.createVertexBuffer(debugArray, posAttributes.members);
        this.debugSegments = SegmentVector.simpleSegment(0, 0, 4, 5);

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(-1, -1);
        viewportArray.emplaceBack(1, -1);
        viewportArray.emplaceBack(-1, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
        this.viewportSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const tileBoundsArray = new TileBoundsArray();
        tileBoundsArray.emplaceBack(0, 0, 0, 0);
        tileBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        tileBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        tileBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.mercatorBoundsBuffer = context.createVertexBuffer(tileBoundsArray, boundsAttributes.members);
        this.mercatorBoundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);

        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(0, 1, 2);
        quadTriangleIndices.emplaceBack(2, 1, 3);
        this.quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);

        const tileLineStripIndices = new LineStripIndexArray();
        for (const i of [0, 1, 3, 2, 0]) tileLineStripIndices.emplaceBack(i);
        this.debugIndexBuffer = context.createIndexBuffer(tileLineStripIndices);

        this.emptyTexture = new Texture(context,
            new RGBAImage({width: 1, height: 1}, Uint8Array.of(0, 0, 0, 0)), context.gl.RGBA);

        this.identityMat = mat4.create();

        const gl = this.context.gl;
        this.stencilClearMode = new StencilMode({func: gl.ALWAYS, mask: 0}, 0x0, 0xFF, gl.ZERO, gl.ZERO, gl.ZERO);
        this.loadTimeStamps.push(window.performance.now());

        this.atmosphereBuffer = new AtmosphereBuffer(this.context);
    }

    getMercatorTileBoundsBuffers(): TileBoundsBuffers {
        return {
            tileBoundsBuffer: this.mercatorBoundsBuffer,
            tileBoundsIndexBuffer: this.quadTriangleIndexBuffer,
            tileBoundsSegments: this.mercatorBoundsSegments
        };
    }

    getTileBoundsBuffers(tile: Tile): TileBoundsBuffers {
        tile._makeTileBoundsBuffers(this.context, this.transform.projection);
        if (tile._tileBoundsBuffer) {
            const tileBoundsBuffer = tile._tileBoundsBuffer;
            const tileBoundsIndexBuffer = tile._tileBoundsIndexBuffer;
            const tileBoundsSegments = tile._tileBoundsSegments;
            return {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments};
        } else {
            return this.getMercatorTileBoundsBuffers();
        }
    }

    /*
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const context = this.context;
        const gl = context.gl;

        this.nextStencilID = 1;
        this.currentStencilSource = undefined;
        this._tileClippingMaskIDs = {};

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: once an upstream patch lands, remove
        // this function in favor of context.clear({ stencil: 0x0 })
        this.useProgram('clippingMask').draw(context, gl.TRIANGLES,
            DepthMode.disabled, this.stencilClearMode, ColorMode.disabled, CullFaceMode.disabled,
            clippingMaskUniformValues(this.identityMat),
            '$clipping', this.viewportBuffer,
            this.quadTriangleIndexBuffer, this.viewportSegments);
    }

    resetStencilClippingMasks() {
        if (!this.terrain) {
            this.currentStencilSource = undefined;
            this._tileClippingMaskIDs = {};
        }
    }

    _renderTileClippingMasks(layer: StyleLayer, sourceCache?: SourceCache, tileIDs?: Array<OverscaledTileID>) {
        if (!sourceCache || this.currentStencilSource === sourceCache.id || !layer.isTileClipped() || !tileIDs || tileIDs.length === 0) {
            return;
        }

        if (this._tileClippingMaskIDs && !this.terrain) {
            let dirtyStencilClippingMasks = false;
            // Equivalent tile set is already rendered in stencil
            for (const coord of tileIDs) {
                if (this._tileClippingMaskIDs[coord.key] === undefined) {
                    dirtyStencilClippingMasks = true;
                    break;
                }
            }
            if (!dirtyStencilClippingMasks) {
                return;
            }
        }

        this.currentStencilSource = sourceCache.id;

        const context = this.context;
        const gl = context.gl;

        if (this.nextStencilID + tileIDs.length > 256) {
            // we'll run out of fresh IDs so we need to clear and start from scratch
            this.clearStencil();
        }

        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);

        const program = this.useProgram('clippingMask');

        this._tileClippingMaskIDs = {};

        for (const tileID of tileIDs) {
            const tile = sourceCache.getTile(tileID);
            const id = this._tileClippingMaskIDs[tileID.key] = this.nextStencilID++;
            const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = this.getTileBoundsBuffers(tile);

            program.draw(context, gl.TRIANGLES, DepthMode.disabled,
            // Tests will always pass, and ref value will be written to stencil buffer.
            new StencilMode({func: gl.ALWAYS, mask: 0}, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE),
            ColorMode.disabled, CullFaceMode.disabled, clippingMaskUniformValues(tileID.projMatrix),
            '$clipping', tileBoundsBuffer,
            tileBoundsIndexBuffer, tileBoundsSegments);
        }
    }

    stencilModeFor3D(): StencilMode {
        this.currentStencilSource = undefined;

        if (this.nextStencilID + 1 > 256) {
            this.clearStencil();
        }

        const id = this.nextStencilID++;
        const gl = this.context.gl;
        return new StencilMode({func: gl.NOTEQUAL, mask: 0xFF}, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    stencilModeForClipping(tileID: OverscaledTileID): $ReadOnly<StencilMode>  {
        if (this.terrain) return this.terrain.stencilModeForRTTOverlap(tileID);
        const gl = this.context.gl;
        return new StencilMode({func: gl.EQUAL, mask: 0xFF}, this._tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }

    /*
     * Sort coordinates by Z as drawing tiles is done in Z-descending order.
     * All children with the same Z write the same stencil value.  Children
     * stencil values are greater than parent's.  This is used only for raster
     * and raster-dem tiles, which are already clipped to tile boundaries, to
     * mask area of tile overlapped by children tiles.
     * Stencil ref values continue range used in _tileClippingMaskIDs.
     *
     * Returns [StencilMode for tile overscaleZ map, sortedCoords].
     */
    stencilConfigForOverlap(tileIDs: Array<OverscaledTileID>): [{[_: number]: $ReadOnly<StencilMode>}, Array<OverscaledTileID>] {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;
        if (stencilValues > 1) {
            this.currentStencilSource = undefined;
            if (this.nextStencilID + stencilValues > 256) {
                this.clearStencil();
            }
            const zToStencilMode = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilMode[i + minTileZ] = new StencilMode({func: gl.GEQUAL, mask: 0xFF}, i + this.nextStencilID, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID += stencilValues;
            return [zToStencilMode, coords];
        }
        return [{[minTileZ]: StencilMode.disabled}, coords];
    }

    colorModeForRenderPass(): $ReadOnly<ColorMode> {
        const gl = this.context.gl;
        if (this._showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    depthModeForSublayer(n: number, mask: DepthMaskType, func: ?DepthFuncType): $ReadOnly<DepthMode> {
        if (!this.opaquePassEnabledForLayer()) return DepthMode.disabled;
        const depth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        return new DepthMode(func || this.context.gl.LEQUAL, mask, [depth, depth]);
    }

    /*
     * The opaque pass and 3D layers both use the depth buffer.
     * Layers drawn above 3D layers need to be drawn using the
     * painter's algorithm so that they appear above 3D features.
     * This returns true for layers that can be drawn using the
     * opaque pass.
     */
    opaquePassEnabledForLayer(): boolean {
        return this.currentLayer < this.opaquePassCutoff;
    }

    render(style: Style, options: PainterOptions) {
        this.style = style;
        this.options = options;

        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

        this.imageManager.beginFrame();

        const layerIds = this.style.order;
        const sourceCaches = this.style._sourceCaches;

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }
        }

        const coordsAscending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescendingSymbol: {[_: string]: Array<OverscaledTileID>} = {};

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            coordsAscending[id] = sourceCache.getVisibleCoordinates();
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
        }

        this.opaquePassCutoff = Infinity;
        for (let i = 0; i < layerIds.length; i++) {
            const layerId = layerIds[i];
            if (this.style._layers[layerId].is3D()) {
                this.opaquePassCutoff = i;
                break;
            }
        }

        if (this.terrain) {
            this.terrain.updateTileBinding(coordsDescendingSymbol);
            // All render to texture is done in translucent pass to remove need
            // for depth buffer allocation per tile.
            this.opaquePassCutoff = 0;
        }

        if (this.transform.projection.name === 'globe' && !this.globeSharedBuffers) {
            this.globeSharedBuffers = new GlobeSharedBuffers(this.context);
        }

        // Following line is billing related code. Do not change. See LICENSE.txt
        if (!isMapAuthenticated(this.context.gl)) return;

        // Offscreen pass ===============================================
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        this.renderPass = 'offscreen';

        for (const layerId of layerIds) {
            const layer = this.style._layers[layerId];
            const sourceCache = style._getLayerSourceCache(layer);
            if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) continue;

            const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;
            if (!(layer.type === 'custom' || layer.isSky()) && !(coords && coords.length)) continue;

            this.renderLayer(this, sourceCache, layer, coords);
        }

        this.depthRangeFor3D = [0, 1 - ((style.order.length + 2) * this.numSublayers * this.depthEpsilon)];

        // Terrain depth offscreen render pass ==========================
        // With terrain on, renders the depth buffer into a texture.
        // This texture is used for occlusion testing (labels)
        if (this.terrain && (this.style.hasSymbolLayers() || this.style.hasCircleLayers())) {
            this.terrain.drawDepth();
        }

        // Rebind the main framebuffer now that all offscreen layers have been rendered:
        this.context.bindFramebuffer.set(null);
        this.context.viewport.set([0, 0, this.width, this.height]);

        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1});
        this.clearStencil();

        this._showOverdrawInspector = options.showOverdrawInspector;

        // Opaque pass ===============================================
        // Draw opaque layers top-to-bottom first.
        this.renderPass = 'opaque';

        if (!this.terrain) {
            for (this.currentLayer = layerIds.length - 1; this.currentLayer >= 0; this.currentLayer--) {
                const layer = this.style._layers[layerIds[this.currentLayer]];
                const sourceCache = style._getLayerSourceCache(layer);
                if (layer.isSky()) continue;
                const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;

                this._renderTileClippingMasks(layer, sourceCache, coords);
                this.renderLayer(this, sourceCache, layer, coords);
            }
        }

        if (this.style.fog && this.transform.projection.supportsFog) {
            drawAtmosphere(this, this.style.fog);
        }

        // Sky pass ======================================================
        // Draw all sky layers bottom to top.
        // They are drawn at max depth, they are drawn after opaque and before
        // translucent to fail depth testing and mix with translucent objects.
        this.renderPass = 'sky';
        const isTransitioning = globeToMercatorTransition(this.transform.zoom) > 0.0;
        if ((isTransitioning || this.transform.projection.name !== 'globe') && this.transform.isHorizonVisible()) {
            for (this.currentLayer = 0; this.currentLayer < layerIds.length; this.currentLayer++) {
                const layer = this.style._layers[layerIds[this.currentLayer]];
                const sourceCache = style._getLayerSourceCache(layer);
                if (!layer.isSky()) continue;
                const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;

                this.renderLayer(this, sourceCache, layer, coords);
            }
        }

        // Translucent pass ===============================================
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';

        this.currentLayer = 0;
        while (this.currentLayer < layerIds.length) {
            const layer = this.style._layers[layerIds[this.currentLayer]];
            const sourceCache = style._getLayerSourceCache(layer);

            // Nothing to draw in translucent pass for sky layers, advance
            if (layer.isSky()) {
                ++this.currentLayer;
                continue;
            }

            // With terrain on and for draped layers only, issue rendering and progress
            // this.currentLayer until the next non-draped layer.
            // Otherwise we interleave terrain draped render with non-draped layers on top
            if (this.terrain && this.style.isLayerDraped(layer)) {
                if (layer.isHidden(this.transform.zoom)) {
                    ++this.currentLayer;
                    continue;
                }
                const terrain = (((this.terrain): any): Terrain);
                const prevLayer = this.currentLayer;
                this.currentLayer = terrain.renderBatch(this.currentLayer);
                assert(this.context.bindFramebuffer.current === null);
                assert(this.currentLayer > prevLayer);
                continue;
            }

            // For symbol layers in the translucent pass, we add extra tiles to the renderable set
            // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
            // separate clipping masks
            const coords = sourceCache ?
                (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[sourceCache.id] :
                undefined;

            this._renderTileClippingMasks(layer, sourceCache, sourceCache ? coordsAscending[sourceCache.id] : undefined);
            this.renderLayer(this, sourceCache, layer, coords);

            ++this.currentLayer;
        }

        if (this.terrain) {
            this.terrain.postRender();
        }

        if (this.options.showTileBoundaries || this.options.showQueryGeometry || this.options.showTileAABBs) {
            //Use source with highest maxzoom
            let selectedSource = null;
            const layers = values(this.style._layers);
            layers.forEach((layer) => {
                const sourceCache = style._getLayerSourceCache(layer);
                if (sourceCache && !layer.isHidden(this.transform.zoom)) {
                    if (!selectedSource || (selectedSource.getSource().maxzoom < sourceCache.getSource().maxzoom)) {
                        selectedSource = sourceCache;
                    }
                }
            });
            if (selectedSource) {
                if (this.options.showTileBoundaries) {
                    draw.debug(this, selectedSource, selectedSource.getVisibleCoordinates());
                }

                Debug.run(() => {
                    if (!selectedSource) return;
                    if (this.options.showQueryGeometry) {
                        drawDebugQueryGeometry(this, selectedSource, selectedSource.getVisibleCoordinates());
                    }
                    if (this.options.showTileAABBs) {
                        Debug.drawAabbs(this, selectedSource, selectedSource.getVisibleCoordinates());
                    }
                });
            }
        }

        if (this.options.showPadding) {
            drawDebugPadding(this);
        }

        // Set defaults for most GL values so that anyone using the state after the render
        // encounters more expected values.
        this.context.setDefault();
        this.frameCounter = (this.frameCounter + 1) % Number.MAX_SAFE_INTEGER;

        if (this.tileLoaded && this.options.speedIndexTiming) {
            this.loadTimeStamps.push(window.performance.now());
            this.saveCanvasCopy();
        }
    }

    renderLayer(painter: Painter, sourceCache?: SourceCache, layer: StyleLayer, coords?: Array<OverscaledTileID>) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && layer.type !== 'sky' && layer.type !== 'custom' && !(coords && coords.length)) return;
        this.id = layer.id;

        this.gpuTimingStart(layer);
        if (!painter.transform.projection.unsupportedLayers || !painter.transform.projection.unsupportedLayers.includes(layer.type)) {
            draw[layer.type](painter, sourceCache, layer, coords, this.style.placement.variableOffsets, this.options.isInitialLoad);
        }
        this.gpuTimingEnd();
    }

    gpuTimingStart(layer: StyleLayer) {
        if (!this.options.gpuTiming) return;
        const ext = this.context.extTimerQuery;
        // This tries to time the draw call itself, but note that the cost for drawing a layer
        // may be dominated by the cost of uploading vertices to the GPU.
        // To instrument that, we'd need to pass the layerTimers object down into the bucket
        // uploading logic.
        let layerTimer = this.gpuTimers[layer.id];
        if (!layerTimer) {
            layerTimer = this.gpuTimers[layer.id] = {
                calls: 0,
                cpuTime: 0,
                query: ext.createQueryEXT()
            };
        }
        layerTimer.calls++;
        ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, layerTimer.query);
    }

    gpuTimingDeferredRenderStart() {
        if (this.options.gpuTimingDeferredRender) {
            const ext = this.context.extTimerQuery;
            const query = ext.createQueryEXT();
            this.deferredRenderGpuTimeQueries.push(query);
            ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, query);
        }
    }

    gpuTimingDeferredRenderEnd() {
        if (!this.options.gpuTimingDeferredRender) return;
        const ext = this.context.extTimerQuery;
        ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
    }

    gpuTimingEnd() {
        if (!this.options.gpuTiming) return;
        const ext = this.context.extTimerQuery;
        ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
    }

    collectGpuTimers(): GPUTimers {
        const currentLayerTimers = this.gpuTimers;
        this.gpuTimers = {};
        return currentLayerTimers;
    }

    collectDeferredRenderGpuQueries(): Array<any> {
        const currentQueries = this.deferredRenderGpuTimeQueries;
        this.deferredRenderGpuTimeQueries = [];
        return currentQueries;
    }

    queryGpuTimers(gpuTimers: GPUTimers): {[layerId: string]: number} {
        const layers = {};
        for (const layerId in gpuTimers) {
            const gpuTimer = gpuTimers[layerId];
            const ext = this.context.extTimerQuery;
            const gpuTime = ext.getQueryObjectEXT(gpuTimer.query, ext.QUERY_RESULT_EXT) / (1000 * 1000);
            ext.deleteQueryEXT(gpuTimer.query);
            layers[layerId] = (gpuTime: number);
        }
        return layers;
    }

    queryGpuTimeDeferredRender(gpuQueries: Array<any>): number {
        if (!this.options.gpuTimingDeferredRender) return 0;
        const ext = this.context.extTimerQuery;

        let gpuTime = 0;
        for (const query of gpuQueries) {
            gpuTime += ext.getQueryObjectEXT(query, ext.QUERY_RESULT_EXT) / (1000 * 1000);
            ext.deleteQueryEXT(query);
        }

        return gpuTime;
    }

    /**
     * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
     * @param inViewportPixelUnitsUnits True when the units accepted by the matrix are in viewport pixels instead of tile units.
     * @returns {Float32Array} matrix
     * @private
     */
    translatePosMatrix(matrix: Float32Array, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport', inViewportPixelUnitsUnits?: boolean): Float32Array {
        if (!translate[0] && !translate[1]) return matrix;

        const angle = inViewportPixelUnitsUnits ?
            (translateAnchor === 'map' ? this.transform.angle : 0) :
            (translateAnchor === 'viewport' ? -this.transform.angle : 0);

        if (angle) {
            const sinA = Math.sin(angle);
            const cosA = Math.cos(angle);
            translate = [
                translate[0] * cosA - translate[1] * sinA,
                translate[0] * sinA + translate[1] * cosA
            ];
        }

        const translation = [
            inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], this.transform.zoom),
            inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], this.transform.zoom),
            0
        ];

        const translatedMatrix = new Float32Array(16);
        mat4.translate(translatedMatrix, matrix, translation);
        return translatedMatrix;
    }

    saveTileTexture(texture: Texture) {
        const textures = this._tileTextures[texture.size[0]];
        if (!textures) {
            this._tileTextures[texture.size[0]] = [texture];
        } else {
            textures.push(texture);
        }
    }

    getTileTexture(size: number): null | Texture {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    /**
     * Checks whether a pattern image is needed, and if it is, whether it is not loaded.
     *
* @returns true if a needed image is missing and rendering needs to be skipped.
     * @private
     */
    isPatternMissing(image: ?CrossFaded<ResolvedImage>): boolean {
        if (!image) return false;
        if (!image.from || !image.to) return true;
        const imagePosA = this.imageManager.getPattern(image.from.toString());
        const imagePosB = this.imageManager.getPattern(image.to.toString());
        return !imagePosA || !imagePosB;
    }

    terrainRenderModeElevated(): boolean {
        // Whether elevation sampling should be enabled in the vertex shader.
        return this.style && !!this.style.getTerrain() && !!this.terrain && !this.terrain.renderingToTexture;
    }

    /**
     * Returns #defines that would need to be injected into every Program
     * based on the current state of Painter.
     *
     * @returns {string[]}
     * @private
     */
    currentGlobalDefines(): string[] {
        const rtt = this.terrain && this.terrain.renderingToTexture;
        const fog = this.style && this.style.fog;
        const defines = [];

        if (this.terrainRenderModeElevated()) defines.push('TERRAIN');
        if (this.transform.projection.name === 'globe') defines.push('GLOBE');
        // When terrain is active, fog is rendered as part of draping, not as part of tile
        // rendering. Removing the fog flag during tile rendering avoids additional defines.
        if (fog && !rtt && fog.getOpacity(this.transform.pitch) !== 0.0) {
            defines.push('FOG');
        }
        if (rtt) defines.push('RENDER_TO_TEXTURE');
        if (this._showOverdrawInspector) defines.push('OVERDRAW_INSPECTOR');
        return defines;
    }

    useProgram(name: string, programConfiguration: ?ProgramConfiguration, fixedDefines: ?DynamicDefinesType[]): Program<any> {
        this.cache = this.cache || {};
        const defines = (((fixedDefines || []): any): string[]);

        const globalDefines = this.currentGlobalDefines();
        const allDefines = globalDefines.concat(defines);
        const key = Program.cacheKey(shaders[name], name, allDefines, programConfiguration);

        if (!this.cache[key]) {
            this.cache[key] = new Program(this.context, name, shaders[name], programConfiguration, programUniforms[name], allDefines);
        }
        return this.cache[key];
    }

    /*
     * Reset some GL state to default values to avoid hard-to-debug bugs
     * in custom layers.
     */
    setCustomLayerDefaults() {
        // Prevent custom layers from unintentionally modify the last VAO used.
        // All other state is state is restored on it's own, but for VAOs it's
        // simpler to unbind so that we don't have to track the state of VAOs.
        this.context.unbindVAO();

        // The default values for this state is meaningful and often expected.
        // Leaving this state dirty could cause a lot of confusion for users.
        this.context.cullFace.setDefault();
        this.context.frontFace.setDefault();
        this.context.cullFaceSide.setDefault();
        this.context.activeTexture.setDefault();
        this.context.pixelStoreUnpack.setDefault();
        this.context.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.context.pixelStoreUnpackFlipY.setDefault();
    }

    /*
     * Set GL state that is shared by all layers.
     */
    setBaseState() {
        const gl = this.context.gl;
        this.context.cullFace.set(false);
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.blendEquation.set(gl.FUNC_ADD);
    }

    initDebugOverlayCanvas() {
        if (this.debugOverlayCanvas == null) {
            this.debugOverlayCanvas = window.document.createElement('canvas');
            this.debugOverlayCanvas.width = 512;
            this.debugOverlayCanvas.height = 512;
            const gl = this.context.gl;
            this.debugOverlayTexture = new Texture(this.context, this.debugOverlayCanvas, gl.RGBA);
        }
    }

    destroy() {
        if (this._terrain) {
            this._terrain.destroy();
        }
        if (this.globeSharedBuffers) {
            this.globeSharedBuffers.destroy();
        }
        this.emptyTexture.destroy();
        if (this.debugOverlayTexture) {
            this.debugOverlayTexture.destroy();
        }
        if (this.atmosphereBuffer) {
            this.atmosphereBuffer.destroy();
        }
    }

    prepareDrawTile() {
        if (this.terrain) {
            this.terrain.prepareDrawTile();
        }
    }

    prepareDrawProgram(context: Context, program: Program<*>, tileID: ?UnwrappedTileID) {

        // Fog is not enabled when rendering to texture so we
        // can safely skip uploading uniforms in that case
        if (this.terrain && this.terrain.renderingToTexture) {
            return;
        }

        const fog = this.style.fog;

        if (fog) {
            const fogOpacity = fog.getOpacity(this.transform.pitch);
            const fogUniforms = fogUniformValues(
                this, fog, tileID, fogOpacity,
                this.transform.frustumCorners.TL,
                this.transform.frustumCorners.TR,
                this.transform.frustumCorners.BR,
                this.transform.frustumCorners.BL,
                this.transform.globeCenterInViewSpace,
                this.transform.globeRadius,
                [
                    this.transform.width * browser.devicePixelRatio,
                    this.transform.height * browser.devicePixelRatio
                ]);

            program.setFogUniformValues(context, fogUniforms);
        }
    }

    setTileLoadedFlag(flag: boolean) {
        this.tileLoaded = flag;
    }

    saveCanvasCopy() {
        this.frameCopies.push(this.canvasCopy());
        this.tileLoaded = false;
    }

    canvasCopy(): ?WebGLTexture {
        const gl = this.context.gl;
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0);
        return texture;
    }

    getCanvasCopiesAndTimestamps(): CanvasCopyInstances {
        return {
            canvasCopies: this.frameCopies,
            timeStamps: this.loadTimeStamps
        };
    }

    averageElevationNeedsEasing(): boolean {
        if (!this.transform._elevation) return false;

        const fog = this.style && this.style.fog;
        if (!fog) return false;

        const fogOpacity = fog.getOpacity(this.transform.pitch);
        if (fogOpacity === 0) return false;

        return true;
    }

    getBackgroundTiles(): {[key: number]: Tile} {
        const oldTiles = this._backgroundTiles;
        const newTiles = this._backgroundTiles = {};

        const tileSize = 512;
        const tileIDs = this.transform.coveringTiles({tileSize});
        for (const tileID of tileIDs) {
            newTiles[tileID.key] = oldTiles[tileID.key] || new Tile(tileID, tileSize, this.transform.tileZoom, this);
        }
        return newTiles;
    }

    clearBackgroundTiles() {
        this._backgroundTiles = {};
    }
}

export default Painter;
