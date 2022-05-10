// @flow

import {
    prelude,
    preludeFragPrecisionQualifiers,
    preludeVertPrecisionQualifiers,
    preludeTerrain,
    preludeFog,
    preludeCommonSource,
    standardDerivativesExt
} from '../shaders/shaders.js';
import assert from 'assert';
import ProgramConfiguration from '../data/program_configuration.js';
import VertexArrayObject from './vertex_array_object.js';
import Context from '../gl/context.js';
import {terrainUniforms} from '../terrain/terrain.js';
import type {TerrainUniformsType} from '../terrain/terrain.js';
import {fogUniforms} from './fog.js';
import type {FogUniformsType} from './fog.js';

import type SegmentVector from '../data/segment.js';
import type VertexBuffer from '../gl/vertex_buffer.js';
import type IndexBuffer from '../gl/index_buffer.js';
import type DepthMode from '../gl/depth_mode.js';
import type StencilMode from '../gl/stencil_mode.js';
import type ColorMode from '../gl/color_mode.js';
import type CullFaceMode from '../gl/cull_face_mode.js';
import type {UniformBindings, UniformValues, UniformLocations} from './uniform_binding.js';
import type {BinderUniform} from '../data/program_configuration.js';

export type DrawMode =
    | $PropertyType<WebGLRenderingContext, 'LINES'>
    | $PropertyType<WebGLRenderingContext, 'TRIANGLES'>
    | $PropertyType<WebGLRenderingContext, 'LINE_STRIP'>;

function getTokenizedAttributesAndUniforms (array: Array<string>): Array<string> {
    const result = [];

    for (let i = 0; i < array.length; i++) {
        if (array[i] === null) continue;
        const token = array[i].split(' ');
        result.push(token.pop());
    }
    return result;
}
class Program<Us: UniformBindings> {
    program: WebGLProgram;
    attributes: {[_: string]: number};
    numAttributes: number;
    fixedUniforms: Us;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;
    terrainUniforms: ?TerrainUniformsType;
    fogUniforms: ?FogUniformsType;

    static cacheKey(name: string, defines: string[], programConfiguration: ?ProgramConfiguration): string {
        let key = `${name}${programConfiguration ? programConfiguration.cacheKey : ''}`;
        for (const define of defines) {
            key += `/${define}`;
        }
        return key;
    }

