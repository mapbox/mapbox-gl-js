'use strict';

const browser = require('../util/browser');
const mat4 = require('gl-matrix').mat4;
const FrameHistory = require('./frame_history');
const SourceCache = require('../source/source_cache');
const EXTENT = require('../data/extent');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const util = require('../util/util');
const StructArrayType = require('../util/struct_array');
const Buffer = require('../data/buffer');
const VertexArrayObject = require('./vertex_array_object');
const RasterBoundsArray = require('./draw_raster').RasterBoundsArray;
const createUniformPragmas = require('./create_uniform_pragmas');
const assert = require('assert');
const shaders = require('mapbox-gl-shaders');
const utilSource = shaders.util;

const draw = {
    symbol: require('./draw_symbol'),
    circle: require('./draw_circle'),
    line: require('./draw_line'),
    fill: require('./draw_fill'),
    extrusion: require('./draw_extrusion'),
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

        this.reusableTextures = {};
        this.preFbos = {};

        this.frameHistory = new FrameHistory();

        this.setup();

        // Within each layer there are multiple distinct z-planes that can be drawn to.
        // This is implemented using the WebGL depth buffer.
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);

        this.lineWidthRange = gl.getParameter(gl.ALIASED_LINE_WIDTH_RANGE);
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

        const PosArray = this.PosArray = new StructArrayType({
            members: [{ name: 'a_pos', type: 'Int16', components: 2 }]
        });

        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = new Buffer(tileExtentArray.serialize(), PosArray.serialize(), Buffer.BufferType.VERTEX);
        this.tileExtentVAO = new VertexArrayObject();
        this.tileExtentPatternVAO = new VertexArrayObject();

        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(EXTENT, EXTENT);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(0, 0);
        this.debugBuffer = new Buffer(debugArray.serialize(), PosArray.serialize(), Buffer.BufferType.VERTEX);
        this.debugVAO = new VertexArrayObject();

        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, 32767, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, 32767);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, 32767, 32767);
        this.rasterBoundsBuffer = new Buffer(rasterBoundsArray.serialize(), RasterBoundsArray.serialize(), Buffer.BufferType.VERTEX);
        this.rasterBoundsVAO = new VertexArrayObject();
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
        for (let i = 0; i < coords.length; i++) {
            const coord = coords[i];
            const id = this._tileClippingMaskIDs[coord.id] = (idNext++) << 3;

            gl.stencilFunc(gl.ALWAYS, id, 0xF8);

            const pragmas = createUniformPragmas([
                {name: 'u_color', components: 4},
                {name: 'u_opacity', components: 1}
            ]);
            const program = this.useProgram('fill', [], pragmas, pragmas);
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

        this.frameHistory.record(this.transform.zoom);

        this.prepareBuffers();
        this.clearColor();
        this.clearDepth();

        this.showOverdrawInspector(options.showOverdrawInspector);

        this.depthRange = (style._order.length + 2) * this.numSublayers * this.depthEpsilon;

        this.renderPass({isOpaquePass: true});
        this.renderPass({isOpaquePass: false});
    }

    renderPass(options) {
        const groups = this.style._groups;
        const isOpaquePass = options.isOpaquePass;
        this.currentLayer = isOpaquePass ? this.style._order.length : -1;

        for (let i = 0; i < groups.length; i++) {
            const group = groups[isOpaquePass ? groups.length - 1 - i : i];
            const sourceCache = this.style.sourceCaches[group.source];

            let j;
            let coords = [];
            if (sourceCache) {
                coords = sourceCache.getVisibleCoordinates();
                for (j = 0; j < coords.length; j++) {
                    coords[j].posMatrix = this.transform.calculatePosMatrix(coords[j], sourceCache.getSource().maxzoom);
                }
                this.clearStencil();
                if (sourceCache.prepare) sourceCache.prepare();
                if (sourceCache.getSource().isTileClipped) {
                    this._renderTileClippingMasks(coords);
                }
            }

            if (isOpaquePass) {
                if (!this._showOverdrawInspector) {
                    this.gl.disable(this.gl.BLEND);
                }
                this.isOpaquePass = true;
            } else {
                this.gl.enable(this.gl.BLEND);
                this.isOpaquePass = false;
                coords.reverse();
            }

            for (j = 0; j < group.length; j++) {
                const layer = group[isOpaquePass ? group.length - 1 - j : j];
                this.currentLayer += isOpaquePass ? -1 : 1;
                this.renderLayer(this, sourceCache, layer, coords);
            }

            if (sourceCache) {
                draw.debug(this, sourceCache, coords);
            }
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

        let type = layer.type;
        if (type === 'fill' &&
            (!layer.isPaintValueFeatureConstant('fill-extrude-height') ||
            !layer.isPaintValueZoomConstant('fill-extrude-height') ||
            layer.getPaintValue('fill-extrude-height') !== 0)) {
            type = 'extrusion';
        }

        draw[type](painter, sourceCache, layer, coords);
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
        const textures = this.reusableTextures[texture.size];
        if (!textures) {
            this.reusableTextures[texture.size] = [texture];
        } else {
            textures.push(texture);
        }
    }

    saveViewportTexture(texture) {
        if (!this.reusableTextures.viewport) this.reusableTextures.viewport = {};
        this.reusableTextures.viewport.texture = texture;
    }

    getTileTexture(width, height) {
        const widthTextures = this.reusableTextures[width];
        if (widthTextures) {
            const textures = widthTextures[height || width];
            return textures && textures.length > 0 ? textures.pop() : null;
        }
    }

    getViewportTexture(width, height) {
        if (!this.reusableTextures.viewport) return;

        const texture = this.reusableTextures.viewport.texture;

        if (texture.width === width && texture.height === height) {
            return texture;
        } else {
            this.gl.deleteTexture(texture);
            this.reusableTextures.viewport.texture = null;
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

    _createProgram(name, defines, vertexPragmas, fragmentPragmas) {
        const gl = this.gl;
        const program = gl.createProgram();
        const definition = shaders[name];

        let definesSource = '#define MAPBOX_GL_JS;\n';
        for (let j = 0; j < defines.length; j++) {
            definesSource += `#define ${defines[j]};\n`;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, applyPragmas(definesSource + definition.fragmentSource, fragmentPragmas));
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(fragmentShader));
        gl.attachShader(program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, applyPragmas(definesSource + utilSource + definition.vertexSource, vertexPragmas));
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), gl.getShaderInfoLog(vertexShader));
        gl.attachShader(program, vertexShader);

        gl.linkProgram(program);
        assert(gl.getProgramParameter(program, gl.LINK_STATUS), gl.getProgramInfoLog(program));

        const attributes = {};
        const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const attribute = gl.getActiveAttrib(program, i);
            attributes[attribute.name] = gl.getAttribLocation(program, attribute.name);
        }

        const uniforms = {};
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let ui = 0; ui < numUniforms; ui++) {
            const uniform = gl.getActiveUniform(program, ui);
            uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
        }

        return util.extend({
            program: program,
            definition: definition,
            attributes: attributes,
            numAttributes: numAttributes
        }, attributes, uniforms);
    }

    _createProgramCached(name, defines, vertexPragmas, fragmentPragmas) {
        this.cache = this.cache || {};

        const key = JSON.stringify({
            name: name,
            defines: defines,
            vertexPragmas: vertexPragmas,
            fragmentPragmas: fragmentPragmas
        });

        if (!this.cache[key]) {
            this.cache[key] = this._createProgram(name, defines, vertexPragmas, fragmentPragmas);
        }
        return this.cache[key];
    }

    useProgram(nextProgramName, defines, vertexPragmas, fragmentPragmas) {
        const gl = this.gl;

        defines = defines || [];
        if (this._showOverdrawInspector) {
            defines = defines.concat('OVERDRAW_INSPECTOR');
        }

        const nextProgram = this._createProgramCached(nextProgramName, defines, vertexPragmas, fragmentPragmas);
        const previousProgram = this.currentProgram;

        if (previousProgram !== nextProgram) {
            gl.useProgram(nextProgram.program);
            this.currentProgram = nextProgram;
        }

        return nextProgram;
    }
}

function applyPragmas(source, pragmas) {
    return source.replace(/#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g, (match, operation, precision, type, name) => {
        return pragmas[operation][name].replace(/{type}/g, type).replace(/{precision}/g, precision);
    });
}

module.exports = Painter;
