// @flow

import browser from '../util/browser.js';
import window from '../util/window.js';

import {mat4} from 'gl-matrix';
import SourceCache from '../source/source_cache.js';
import EXTENT from '../style-spec/data/extent.js';
import pixelsToTileUnits from '../source/pixels_to_tile_units.js';
import SegmentVector from '../data/segment.js';
import {PosArray, TileBoundsArray, TriangleIndexArray, LineStripIndexArray} from '../data/array_types.js';
import {isMapAuthenticated} from '../util/mapbox.js';
import posAttributes from '../data/pos_attributes.js';
import boundsAttributes from '../data/bounds_attributes.js';
import ProgramConfiguration from '../data/program_configuration.js';
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
import Atmosphere from './draw_atmosphere.js';
import {GlobeSharedBuffers, globeToMercatorTransition} from '../geo/projection/globe_util.js';
import {Terrain} from '../terrain/terrain.js';
import {Debug} from '../util/debug.js';
import Tile from '../source/tile.js';
import {RGBAImage} from '../util/image.js';
import {ReplacementSource} from '../../3d-style/source/replacement_source.js';
import type {Source} from '../source/source.js';
import type {CutoffParams} from '../render/cutoff.js';

// 3D-style related
import model, {upload as modelUpload} from '../../3d-style/render/draw_model.js';
import {lightsUniformValues} from '../../3d-style/render/lights.js';

import {ShadowRenderer} from '../../3d-style/render/shadow_renderer.js';

import {WireframeDebugCache} from "./wireframe_cache.js";

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
    custom,
    model
};

const upload = {
    modelUpload
};

import type Transform from '../geo/transform.js';
import type {OverscaledTileID, UnwrappedTileID} from '../source/tile_id.js';
import type Style from '../style/style.js';
import type StyleLayer from '../style/style_layer.js';
import type ImageManager from './image_manager.js';
import type GlyphManager from './glyph_manager.js';
import type ModelManager from '../../3d-style/render/model_manager.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type {DepthRangeType, DepthMaskType, DepthFuncType} from '../gl/types.js';
import type ResolvedImage from '../style-spec/expression/types/resolved_image.js';
import type {DynamicDefinesType} from './program/program_uniforms.js';
import {FOG_OPACITY_THRESHOLD} from '../style/fog_helpers.js';
import type {ContextOptions} from '../gl/context.js';

export type RenderPass = 'offscreen' | 'opaque' | 'translucent' | 'sky' | 'shadow' | 'light-beam';
export type CanvasCopyInstances = {
    canvasCopies: WebGLTexture[],
    timeStamps: number[]
}

export type CreateProgramParams = {
    config?: ProgramConfiguration,
    defines?: DynamicDefinesType[],
    overrideFog?: boolean,
    overrideRtt?: boolean
}

type WireframeOptions = {
    terrain: boolean,
    layers2D: boolean,
    layers3D: boolean,
};

