// @flow

const browser = require('../util/browser');
const mat4 = require('@mapbox/gl-matrix').mat4;
const SourceCache = require('../source/source_cache');
const EXTENT = require('../data/extent');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const util = require('../util/util');
const VertexArrayObject = require('./vertex_array_object');
const RasterBoundsArray = require('../data/raster_bounds_array');
const PosArray = require('../data/pos_array');
const {ProgramConfiguration} = require('../data/program_configuration');
const CrossTileSymbolIndex = require('../symbol/cross_tile_symbol_index');
const shaders = require('../shaders');
const Program = require('./program');
const Context = require('../gl/context');
const Texture = require('./texture');
const updateTileMasks = require('./tile_mask');
const Color = require('../style-spec/util/color');

const draw = {
    symbol: require('./draw_symbol'),
    circle: require('./draw_circle'),
    heatmap: require('./draw_heatmap'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    'fill-extrusion': require('./draw_fill_extrusion'),
    hillshade: require('./draw_hillshade'),
    raster: require('./draw_raster'),
    background: require('./draw_background'),
    debug: require('./draw_debug')
};

import type Transform from '../geo/transform';
import type Tile from '../source/tile';
import type {OverscaledTileID} from '../source/tile_id';
import type Style from '../style/style';
import type StyleLayer from '../style/style_layer';
import type LineAtlas from './line_atlas';
import type ImageManager from './image_manager';
import type GlyphManager from './glyph_manager';
import type VertexBuffer from '../gl/vertex_buffer';

export type RenderPass = '3d' | 'hillshadeprepare' | 'opaque' | 'translucent';

type PainterOptions = {
    showOverdrawInspector: boolean,
    showTileBoundaries: boolean,
    rotating: boolean,
    zooming: boolean,
    fadeDuration: number
}

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {
    context: Context;
    transform: Transform;
    _tileTextures: { [number]: Array<Texture> };
    numSublayers: number;
    depthEpsilon: number;
    lineWidthRange: [number, number];
    emptyProgramConfiguration: ProgramConfiguration;
    width: number;
    height: number;
    depthRbo: WebGLRenderbuffer;
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
        this.context = new Context(gl);
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
        const gl = this.context.gl;

        this.width = width * browser.devicePixelRatio;
        this.height = height * browser.devicePixelRatio;
        this.context.viewport.set([0, 0, this.width, this.height]);

        if (this.style) {
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize(gl);
            }
        }

        if (this.depthRbo) {
            gl.deleteRenderbuffer(this.depthRbo);
            this.depthRbo = null;
        }
    }

    setup() {
        const context = this.context;
        const gl = this.context.gl;

        // We are blending the new pixels *behind* the existing pixels. That way we can
        // draw front-to-back and use then stencil buffer to cull opaque pixels early.
        context.blend.set(true);
        context.blendFunc.set([gl.ONE, gl.ONE_MINUS_SRC_ALPHA]);

        context.stencilTest.set(true);

        context.depthTest.set(true);
        context.depthFunc.set(gl.LEQUAL);

        context.depthMask.set(false);

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray);
        this.tileExtentVAO = new VertexArrayObject();
        this.tileExtentPatternVAO = new VertexArrayObject();

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(EXTENT, EXTENT);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(0, 0);
        this.debugBuffer = context.createVertexBuffer(debugArray);
        this.debugVAO = new VertexArrayObject();

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.rasterBoundsBuffer = context.createVertexBuffer(rasterBoundsArray);
        this.rasterBoundsVAO = new VertexArrayObject();

        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray);
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
     * Reset the drawing canvas by clearing the stencil buffer so that we can draw
     * new tiles at the same location, while retaining previously drawn pixels.
     */
    clearStencil() {
        const context = this.context;
        const gl = context.gl;

        // As a temporary workaround for https://github.com/mapbox/mapbox-gl-js/issues/5490,
        // pending an upstream fix, we draw a fullscreen stencil=0 clipping mask here,
        // effectively clearing the stencil buffer: once an upstream patch lands, remove
        // this function in favor of context.clear({ stencil: 0x0 })

        context.colorMask.set([false, false, false, false]);
        context.depthMask.set(false);
        context.depthTest.set(false);
        context.stencilTest.set(true);

        context.stencilMask.set(0xFF);
        context.stencilOp.set([gl.ZERO, gl.ZERO, gl.ZERO]);

        context.stencilFunc.set({ func: gl.ALWAYS, ref: 0x0, mask: 0xFF });

        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);

        const program = this.useProgram('fill', ProgramConfiguration.forTileClippingMask());
        gl.uniformMatrix4fv(program.uniforms.u_matrix, false, matrix);

        this.viewportVAO.bind(context, program, this.viewportBuffer);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        context.stencilMask.set(0x00);
        context.colorMask.set([true, true, true, true]);
        context.depthMask.set(true);
        context.depthTest.set(true);
    }

    _renderTileClippingMasks(tileIDs: Array<OverscaledTileID>) {
        const context = this.context;
        const gl = context.gl;
        context.colorMask.set([false, false, false, false]);
        context.depthMask.set(false);
        context.depthTest.set(false);
        context.stencilTest.set(true);

        context.stencilMask.set(0xFF);
        // Tests will always pass, and ref value will be written to stencil buffer.
        context.stencilOp.set([gl.KEEP, gl.KEEP, gl.REPLACE]);

        let idNext = 1;
        this._tileClippingMaskIDs = {};
        const programConfiguration = ProgramConfiguration.forTileClippingMask();

        for (const tileID of tileIDs) {
            const id = this._tileClippingMaskIDs[tileID.key] = idNext++;

            context.stencilFunc.set({ func: gl.ALWAYS, ref: id, mask: 0xFF });

            const program = this.useProgram('fill', programConfiguration);
            gl.uniformMatrix4fv(program.uniforms.u_matrix, false, tileID.posMatrix);

            // Draw the clipping mask
            this.tileExtentVAO.bind(this.context, program, this.tileExtentBuffer);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.length);
        }

        context.stencilMask.set(0x00);
        context.colorMask.set([true, true, true, true]);
        context.depthMask.set(true);
        context.depthTest.set(true);
    }

    enableTileClippingMask(tileID: OverscaledTileID) {
        const context = this.context;
        const gl = context.gl;
        context.stencilFunc.set({ func: gl.EQUAL, ref: this._tileClippingMaskIDs[tileID.key], mask: 0xFF });
    }

    render(style: Style, options: PainterOptions) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;

        const gl = this.context.gl;

        for (const id in style.sourceCaches) {
            const sourceCache = this.style.sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }
        }

        const layerIds = this.style._order;

        const rasterSources = util.filterObject(this.style.sourceCaches, (sc) => { return sc.getSource().type === 'raster' || sc.getSource().type === 'raster-dem'; });
        for (const key in rasterSources) {
            const sourceCache = rasterSources[key];
            const coords = sourceCache.getVisibleCoordinates();
            const visibleTiles = coords.map((c)=>{ return sourceCache.getTile(c); });
            updateTileMasks(visibleTiles, this.context);
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

                let renderTarget = layer.viewportFrame;
                if (!renderTarget) {
                    const texture = new Texture(this.context, {width: this.width, height: this.height, data: null}, gl.RGBA);
                    texture.bind(gl.LINEAR, gl.CLAMP_TO_EDGE);

                    renderTarget = this.context.createFramebuffer();
                    renderTarget.colorAttachment.set(texture.texture);
                    layer.viewportFrame = renderTarget;
                }

                this.context.bindFramebuffer.set(renderTarget.framebuffer);
                renderTarget.depthAttachment.set(this.depthRbo);

                if (first) {
                    this.context.clear({ depth: 1 });
                    first = false;
                }

                this.renderLayer(this, (sourceCache: any), layer, coords);
            }

            this.context.bindFramebuffer.set(null);
        }



        this.renderPass = 'hillshadeprepare';

        {
            let sourceCache;
            let coords = [];

            for (let i = 0; i < layerIds.length; i++) {
                const layer = this.style._layers[layerIds[i]];

                if (layer.type !== 'hillshade' || layer.isHidden(this.transform.zoom)) continue;

                if (layer.source !== (sourceCache && sourceCache.id)) {
                    sourceCache = this.style.sourceCaches[layer.source];
                    coords = [];

                    if (sourceCache) {
                        this.clearStencil();
                        coords = sourceCache.getVisibleCoordinates();
                    }

                    coords.reverse();
                }

                this.renderLayer(this, (sourceCache: any), layer, coords);
            }
        }


        // Clear buffers in preparation for drawing to the main framebuffer
        this.context.clear({ color: Color.transparent, depth: 1 });

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
                this.context.blend.set(false);
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

            this.context.blend.set(true);

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

    _setup3DRenderbuffer(): void {
        const context = this.context;
        // All of the 3D textures will use the same depth renderbuffer.
        if (!this.depthRbo) {
            this.depthRbo = context.createRenderbuffer(context.gl.DEPTH_COMPONENT16, this.width, this.height);
        }
    }

    renderLayer(painter: Painter, sourceCache: SourceCache, layer: StyleLayer, coords: Array<OverscaledTileID>) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && !coords.length) return;
        this.id = layer.id;

        draw[layer.type](painter, sourceCache, layer, coords);
    }

    setDepthSublayer(n: number) {
        const farDepth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        const nearDepth = farDepth - 1 + this.depthRange;
        this.context.depthRange.set([nearDepth, farDepth]);
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
        this.context.lineWidth.set(util.clamp(width, this.lineWidthRange[0], this.lineWidthRange[1]));
    }

    showOverdrawInspector(enabled: boolean) {
        if (!enabled && !this._showOverdrawInspector) return;
        this._showOverdrawInspector = enabled;

        const context = this.context;
        const gl = context.gl;
        if (enabled) {
            context.blendFunc.set([gl.CONSTANT_COLOR, gl.ONE]);
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;
            context.blendColor.set(new Color(a, a, a, 0));
            context.clear({ color: Color.black });
        } else {
            context.blendFunc.set([gl.ONE, gl.ONE_MINUS_SRC_ALPHA]);
        }
    }

    _createProgramCached(name: string, programConfiguration: ProgramConfiguration): Program {
        this.cache = this.cache || {};
        const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
        if (!this.cache[key]) {
            this.cache[key] = new Program(this.context, shaders[name], programConfiguration, this._showOverdrawInspector);
        }
        return this.cache[key];
    }

    useProgram(name: string, programConfiguration?: ProgramConfiguration): Program {
        const nextProgram = this._createProgramCached(name, programConfiguration || this.emptyProgramConfiguration);

        this.context.program.set(nextProgram.program);

        return nextProgram;
    }
}

module.exports = Painter;
