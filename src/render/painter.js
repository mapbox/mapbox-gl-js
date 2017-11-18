// @flow

const browser = require('../util/browser');
const mat4 = require('@mapbox/gl-matrix').mat4;
const SourceCache = require('../source/source_cache');
const EXTENT = require('../data/extent');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const util = require('../util/util');
const VertexBuffer = require('../gl/vertex_buffer');
const VertexArrayObject = require('./vertex_array_object');
const RasterBoundsArray = require('../data/raster_bounds_array');
const PosArray = require('../data/pos_array');
const {ProgramConfiguration} = require('../data/program_configuration');
const CrossTileSymbolIndex = require('../symbol/cross_tile_symbol_index');
const shaders = require('../shaders');
const Program = require('./program');
const RenderTexture = require('./render_texture');
const updateTileMasks = require('./tile_mask');
const Color = require('../style-spec/util/color');

const draw = {
    symbol: require('./draw_symbol'),
    circle: require('./draw_circle'),
    heatmap: require('./draw_heatmap'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    'fill-extrusion': require('./draw_fill_extrusion'),
    raster: require('./draw_raster'),
    background: require('./draw_background'),
    debug: require('./draw_debug')
};

import type Transform from '../geo/transform';
import type Tile from '../source/tile';
import type TileCoord from '../source/tile_coord';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type LineAtlas from './line_atlas';
import type Texture from './texture';
import type ImageManager from './image_manager';
import type GlyphManager from './glyph_manager';

export type RenderPass = '3d' | 'opaque' | 'translucent';

type PainterOptions = {
    showOverdrawInspector: boolean,
    showTileBoundaries: boolean,
    rotating: boolean,
    zooming: boolean,
    collisionFadeDuration: number
}

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {
    gl: WebGLRenderingContext;
    transform: Transform;
    _tileTextures: { [number]: Array<Texture> };
    numSublayers: number;
    depthEpsilon: number;
    lineWidthRange: [number, number];
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    depthRbo: WebGLRenderbuffer;
    depthRboAttached: boolean;
    _depthMask: boolean;
    tileExtentBuffer: VertexBuffer;
    tileExtentVAO: VertexArrayObject;
    tileExtentPatternVAO: VertexArrayObject;
    debugBuffer: VertexBuffer;
    debugVAO: VertexArrayObject;
    rasterBoundsBuffer: VertexBuffer;
    rasterBoundsVAO: VertexArrayObject;
    viewportBuffer: VertexBuffer;
    viewportVAO: VertexArrayObject;
    extTextureFilterAnisotropic: any;
    extTextureFilterAnisotropicMax: any;
    extTextureHalfFloat: any;
    _tileClippingMaskIDs: { [number]: number };
    style: Style;
    options: PainterOptions;
    lineAtlas: LineAtlas;
    imageManager: ImageManager;
    glyphManager: GlyphManager;
    depthRange: number;
    renderPass: RenderPass;
    currentLayer: number;
    id: string;
    _showOverdrawInspector: boolean;
    cache: { [string]: Program };
    currentProgram: Program;
    crossTileSymbolIndex: CrossTileSymbolIndex;

    constructor(gl: WebGLRenderingContext, transform: Transform) {
        this.gl = gl;
        this.transform = transform;
        this._tileTextures = {};

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);

        this.emptyProgramConfiguration = new ProgramConfiguration();

        this.crossTileSymbolIndex = new CrossTileSymbolIndex();
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     */
    resize(width: number, height: number) {
        const gl = this.gl;

        this.width = width * browser.devicePixelRatio;
        this.height = height * browser.devicePixelRatio;
        gl.viewport(0, 0, this.width, this.height);

        if (this.style) {
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize(gl);
            }
        }

        if (this.depthRbo) {
            this.gl.deleteRenderbuffer(this.depthRbo);
            this.depthRbo = null;
        }
    }

    setup() {
        const gl = this.gl;

        // We are blending the new pixels *behind* the existing pixels. That way we can
        // draw front-to-back and use then stencil buffer to cull opaque pixels early.
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

        gl.enable(gl.STENCIL_TEST);

        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        this._depthMask = false;
        gl.depthMask(false);

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = new VertexBuffer(gl, tileExtentArray);
        this.tileExtentVAO = new VertexArrayObject();
        this.tileExtentPatternVAO = new VertexArrayObject();

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(EXTENT, EXTENT);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(0, 0);
        this.debugBuffer = new VertexBuffer(gl, debugArray);
        this.debugVAO = new VertexArrayObject();

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.rasterBoundsBuffer = new VertexBuffer(gl, rasterBoundsArray);
        this.rasterBoundsVAO = new VertexArrayObject();

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = new VertexBuffer(gl, viewportArray);
        this.viewportVAO = new VertexArrayObject();

        this.extTextureFilterAnisotropic = (
            gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
        );
        if (this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        }

        this.extTextureHalfFloat = gl.getExtension('OES_texture_half_float');
        if (this.extTextureHalfFloat) {
            gl.getExtension('OES_texture_half_float_linear');
        }
    }

    /*
     * Reset the color buffers of the drawing canvas.
     */
    clearColor() {
        const gl = this.gl;
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    /*
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const gl = this.gl;

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: restore this code for native
        // performance and readability once an upstream patch lands.

        // gl.clearStencil(0x0);
        // gl.stencilMask(0xFF);
        // gl.clear(gl.STENCIL_BUFFER_BIT);

        gl.colorMask(false, false, false, false);
        this.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        gl.stencilMask(0xFF);
        gl.stencilOp(gl.ZERO, gl.ZERO, gl.ZERO);

        gl.stencilFunc(gl.ALWAYS, 0x0, 0xFF);

        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

        const program = this.useProgram('fill', ProgramConfiguration.forBackgroundColor(new Color(0, 0, 0, 1), 1));
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

        this.viewportVAO.bind(gl, program, this.viewportBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        gl.stencilMask(0x00);
        gl.colorMask(true, true, true, true);
        this.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }

    clearDepth() {
        const gl = this.gl;
        gl.clearDepth(1);
        this.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    _renderTileClippingMasks(coords: Array<TileCoord>) {
        const gl = this.gl;
        gl.colorMask(false, false, false, false);
        this.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        gl.stencilMask(0xFF);
        // Tests will always pass, and ref value will be written to stencil buffer.
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

        let idNext = 1;
        this._tileClippingMaskIDs = {};

        for (const coord of coords) {
            const id = this._tileClippingMaskIDs[coord.id] = idNext++;

            gl.stencilFunc(gl.ALWAYS, id, 0xFF);

            const program = this.useProgram('fill', this.emptyProgramConfiguration);
            gl.uniformMatrix4fv(program.uniforms.u_matrix, false, coord.posMatrix);

            // Draw the clipping mask
            this.tileExtentVAO.bind(gl, program, this.tileExtentBuffer);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.length);
        }

        gl.stencilMask(0x00);
        gl.colorMask(true, true, true, true);
        this.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }

    enableTileClippingMask(coord: TileCoord) {
        const gl = this.gl;
        gl.stencilFunc(gl.EQUAL, this._tileClippingMaskIDs[coord.id], 0xFF);
    }

    render(style: Style, options: PainterOptions) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        for (const id in style.sourceCaches) {
            const sourceCache = this.style.sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.gl);
            }
        }

        const layerIds = this.style._order;

        const rasterSources = util.filterObject(this.style.sourceCaches, (sc) => { return sc._source.type === 'raster'; });
        for (const key in rasterSources) {
            const sourceCache = rasterSources[key];
            const coords = sourceCache.getVisibleCoordinates();
            const visibleTiles = coords.map((c)=>{ return sourceCache.getTile(c); });
            updateTileMasks(visibleTiles, this.gl);
        }

        // 3D pass
        // We first create a renderbuffer that we'll use to preserve depth
        // results across 3D layers, then render each 3D layer to its own
        // framebuffer/texture, which we'll use later in the translucent pass
        // to render to the main framebuffer. By doing this before we render to
        // the main framebuffer we won't have to do an expensive framebuffer
        // restore mid-render pass.
        // The most important distinction of the 3D pass is that we use the
        // depth buffer in an entirely different way (to represent 3D space)
        // than we do in the 2D pass (to preserve layer order).
        this.renderPass = '3d';
        {
            // We'll wait and only attach the depth renderbuffer if we think we're
            // rendering something.
            let first = true;

            let sourceCache;
            let coords = [];

            for (let i = 0; i < layerIds.length; i++) {
                const layer = this.style._layers[layerIds[i]];

                if (!layer.has3DPass() || layer.isHidden(this.transform.zoom)) continue;

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates();
                    }

                    coords.reverse();
                }

                if (!coords.length) continue;

                this._setup3DRenderbuffer();

                const renderTarget = layer.viewportFrame || new RenderTexture(this);
                layer.viewportFrame = renderTarget;
                renderTarget.bindWithDepth(this.depthRbo);

                if (first) {
                    this.clearDepth();
                    first = false;
                }

                this.renderLayer(this, (sourceCache: any), layer, coords);

                renderTarget.unbind();
            }
        }

        // Clear buffers in preparation for drawing to the main framebuffer
        this.clearColor();
        this.clearDepth();

        this.showOverdrawInspector(options.showOverdrawInspector);

        this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

        // Opaque pass
        // Draw opaque layers top-to-bottom first.
        this.renderPass = 'opaque';
        {
            let sourceCache;
            let coords = [];

            this.currentLayer = layerIds.length - 1;

            if (!this._showOverdrawInspector) {
                this.gl.disable(this.gl.BLEND);
            }

            for (this.currentLayer; this.currentLayer >= 0; this.currentLayer--) {
                const layer = this.style._layers[layerIds[this.currentLayer]];

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates();
                        if (sourceCache.getSource().isTileClipped) {
                            this._renderTileClippingMasks(coords);
                        }
                    }
                }

                this.renderLayer(this, (sourceCache: any), layer, coords);
            }
        }

        // Translucent pass
        // Draw all other layers bottom-to-top.
        this.renderPass = 'translucent';
        {
            let sourceCache;
            let coords = [];

            this.gl.enable(this.gl.BLEND);

            this.currentLayer = 0;

            for (this.currentLayer; this.currentLayer < layerIds.length; this.currentLayer++) {
                const layer = this.style._layers[layerIds[this.currentLayer]];

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates();
                        if (sourceCache.getSource().isTileClipped) {
                            this._renderTileClippingMasks(coords);
                        }
                    }

                    coords.reverse();
                }

                this.renderLayer(this, (sourceCache: any), layer, coords);
            }
        }

        if (this.options.showTileBoundaries) {
            const sourceCache = this.style.sourceCaches[Object.keys(this.style.sourceCaches)[0]];
            if (sourceCache) {
                draw.debug(this, sourceCache, sourceCache.getVisibleCoordinates());
            }
        }
    }

    _setup3DRenderbuffer() {
        // All of the 3D textures will use the same depth renderbuffer.
        if (!this.depthRbo) {
            const gl = this.gl;
            this.depthRbo = gl.createRenderbuffer();
            gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthRbo);
            gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, this.width, this.height);
            gl.bindRenderbuffer(gl.RENDERBUFFER, null);
        }

        this.depthRboAttached = true;
    }

    depthMask(mask: boolean) {
        if (mask !== this._depthMask) {
            this._depthMask = mask;
            this.gl.depthMask(mask);
        }
    }

    renderLayer(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<TileCoord>) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && !coords.length) return;
        this.id = layer.id;

        draw[layer.type](painter, sourceCache, layer, coords);
    }

    setDepthSublayer(n: number) {
        const farDepth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        const nearDepth = farDepth - 1 + this.depthRange;
        this.gl.depthRange(nearDepth, farDepth);
    }

    /**
     * Transform a matrix to incorporate the *-translate and *-translate-anchor properties into it.
     * @param inViewportPixelUnitsUnits True when the units accepted by the matrix are in viewport pixels instead of tile units.
     * @returns {Float32Array} matrix
     */
    translatePosMatrix(matrix: Float32Array, tile: Tile, translate: [number, number], translateAnchor: 'map' | 'viewport', inViewportPixelUnitsUnits?: boolean) {
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

    getTileTexture(size: number) {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    lineWidth(width: number) {
        this.gl.lineWidth(util.clamp(width, this.lineWidthRange[0], this.lineWidthRange[1]));
    }

    showOverdrawInspector(enabled: boolean) {
        if (!enabled && !this._showOverdrawInspector) return;
        this._showOverdrawInspector = enabled;

        const gl = this.gl;
        if (enabled) {
            gl.blendFunc(gl.CONSTANT_COLOR, gl.ONE);
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;
            gl.blendColor(a, a, a, 0);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
        } else {
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        }
    }

    _createProgramCached(name: string, programConfiguration: ProgramConfiguration): Program {
        this.cache = this.cache || {};
        const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
        if (!this.cache[key]) {
            this.cache[key] = new Program(this.gl, shaders[name], programConfiguration, this._showOverdrawInspector);
        }
        return this.cache[key];
    }

    useProgram(name: string, programConfiguration?: ProgramConfiguration): Program {
        const gl = this.gl;
        const nextProgram = this._createProgramCached(name, programConfiguration || this.emptyProgramConfiguration);

        if (this.currentProgram !== nextProgram) {
            gl.useProgram(nextProgram.program);
            this.currentProgram = nextProgram;
        }

        return nextProgram;
    }
}

module.exports = Painter;