type PainterOptions = {
    showOverdrawInspector: boolean,
    showTileBoundaries: boolean,
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
    speedIndexTiming: boolean,
    wireframe: WireframeOptions,
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
    modelManager: ModelManager;
    depthRangeFor3D: DepthRangeType;
    opaquePassCutoff: number;
    frameCounter: number;
    renderPass: RenderPass;
    currentLayer: number;
    currentStencilSource: ?string;
    currentShadowCascade: number;
    nextStencilID: number;
    id: string;
    _showOverdrawInspector: boolean;
    _shadowMapDebug: boolean;
    cache: {[_: string]: Program<*> };
    symbolFadeChange: number;
    gpuTimers: GPUTimers;
    deferredRenderGpuTimeQueries: Array<any>;
    emptyTexture: Texture;
    identityMat: Float32Array;
    debugOverlayTexture: Texture;
    debugOverlayCanvas: HTMLCanvasElement;
    _terrain: ?Terrain;
    globeSharedBuffers: ?GlobeSharedBuffers;
    tileLoaded: boolean;
    frameCopies: Array<WebGLTexture>;
    loadTimeStamps: Array<number>;
    _backgroundTiles: {[key: number]: Tile};
    _atmosphere: ?Atmosphere;
    replacementSource: ReplacementSource;
    conflationActive: boolean;
    firstLightBeamLayer: number;
    longestCutoffRange: number;
    minCutoffZoom: number;
    renderDefaultNorthPole: boolean;
    renderDefaultSouthPole: boolean;
    _fogVisible: boolean;
    _cachedTileFogOpacities: {[number]: [number, number]};

    _shadowRenderer: ?ShadowRenderer;

    _wireframeDebugCache: WireframeDebugCache;

    constructor(gl: WebGL2RenderingContext, contextCreateOptions: ContextOptions, transform: Transform) {
        this.context = new Context(gl, contextCreateOptions);
        this.transform = transform;
        this._tileTextures = {};
        this.frameCopies = [];
        this.loadTimeStamps = [];

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.deferredRenderGpuTimeQueries = [];
        this.gpuTimers = {};
        this.frameCounter = 0;
        this._backgroundTiles = {};

        this.conflationActive = false;
        this.replacementSource = new ReplacementSource();
        this.longestCutoffRange = 0.0;
        this.minCutoffZoom = 0.0;
        this._fogVisible = false;
        this._cachedTileFogOpacities = {};
        this._shadowRenderer = new ShadowRenderer(this);

        this._wireframeDebugCache = new WireframeDebugCache();
        this.renderDefaultNorthPole = true;
        this.renderDefaultSouthPole = true;
    }

    updateTerrain(style: Style, adaptCameraAltitude: boolean) {
        const enabled = !!style && !!style.terrain && this.transform.projection.supportsTerrain;
        if (!enabled && (!this._terrain || !this._terrain.enabled)) return;

        if (!this._terrain) {
            this._terrain = new Terrain(this, style);
        }
        const terrain: Terrain = this._terrain;
        this.transform.elevation = enabled ? terrain : null;
        terrain.update(style, this.transform, adaptCameraAltitude);
        if (this.transform.elevation && !terrain.enabled) {
            // for zoom based exaggeration change, terrain.update can disable terrain.
            this.transform.elevation = null;
        }
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

    get shadowRenderer(): ?ShadowRenderer {
        return this._shadowRenderer && this._shadowRenderer.enabled ? this._shadowRenderer : null;
    }

    get wireframeDebugCache(): WireframeDebugCache {
        return this._wireframeDebugCache;
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
                this.style._mergedLayers[layerId].resize();
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
        this.getOrCreateProgram('clippingMask').draw(this, gl.TRIANGLES,
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

        const program = this.getOrCreateProgram('clippingMask');

        this._tileClippingMaskIDs = {};

        for (const tileID of tileIDs) {
            const tile = sourceCache.getTile(tileID);
            const id = this._tileClippingMaskIDs[tileID.key] = this.nextStencilID++;
            const {tileBoundsBuffer, tileBoundsIndexBuffer, tileBoundsSegments} = this.getTileBoundsBuffers(tile);

            program.draw(this, gl.TRIANGLES, DepthMode.disabled,
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

            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE, gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        } else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        } else {
            return ColorMode.alphaBlended;
        }
    }

    colorModeForDrapableLayerRenderPass(emissiveStrengthForDrapedLayers?: number): $ReadOnly<ColorMode> {
        const deferredDrapingEnabled = () => {
            return this.style && this.style.enable3dLights() && this.terrain && this.terrain.renderingToTexture;
        };

        const gl = this.context.gl;
        if (deferredDrapingEnabled() && this.renderPass === 'translucent') {
            return new ColorMode([gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.CONSTANT_ALPHA, gl.ONE_MINUS_SRC_ALPHA],
                new Color(0, 0, 0, emissiveStrengthForDrapedLayers === undefined ? 0 : emissiveStrengthForDrapedLayers), [true, true, true, true]);
        } else {
            return this.colorModeForRenderPass();
        }
    }

    depthModeForSublayer(n: number, mask: DepthMaskType, func: ?DepthFuncType, skipOpaquePassCutoff: boolean = false): $ReadOnly<DepthMode> {
        if (!this.opaquePassEnabledForLayer() && !skipOpaquePassCutoff) return DepthMode.disabled;
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
        // Update debug cache, i.e. clear all unused buffers
        this._wireframeDebugCache.update(this.frameCounter);

        this.style = style;
        this.options = options;

        const layers = this.style._mergedLayers;
        const layerIds = this.style.order;
        const orderedLayers = layerIds.map(id => layers[id]);
        const sourceCaches = this.style._mergedSourceCaches;

        this.imageManager = style.imageManager;
        this.modelManager = style.modelManager;

        this.symbolFadeChange = style.placement.symbolFadeChange(browser.now());

        this.imageManager.beginFrame();

        let conflationSourcesInStyle = 0;
        let conflationActiveThisFrame = false;

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);

                if (sourceCache.getSource().usedInConflation) {
                    ++conflationSourcesInStyle;
                }
            }
        }

        const coordsAscending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescending: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsDescendingSymbol: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsShadowCasters: {[_: string]: Array<OverscaledTileID>} = {};
        const coordsSortedByDistance: {[_: string]: Array<OverscaledTileID>} = {};

        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            coordsAscending[id] = sourceCache.getVisibleCoordinates();
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
            coordsShadowCasters[id] = sourceCache.getShadowCasterCoordinates();
            coordsSortedByDistance[id] = sourceCache.sortCoordinatesByDistance(coordsAscending[id]);
        }

        const getLayerSource = (layer: StyleLayer) => {
            const cache = this.style.getLayerSourceCache(layer);
            if (!cache || !cache.used) {
                return null;
            }
            return cache.getSource();
        };
        if (conflationSourcesInStyle) {
            const conflationLayersInStyle = [];

            for (const layer of orderedLayers) {
                if (this.layerUsedInConflation(layer, getLayerSource(layer))) {
                    conflationLayersInStyle.push(layer);
                }
            }

            // Check we have more than one conflation layer
            if (conflationLayersInStyle && conflationLayersInStyle.length > 1) {
                // Some layer types such as fill extrusions and models might have interdependencies
                // where certain features should be replaced by overlapping features from another layer with higher
                // precedence. A special data structure 'replacementSource' is used to compute regions
                // on visible tiles where potential overlap might occur between features of different layers.
                const conflationSources = [];

                for (const layer of conflationLayersInStyle) {
                    const sourceCache = this.style.getLayerSourceCache(layer);

                    if (!sourceCache || !sourceCache.used || !sourceCache.getSource().usedInConflation) {
                        continue;
                    }

                    conflationSources.push({layer: layer.fqid, cache: sourceCache});
                }

                this.replacementSource.setSources(conflationSources);
                conflationActiveThisFrame = true;
            }
        }

        if (!conflationActiveThisFrame) {
            this.replacementSource.clear();
        }

        // Mark conflation as active for one frame after the deactivation to give
        // consumers of the feature an opportunity to clean up
        this.conflationActive = conflationActiveThisFrame;

        // Tiles on zoom level lower than the minCutoffZoom will be cut for layers with non-zero cutoffRange
        this.minCutoffZoom = 0.0;
        // The longest cutoff range will be used for cutting shadows if any layer has non-zero cutoffRange
        this.longestCutoffRange = 0.0;
        for (const layer of orderedLayers) {
            const cutoffRange = layer.cutoffRange();
            this.longestCutoffRange = Math.max(cutoffRange, this.longestCutoffRange);
            if (cutoffRange > 0.0) {
                const source = getLayerSource(layer);
                if (source) {
                    this.minCutoffZoom = Math.max(source.minzoom, this.minCutoffZoom);
                }
                if (layer.minzoom) {
                    this.minCutoffZoom = Math.max(layer.minzoom, this.minCutoffZoom);
                }
            }
        }

        this.opaquePassCutoff = Infinity;
        for (let i = 0; i < orderedLayers.length; i++) {
            const layer = orderedLayers[i];
            if (layer.is3D()) {
                this.opaquePassCutoff = i;
                break;
            }
        }

        // Disable fog for the frame if it doesn't contribute to the final output at all
        const fog = this.style && this.style.fog;

        if (fog) {
            this._fogVisible = fog.getOpacity(this.transform.pitch) !== 0.0;

            if (this._fogVisible && this.transform.projection.name !== 'globe') {
                this._fogVisible = fog.isVisibleOnFrustum(this.transform.cameraFrustum);
            }
        } else {
            this._fogVisible = false;
        }

        this._cachedTileFogOpacities = {};

        if (this.terrain) {
            this.terrain.updateTileBinding(coordsDescendingSymbol);
            // All render to texture is done in translucent pass to remove need
            // for depth buffer allocation per tile.
            this.opaquePassCutoff = 0;
        }

        const shadowRenderer = this._shadowRenderer;
        if (shadowRenderer) {
            shadowRenderer.updateShadowParameters(this.transform, this.style.directionalLight);

            for (const id in sourceCaches) {
                for (const coord of coordsAscending[id]) {
                    let tileHeight = {min: 0, max: 0};
                    if (this.terrain) {
                        tileHeight = this.terrain.getMinMaxForTile(coord) || tileHeight;
                    }

                    // This doesn't consider any 3D layers to have height above the ground.
                    // It was decided to not compute the real tile height, because all the tiles would need to be
                    // seperately iterated before any rendering starts. The current code that calculates ShadowReceiver.lastCascade
                    // doesn't check the Z axis in shadow cascade space. That in combination with missing tile height could in theory
                    // lead to a situation where a tile is thought to fit in cascade 0, but actually extends into cascade 1.
                    // The proper fix would be to update ShadowReceiver.lastCascade calculation to consider shadow cascade bounds accurately.
                    shadowRenderer.addShadowReceiver(coord.toUnwrapped(), tileHeight.min, tileHeight.max);
                }
            }
        }

        if (this.transform.projection.name === 'globe' && !this.globeSharedBuffers) {
            this.globeSharedBuffers = new GlobeSharedBuffers(this.context);
        }

        // upload pass
        for (const layer of orderedLayers) {
            if (layer.isHidden(this.transform.zoom)) continue;
            const sourceCache = style.getLayerSourceCache(layer);
            this.uploadLayer(this, layer, sourceCache);
        }

        if (this.style.fog && this.transform.projection.supportsFog) {
            if (!this._atmosphere) {
                this._atmosphere = new Atmosphere();
            }

            this._atmosphere.update(this);
        } else {
            if (this._atmosphere) {
                this._atmosphere.destroy();
                this._atmosphere = undefined;
            }
        }

        // Following line is billing related code. Do not change. See LICENSE.txt
        if (!isMapAuthenticated(this.context.gl)) return;

        // Offscreen pass ===============================================
        // We first do all rendering that requires rendering to a separate
        // framebuffer, and then save those for rendering back to the map
        // later: in doing this we avoid doing expensive framebuffer restores.
        this.renderPass = 'offscreen';

        for (const layer of orderedLayers) {
            const sourceCache = style.getLayerSourceCache(layer);
            if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom)) continue;

            const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;
            if (!(layer.type === 'custom' || layer.type === 'raster' || layer.isSky()) && !(coords && coords.length)) continue;

            this.renderLayer(this, sourceCache, layer, coords);
        }

        this.depthRangeFor3D = [0, 1 - ((orderedLayers.length + 2) * this.numSublayers * this.depthEpsilon)];

        // Terrain depth offscreen render pass ==========================
        // With terrain on, renders the depth buffer into a texture.
        // This texture is used for occlusion testing (labels).
        // When orthographic camera is in use we don't really need the depth occlusion testing (see https://mapbox.atlassian.net/browse/MAPS3D-1132)
        // Therefore we can safely skip the rendering to the depth texture.
        const terrain = this.terrain;
        if (terrain && (this.style.hasSymbolLayers() || this.style.hasCircleLayers()) && !this.transform.isOrthographic) {
            terrain.drawDepth();
        }

        // Shadow pass ==================================================
        if (this._shadowRenderer) {
            this.renderPass = 'shadow';
            this._shadowRenderer.drawShadowPass(this.style, coordsShadowCasters);
        }

        // Rebind the main framebuffer now that all offscreen layers have been rendered:
        this.context.bindFramebuffer.set(null);
        this.context.viewport.set([0, 0, this.width, this.height]);

        const shouldRenderAtmosphere = this.transform.projection.name === "globe" || this.transform.isHorizonVisible();

        // Clear buffers in preparation for drawing to the main framebuffer
        const clearColor = (() => {
            if (options.showOverdrawInspector) {
                return Color.black;
            }

            if (this.style.fog && this.transform.projection.supportsFog && !shouldRenderAtmosphere) {
                const fogColor = this.style.fog.properties.get('color').toArray01();

                return new Color(...fogColor);
            }

            if (this.style.fog && this.transform.projection.supportsFog && shouldRenderAtmosphere) {
                const spaceColor = this.style.fog.properties.get('space-color').toArray01();

                return new Color(...spaceColor);
            }

            return Color.transparent;
        })();

        this.context.clear({color: clearColor, depth: 1});

        this.clearStencil();

        this._showOverdrawInspector = options.showOverdrawInspector;

        // Opaque pass ===============================================
        // Draw opaque layers top-to-bottom first.
        this.renderPass = 'opaque';

        if (this.style.fog && this.transform.projection.supportsFog && this._atmosphere && !this._showOverdrawInspector && shouldRenderAtmosphere) {
            this._atmosphere.drawStars(this, this.style.fog);
        }

        if (!this.terrain) {
            for (this.currentLayer = layerIds.length - 1; this.currentLayer >= 0; this.currentLayer--) {
                const layer = orderedLayers[this.currentLayer];
                const sourceCache = style.getLayerSourceCache(layer);
                if (layer.isSky()) continue;
                const coords = sourceCache ? (layer.is3D() ? coordsSortedByDistance : coordsDescending)[sourceCache.id] : undefined;
                this._renderTileClippingMasks(layer, sourceCache, coords);
                this.renderLayer(this, sourceCache, layer, coords);
            }
        }

        if (this.style.fog && this.transform.projection.supportsFog && this._atmosphere && !this._showOverdrawInspector && shouldRenderAtmosphere) {
            this._atmosphere.drawAtmosphereGlow(this, this.style.fog);
        }

        // Sky pass ======================================================
        // Draw all sky layers bottom to top.
        // They are drawn at max depth, they are drawn after opaque and before
        // translucent to fail depth testing and mix with translucent objects.
        this.renderPass = 'sky';
        const drawSkyOnGlobe = !this._atmosphere || globeToMercatorTransition(this.transform.zoom) > 0.0;
        if (drawSkyOnGlobe && (this.transform.projection.name === 'globe' || this.transform.isHorizonVisible())) {
            for (this.currentLayer = 0; this.currentLayer < layerIds.length; this.currentLayer++) {
                const layer = orderedLayers[this.currentLayer];
                const sourceCache = style.getLayerSourceCache(layer);
                if (!layer.isSky()) continue;
                const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;

                this.renderLayer(this, sourceCache, layer, coords);
            }
        }

        // Translucent pass ===============================================
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';

        this.currentLayer = 0;
        this.firstLightBeamLayer = Number.MAX_SAFE_INTEGER;

        let shadowLayers = 0;
        if (shadowRenderer) {
            shadowLayers = shadowRenderer.getShadowCastingLayerCount();
        }

        while (this.currentLayer < layerIds.length) {
            const layer = orderedLayers[this.currentLayer];
            const sourceCache = style.getLayerSourceCache(layer);

            // Nothing to draw in translucent pass for sky layers, advance
            if (layer.isSky()) {
                ++this.currentLayer;
                continue;
            }

            // With terrain on and for draped layers only, issue rendering and progress
            // this.currentLayer until the next non-draped layer.
            // Otherwise we interleave terrain draped render with non-draped layers on top
            if (terrain && this.style.isLayerDraped(layer)) {
                if (layer.isHidden(this.transform.zoom)) {
                    ++this.currentLayer;
                    continue;
                }
                const prevLayer = this.currentLayer;
                this.currentLayer = terrain.renderBatch(this.currentLayer);
                assert(this.context.bindFramebuffer.current === null);
                assert(this.currentLayer > prevLayer);
                continue;
            }

            // For symbol layers in the translucent pass, we add extra tiles to the renderable set
            // for cross-tile symbol fading. Symbol layers don't use tile clipping, so no need to render
            // separate clipping masks
            let coords: ?Array<OverscaledTileID>;

            if (sourceCache) {
                const coordsSet = layer.type === 'symbol' ? coordsDescendingSymbol :
                    (layer.is3D() ? coordsSortedByDistance : coordsDescending);

                coords = coordsSet[sourceCache.id];
            }

            this._renderTileClippingMasks(layer, sourceCache, sourceCache ? coordsAscending[sourceCache.id] : undefined);
            this.renderLayer(this, sourceCache, layer, coords);

            // Render ground shadows after the last shadow caster layer
            if (!terrain && shadowRenderer && shadowLayers > 0 && layer.hasShadowPass() && --shadowLayers === 0) {
                shadowRenderer.drawGroundShadows();

                if (this.firstLightBeamLayer <= this.currentLayer) { // render light beams for 3D models (all are before ground shadows)
                    const saveCurrentLayer = this.currentLayer;
                    this.renderPass = 'light-beam';
                    for (this.currentLayer = this.firstLightBeamLayer; this.currentLayer <= saveCurrentLayer; this.currentLayer++) {
                        const layer = orderedLayers[this.currentLayer];
                        if (!layer.hasLightBeamPass()) continue;

                        const sourceCache = style.getLayerSourceCache(layer);
                        const coords = sourceCache ? coordsDescending[sourceCache.id] : undefined;
                        this.renderLayer(this, sourceCache, layer, coords);
                    }
                    this.currentLayer = saveCurrentLayer;
                    this.renderPass = 'translucent';
                }
            }

            ++this.currentLayer;
        }

        if (this.terrain) {
            this.terrain.postRender();
        }

        if (this.options.showTileBoundaries || this.options.showQueryGeometry || this.options.showTileAABBs) {
            //Use source with highest maxzoom
            let selectedSource = null;
            orderedLayers.forEach((layer) => {
                const sourceCache = style.getLayerSourceCache(layer);
                if (sourceCache && !layer.isHidden(this.transform.zoom) && sourceCache.getVisibleCoordinates().length) {
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

        if (!conflationActiveThisFrame) {
            this.conflationActive = false;
        }
    }

    uploadLayer(painter: Painter, layer: StyleLayer, sourceCache?: SourceCache) {
        this.gpuTimingStart(layer);
        if (!painter.transform.projection.unsupportedLayers || !painter.transform.projection.unsupportedLayers.includes(layer.type) ||
            (painter.terrain && layer.type === 'custom')) {
            if (upload[`${layer.type}Upload`]) {
                upload[`${layer.type}Upload`](painter, sourceCache, layer.scope);
            }
        }
        this.gpuTimingEnd();
    }

    renderLayer(painter: Painter, sourceCache?: SourceCache, layer: StyleLayer, coords?: Array<OverscaledTileID>) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && layer.type !== 'sky' && layer.type !== 'custom' && layer.type !== 'model' && layer.type !== 'raster' && !(coords && coords.length)) return;
        this.id = layer.id;

        this.gpuTimingStart(layer);
        if (!painter.transform.projection.unsupportedLayers || !painter.transform.projection.unsupportedLayers.includes(layer.type) ||
            (painter.terrain && layer.type === 'custom')) {
            draw[layer.type](painter, sourceCache, layer, coords, this.style.placement.variableOffsets, this.options.isInitialLoad);
        }
        this.gpuTimingEnd();
    }

    gpuTimingStart(layer: StyleLayer) {
        if (!this.options.gpuTiming) return;
        const ext = this.context.extTimerQuery;
        const gl = this.context.gl;
        // This tries to time the draw call itself, but note that the cost for drawing a layer
        // may be dominated by the cost of uploading vertices to the GPU.
        // To instrument that, we'd need to pass the layerTimers object down into the bucket
        // uploading logic.
        let layerTimer = this.gpuTimers[layer.id];
        if (!layerTimer) {
            layerTimer = this.gpuTimers[layer.id] = {
                calls: 0,
                cpuTime: 0,
                query: gl.createQuery()
            };
        }
        layerTimer.calls++;
        gl.beginQuery(ext.TIME_ELAPSED_EXT, layerTimer.query);
    }

    gpuTimingDeferredRenderStart() {
        if (this.options.gpuTimingDeferredRender) {
            const ext = this.context.extTimerQuery;
            const gl = this.context.gl;
            const query = gl.createQuery();
            this.deferredRenderGpuTimeQueries.push(query);
            gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
        }
    }

    gpuTimingDeferredRenderEnd() {
        if (!this.options.gpuTimingDeferredRender) return;
        const ext = this.context.extTimerQuery;
        const gl = this.context.gl;
        gl.endQuery(ext.TIME_ELAPSED_EXT);
    }

    gpuTimingEnd() {
        if (!this.options.gpuTiming) return;
        const ext = this.context.extTimerQuery;
        const gl = this.context.gl;
        gl.endQuery(ext.TIME_ELAPSED_EXT);
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
            const gl = this.context.gl;
            const gpuTime = ext.getQueryParameter(gpuTimer.query, gl.QUERY_RESULT) / (1000 * 1000);
            ext.deleteQueryEXT(gpuTimer.query);
            layers[layerId] = (gpuTime: number);
        }
        return layers;
    }

    queryGpuTimeDeferredRender(gpuQueries: Array<any>): number {
        if (!this.options.gpuTimingDeferredRender) return 0;
        const ext = this.context.extTimerQuery;
        const gl = this.context.gl;

        let gpuTime = 0;
        for (const query of gpuQueries) {
            gpuTime += ext.getQueryParameter(query, gl.QUERY_RESULT) / (1000 * 1000);
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

    /**
     * Saves the tile texture for re-use when another tile is loaded.
     *
     * @returns true if the tile was cached, false if the tile was not cached and should be destroyed.
     * @private
     */
    saveTileTexture(texture: Texture) {
        const tileSize = texture.size[0];
        const textures = this._tileTextures[tileSize];
        if (!textures) {
            this._tileTextures[tileSize] = [texture];
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
    isPatternMissing(image: ?ResolvedImage, scope: string): boolean {
        if (image === null) return true;
        if (image === undefined) return false;
        return !this.imageManager.getPattern(image.toString(), scope);
    }

    terrainRenderModeElevated(): boolean {
        // Whether elevation sampling should be enabled in the vertex shader.
        return this.style && !!this.style.getTerrain() && !!this.terrain && !this.terrain.renderingToTexture;
    }

    linearFloatFilteringSupported(): boolean {
        const context = this.context;
        return context.extTextureFloatLinear != null;
    }

    /**
     * Returns #defines that would need to be injected into every Program
     * based on the current state of Painter.
     *
     * @returns {string[]}
     * @private
     */
    currentGlobalDefines(name: string, overrideFog: ?boolean, overrideRtt: ?boolean): string[] {
        const rtt = (overrideRtt === undefined) ? this.terrain && this.terrain.renderingToTexture : overrideRtt;
        const zeroExaggeration = this.terrain && this.terrain.exaggeration() === 0.0;
        const defines = [];

        if (this.style && this.style.enable3dLights()) {
            // In case of terrain and map optimized for terrain mode flag
            // Lighting is deferred to terrain stage
            if (name === 'globeRaster' || name === 'terrainRaster') {
                defines.push('LIGHTING_3D_MODE');
                defines.push('LIGHTING_3D_ALPHA_EMISSIVENESS');
            } else {
                if (!rtt) {
                    defines.push('LIGHTING_3D_MODE');
                }
            }
        }
        if (this.renderPass === 'shadow') {
            if (!this._shadowMapDebug) defines.push('DEPTH_TEXTURE');
        } else if (this.shadowRenderer) {
            if (this.shadowRenderer.useNormalOffset) {
                defines.push('RENDER_SHADOWS', 'DEPTH_TEXTURE', 'NORMAL_OFFSET');
            } else {
                defines.push('RENDER_SHADOWS', 'DEPTH_TEXTURE');
            }
        }
        if (this.terrainRenderModeElevated()) {
            defines.push('TERRAIN');
            if (this.linearFloatFilteringSupported()) defines.push('TERRAIN_DEM_FLOAT_FORMAT');
            if (zeroExaggeration) defines.push('ZERO_EXAGGERATION');
        }
        if (this.transform.projection.name === 'globe') defines.push('GLOBE');
        // When terrain is active, fog is rendered as part of draping, not as part of tile
        // rendering. Removing the fog flag during tile rendering avoids additional defines.
        if (this._fogVisible && !rtt && (overrideFog === undefined || overrideFog)) {
            defines.push('FOG', 'FOG_DITHERING');
        }
        if (rtt) defines.push('RENDER_TO_TEXTURE');
        if (this._showOverdrawInspector) defines.push('OVERDRAW_INSPECTOR');
        return defines;
    }

    getOrCreateProgram(name: string, options?: CreateProgramParams): Program<any> {
        this.cache = this.cache || {};
        const defines = ((((options && options.defines) || []): any): string[]);
        const config = options && options.config;
        const overrideFog = options && options.overrideFog;
        const overrideRtt = options && options.overrideRtt;

        const globalDefines = this.currentGlobalDefines(name, overrideFog, overrideRtt);
        const allDefines = globalDefines.concat(defines);
        const key = Program.cacheKey(shaders[name], name, allDefines, config);

        if (!this.cache[key]) {
            this.cache[key] = new Program(this.context, name, shaders[name], config, programUniforms[name], allDefines);
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
        if (this._atmosphere) {
            this._atmosphere.destroy();
            this._atmosphere = undefined;
        }
        if (this.globeSharedBuffers) {
            this.globeSharedBuffers.destroy();
        }
        this.emptyTexture.destroy();
        if (this.debugOverlayTexture) {
            this.debugOverlayTexture.destroy();
        }
        this._wireframeDebugCache.destroy();
    }

    prepareDrawTile() {
        if (this.terrain) {
            this.terrain.prepareDrawTile();
        }
    }

    uploadCommonLightUniforms(context: Context, program: Program<*>) {
        if (this.style.enable3dLights()) {
            const directionalLight = this.style.directionalLight;
            const ambientLight = this.style.ambientLight;

            if (directionalLight && ambientLight) {
                const lightsUniforms = lightsUniformValues(directionalLight, ambientLight);
                program.setLightsUniformValues(context, lightsUniforms);
            }
        }
    }

    uploadCommonUniforms(context: Context, program: Program<*>, tileID: ?UnwrappedTileID, fogMatrix: ?Float32Array, cutoffParams: ?CutoffParams) {
        this.uploadCommonLightUniforms(context, program);

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
                ],
                fogMatrix);

            program.setFogUniformValues(context, fogUniforms);
        }

        if (cutoffParams) {
            program.setCutoffUniformValues(context, cutoffParams.uniformValues);
        }
    }

    setTileLoadedFlag(flag: boolean) {
        this.tileLoaded = flag;
    }

    saveCanvasCopy() {
        const canvas = this.canvasCopy();
        if (!canvas) return;
        this.frameCopies.push(canvas);
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

    /*
     * Replacement source's features get precedence over features defined in other sources.
     * E.g. landmark features replace fill extrusion buildings at the same position.
     * Initially planned to be used for Tiled3DModelSource, 2D source that is used with ModelLayer of buildings type and
     * custom layer buildings.
     */
    layerUsedInConflation(layer: StyleLayer, source: ?Source): boolean {
        if (!layer.is3D()) {
            return false;
        }

        if (layer.minzoom && layer.minzoom > this.transform.zoom) {
            return false;
        }

        if (layer.sourceLayer === "building") {
            return true;
        }

        return !!source && source.type === "batched-model";
    }

    isTileAffectedByFog(id: OverscaledTileID): boolean {
        if (!this.style || !this.style.fog) return false;
        if (this.transform.projection.name === 'globe') return true;

        let cachedRange = this._cachedTileFogOpacities[id.key];
        if (!cachedRange) {
            this._cachedTileFogOpacities[id.key] = cachedRange = this.style.fog.getOpacityForTile(id);
        }

        return cachedRange[0] >= FOG_OPACITY_THRESHOLD || cachedRange[1] >= FOG_OPACITY_THRESHOLD;
    }
}

export default Painter;
