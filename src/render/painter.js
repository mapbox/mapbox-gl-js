'use strict';

const browser = require('../util/browser');
const mat4 = require('@mapbox/gl-matrix').mat4;
const FrameHistory = require('./frame_history');
const SourceCache = require('../source/source_cache');
const EXTENT = require('../data/extent');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const util = require('../util/util');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const RasterBoundsArray = require('../data/raster_bounds_array');
const PosArray = require('../data/pos_array');
const ProgramConfiguration = require('../data/program_configuration');
const shaders = require('./shaders');
const assert = require('assert');

const draw = {
    symbol: require('./draw_symbol'),
    circle: require('./draw_circle'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    'fill-extrusion': require('./draw_fill_extrusion'),
    raster: require('./draw_raster'),
    background: require('./draw_background'),
    debug: require('./draw_debug')
};

/**
 * Initialize a new painter object.
 *
 * @param {Canvas} gl an experimental-webgl drawing context
 * @private
 */
class Painter {
    constructor(gl, transform) {
        this.gl = gl;
        this.transform = transform;

        this.reusableTextures = {
            tiles: {},
            viewport: null
        };
        this.preFbos = {};

        this.frameHistory = new FrameHistory();

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);

        this.basicFillProgramConfiguration = ProgramConfiguration.createStatic(['color', 'opacity']);
        this.emptyProgramConfiguration = new ProgramConfiguration();
    }

    /*
     * Update the GL viewport, projection matrix, and transforms to compensate
     * for a new width and height value.
     */
    resize(width, height) {
        const gl = this.gl;

        this.width = width * browser.devicePixelRatio;
        this.height = height * browser.devicePixelRatio;
        gl.viewport(0, 0, this.width, this.height);
    }

    setup() {
        const gl = this.gl;

        gl.verbose = true;

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
        this.tileExtentBuffer = Buffer.fromStructArray(tileExtentArray, Buffer.BufferType.VERTEX);
        this.tileExtentVAO = new VertexArrayObject();
        this.tileExtentPatternVAO = new VertexArrayObject();

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(EXTENT, EXTENT);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(0, 0);
        this.debugBuffer = Buffer.fromStructArray(debugArray, Buffer.BufferType.VERTEX);
        this.debugVAO = new VertexArrayObject();

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, 32767, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, 32767);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, 32767, 32767);
        this.rasterBoundsBuffer = Buffer.fromStructArray(rasterBoundsArray, Buffer.BufferType.VERTEX);
        this.rasterBoundsVAO = new VertexArrayObject();

        this.extTextureFilterAnisotropic = (
            gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
        );
        if (this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
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
        gl.clearStencil(0x0);
        gl.stencilMask(0xFF);
        gl.clear(gl.STENCIL_BUFFER_BIT);
    }

    clearDepth() {
        const gl = this.gl;
        gl.clearDepth(1);
        this.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    _renderTileClippingMasks(coords) {
        const gl = this.gl;
        gl.colorMask(false, false, false, false);
        this.depthMask(false);
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.STENCIL_TEST);

        // Only write clipping IDs to the last 5 bits. The first three are used for drawing fills.
        gl.stencilMask(0xF8);
        // Tests will always pass, and ref value will be written to stencil buffer.
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

        let idNext = 1;
        this._tileClippingMaskIDs = {};

        for (const coord of coords) {
            const id = this._tileClippingMaskIDs[coord.id] = (idNext++) << 3;

            gl.stencilFunc(gl.ALWAYS, id, 0xF8);

            const program = this.useProgram('fill', this.basicFillProgramConfiguration);
            gl.uniformMatrix4fv(program.u_matrix, false, coord.posMatrix);

            // Draw the clipping mask
            this.tileExtentVAO.bind(gl, program, this.tileExtentBuffer);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.tileExtentBuffer.length);
        }

        gl.stencilMask(0x00);
        gl.colorMask(true, true, true, true);
        this.depthMask(true);
        gl.enable(gl.DEPTH_TEST);
    }

    enableTileClippingMask(coord) {
        const gl = this.gl;
        gl.stencilFunc(gl.EQUAL, this._tileClippingMaskIDs[coord.id], 0xF8);
    }

    // Overridden by headless tests.
    prepareBuffers() {}

    bindDefaultFramebuffer() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render(style, options) {
        this.style = style;
        this.options = options;

        this.lineAtlas = style.lineAtlas;

        this.spriteAtlas = style.spriteAtlas;
        this.spriteAtlas.setSprite(style.sprite);

        this.glyphSource = style.glyphSource;

        this.frameHistory.record(Date.now(), this.transform.zoom, style.getTransition().duration);

        this.prepareBuffers();
        this.clearColor();
        this.clearDepth();

        this.showOverdrawInspector(options.showOverdrawInspector);

        this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

        this.isOpaquePass = true;
        this.renderPass();
        this.isOpaquePass = false;
        this.renderPass();

        if (this.options.showTileBoundaries) {
            const sourceCache = this.style.sourceCaches[Object.keys(this.style.sourceCaches)[0]];
            if (sourceCache) {
                draw.debug(this, sourceCache, sourceCache.getVisibleCoordinates());
            }
        }
    }

    renderPass() {
        const layerIds = this.style._order;

        let sourceCache, coords;

        this.currentLayer = this.isOpaquePass ? layerIds.length - 1 : 0;

        if (this.isOpaquePass) {
            if (!this._showOverdrawInspector) {
                this.gl.disable(this.gl.BLEND);
            }
        } else {
            this.gl.enable(this.gl.BLEND);
        }

        for (let i = 0; i < layerIds.length; i++) {
            const layer = this.style._layers[layerIds[this.currentLayer]];

            if (layer.source !== (sourceCache && sourceCache.id)) {
                sourceCache = this.style.sourceCaches[layer.source];
                coords = [];

                if (sourceCache) {
                    if (sourceCache.prepare) sourceCache.prepare();
                    this.clearStencil();
                    coords = sourceCache.getVisibleCoordinates();
                    if (sourceCache.getSource().isTileClipped) {
                        this._renderTileClippingMasks(coords);
                    }
                }

                if (!this.isOpaquePass) {
                    coords.reverse();
                }
            }

            this.renderLayer(this, sourceCache, layer, coords);
            this.currentLayer += this.isOpaquePass ? -1 : 1;
        }
    }

    depthMask(mask) {
        if (mask !== this._depthMask) {
            this._depthMask = mask;
            this.gl.depthMask(mask);
        }
    }

    renderLayer(painter, sourceCache, layer, coords) {
        if (layer.isHidden(this.transform.zoom)) return;
        if (layer.type !== 'background' && !coords.length) return;
        this.id = layer.id;

        draw[layer.type](painter, sourceCache, layer, coords);
    }

    setDepthSublayer(n) {
        const farDepth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        const nearDepth = farDepth - 1 + this.depthRange;
        this.gl.depthRange(nearDepth, farDepth);
    }

    translatePosMatrix(matrix, tile, translate, anchor) {
        if (!translate[0] && !translate[1]) return matrix;

        if (anchor === 'viewport') {
            const sinA = Math.sin(-this.transform.angle);
            const cosA = Math.cos(-this.transform.angle);
            translate = [
                translate[0] * cosA - translate[1] * sinA,
                translate[0] * sinA + translate[1] * cosA
            ];
        }

        const translation = [
            pixelsToTileUnits(tile, translate[0], this.transform.zoom),
            pixelsToTileUnits(tile, translate[1], this.transform.zoom),
            0
        ];

        const translatedMatrix = new Float32Array(16);
        mat4.translate(translatedMatrix, matrix, translation);
        return translatedMatrix;
    }

    saveTileTexture(texture) {
        const textures = this.reusableTextures.tiles[texture.size];
        if (!textures) {
            this.reusableTextures.tiles[texture.size] = [texture];
        } else {
            textures.push(texture);
        }
    }

    saveViewportTexture(texture) {
        this.reusableTextures.viewport = texture;
    }

    getTileTexture(size) {
        const textures = this.reusableTextures.tiles[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }

    getViewportTexture(width, height) {
        const texture = this.reusableTextures.viewport;
        if (!texture) return;

        if (texture.width === width && texture.height === height) {
            return texture;
        } else {
            this.gl.deleteTexture(texture);
            this.reusableTextures.viewport = null;
            return;
        }
    }

    lineWidth(width) {
        this.gl.lineWidth(util.clamp(width, this.lineWidthRange[0], this.lineWidthRange[1]));
    }

    showOverdrawInspector(enabled) {
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

    createProgram(name, configuration) {
        const gl = this.gl;
        const program = gl.createProgram();
        const definition = shaders[name];

        let definesSource = `#define MAPBOX_GL_JS\n#define DEVICE_PIXEL_RATIO ${browser.devicePixelRatio.toFixed(1)}\n`;
        if (this._showOverdrawInspector) {
            definesSource += '#define OVERDRAW_INSPECTOR;\n';
        }

        const fragmentSource = configuration.applyPragmas(definesSource + shaders.prelude.fragmentSource + definition.fragmentSource, 'fragment');
        const vertexSource = configuration.applyPragmas(definesSource + shaders.prelude.vertexSource + definition.vertexSource, 'vertex');

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
        gl.attachShader(program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
        gl.attachShader(program, vertexShader);

        gl.linkProgram(program);
        assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));

        const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        const result = {program, numAttributes};

        for (let i = 0; i < numAttributes; i++) {
            const attribute = gl.getActiveAttrib(program, i);
            result[attribute.name] = gl.getAttribLocation(program, attribute.name);
        }
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const uniform = gl.getActiveUniform(program, i);
            result[uniform.name] = gl.getUniformLocation(program, uniform.name);
        }
        return result;
    }

    _createProgramCached(name, programConfiguration) {
        this.cache = this.cache || {};
        const key = `${name}${programConfiguration.cacheKey || ''}${this._showOverdrawInspector ? '/overdraw' : ''}`;
        if (!this.cache[key]) {
            this.cache[key] = this.createProgram(name, programConfiguration);
        }
        return this.cache[key];
    }

    useProgram(name, programConfiguration) {
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