    constructor(context: Context,
                name: string,
                source: {fragmentSource: string, vertexSource: string, staticAttributes: Array<string>, staticUniforms: Array<string>},
                configuration: ?ProgramConfiguration,
                fixedUniforms: (Context, UniformLocations) => Us,
                fixedDefines: string[]) {
        const gl = context.gl;
        this.program = gl.createProgram();

        const staticAttrInfo = getTokenizedAttributesAndUniforms(source.staticAttributes);
        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = staticAttrInfo.concat(dynamicAttrInfo);

        const staticUniformsInfo = source.staticUniforms ? getTokenizedAttributesAndUniforms(source.staticUniforms) : [];
        const dynamicUniformsInfo = configuration ? configuration.getBinderUniforms() : [];
        // remove duplicate uniforms
        const uniformList = staticUniformsInfo.concat(dynamicUniformsInfo);
        const allUniformsInfo = [];
        for (const uniform of uniformList) {
            if (allUniformsInfo.indexOf(uniform) < 0) allUniformsInfo.push(uniform);
        }

        let defines = configuration ? configuration.defines() : [];
        defines = defines.concat(fixedDefines.map((define) => `#define ${define}`));

        const fragmentSource = defines.concat(
            context.extStandardDerivatives ? standardDerivativesExt.concat(preludeFragPrecisionQualifiers) : preludeFragPrecisionQualifiers,
            preludeFragPrecisionQualifiers,
            preludeCommonSource,
            prelude.fragmentSource,
            preludeFog.fragmentSource,
            source.fragmentSource).join('\n');
        const vertexSource = defines.concat(
            preludeVertPrecisionQualifiers,
            preludeCommonSource,
            prelude.vertexSource,
            preludeFog.vertexSource,
            preludeTerrain.vertexSource,
            source.vertexSource).join('\n');
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(fragmentShader): any));
        gl.attachShader(this.program, fragmentShader);

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(vertexShader): any));
        gl.attachShader(this.program, vertexShader);

        this.attributes = {};
        const uniformLocations = {};

        this.numAttributes = allAttrInfo.length;

        for (let i = 0; i < this.numAttributes; i++) {
            if (allAttrInfo[i]) {
                gl.bindAttribLocation(this.program, i, allAttrInfo[i]);
                this.attributes[allAttrInfo[i]] = i;
            }
        }

        gl.linkProgram(this.program);
        assert(gl.getProgramParameter(this.program, gl.LINK_STATUS), (gl.getProgramInfoLog(this.program): any));

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        for (let it = 0; it < allUniformsInfo.length; it++) {
            const uniform = allUniformsInfo[it];
            if (uniform && !uniformLocations[uniform]) {
                const uniformLocation = gl.getUniformLocation(this.program, uniform);
                if (uniformLocation) {
                    uniformLocations[uniform] = uniformLocation;
                }
            }
        }

        this.fixedUniforms = fixedUniforms(context, uniformLocations);
        this.binderUniforms = configuration ? configuration.getUniforms(context, uniformLocations) : [];
        if (fixedDefines.indexOf('TERRAIN') !== -1) {
            this.terrainUniforms = terrainUniforms(context, uniformLocations);
        }
        if (fixedDefines.indexOf('FOG') !== -1) {
            this.fogUniforms = fogUniforms(context, uniformLocations);
        }
    }

    setTerrainUniformValues(context: Context, terrainUniformValues: UniformValues<TerrainUniformsType>) {
        if (!this.terrainUniforms) return;
        const uniforms: TerrainUniformsType = this.terrainUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in terrainUniformValues) {
            uniforms[name].set(terrainUniformValues[name]);
        }
    }

    setFogUniformValues(context: Context, fogUniformsValues: UniformValues<FogUniformsType>) {
        if (!this.fogUniforms) return;
        const uniforms: FogUniformsType = this.fogUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in fogUniformsValues) {
            if (uniforms[name].location) {
                uniforms[name].set(fogUniformsValues[name]);
            }
        }
    }

    draw(
         context: Context,
         drawMode: DrawMode,
         depthMode: $ReadOnly<DepthMode>,
         stencilMode: $ReadOnly<StencilMode>,
         colorMode: $ReadOnly<ColorMode>,
         cullFaceMode: $ReadOnly<CullFaceMode>,
         uniformValues: UniformValues<Us>,
         layerID: string,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: IndexBuffer,
         segments: SegmentVector,
         currentProperties: any,
         zoom: ?number,
         configuration: ?ProgramConfiguration,
         dynamicLayoutBuffer: ?VertexBuffer,
         dynamicLayoutBuffer2: ?VertexBuffer,
         dynamicLayoutBuffer3: ?VertexBuffer) {

        const gl = context.gl;

        if (this.failedToCreate) return;

        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        for (const name of Object.keys(this.fixedUniforms)) {
            this.fixedUniforms[name].set(uniformValues[name]);
        }

        if (configuration) {
            configuration.setUniforms(context, this.binderUniforms, currentProperties, {zoom: (zoom: any)});
        }

        const primitiveSize = {
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];

        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao: VertexArrayObject = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());

            vao.bind(
                context,
                this,
                layoutVertexBuffer,
                configuration ? configuration.getPaintVertexBuffers() : [],
                indexBuffer,
                segment.vertexOffset,
                dynamicLayoutBuffer,
                dynamicLayoutBuffer2,
                dynamicLayoutBuffer3
            );

            gl.drawElements(
                drawMode,
                segment.primitiveLength * primitiveSize,
                gl.UNSIGNED_SHORT,
                segment.primitiveOffset * primitiveSize * 2);
        }
    }
}

export default Program;
