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
import type {UniformBindings, UniformValues} from './uniform_binding.js';
import type {BinderUniform} from '../data/program_configuration.js';

export type DrawMode =
    | $PropertyType<WebGLRenderingContext, 'LINES'>
    | $PropertyType<WebGLRenderingContext, 'TRIANGLES'>
    | $PropertyType<WebGLRenderingContext, 'LINE_STRIP'>;

type ShaderSource = {
    fragmentSource: string,
    vertexSource: string,
    staticAttributes: Array<string>,
    usedDefines: Array<string>
};

function getTokenizedAttributes(array: Array<string>): Array<string> {
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

    static cacheKey(source: ShaderSource, name: string, defines: string[], programConfiguration: ?ProgramConfiguration): string {
        let key = `${name}${programConfiguration ? programConfiguration.cacheKey : ''}`;
        for (const define of defines) {
            if (source.usedDefines.includes(define)) {
                key += `/${define}`;
            }
        }
        return key;
    }

    constructor(context: Context,
                name: string,
                source: ShaderSource,
                configuration: ?ProgramConfiguration,
                fixedUniforms: (Context) => Us,
                fixedDefines: string[]) {
        const gl = context.gl;
        this.program = gl.createProgram();

        const staticAttrInfo = getTokenizedAttributes(source.staticAttributes);
        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = staticAttrInfo.concat(dynamicAttrInfo);

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

        this.fixedUniforms = fixedUniforms(context);
        this.binderUniforms = configuration ? configuration.getUniforms(context) : [];
        if (fixedDefines.indexOf('TERRAIN') !== -1) {
            this.terrainUniforms = terrainUniforms(context);
        }
        if (fixedDefines.indexOf('FOG') !== -1) {
            this.fogUniforms = fogUniforms(context);
        }
    }

    setTerrainUniformValues(context: Context, terrainUniformValues: UniformValues<TerrainUniformsType>) {
        if (!this.terrainUniforms) return;
        const uniforms: TerrainUniformsType = this.terrainUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in terrainUniformValues) {
            uniforms[name].set(this.program, name, terrainUniformValues[name]);
        }
    }

    setFogUniformValues(context: Context, fogUniformsValues: UniformValues<FogUniformsType>) {
        if (!this.fogUniforms) return;
        const uniforms: FogUniformsType = this.fogUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in fogUniformsValues) {
            uniforms[name].set(this.program, name, fogUniformsValues[name]);
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
         dynamicLayoutBuffers: ?Array<?VertexBuffer>) {

        const gl = context.gl;

        if (this.failedToCreate) return;

        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);

        for (const name of Object.keys(this.fixedUniforms)) {
            this.fixedUniforms[name].set(this.program, name, uniformValues[name]);
        }

        if (configuration) {
            configuration.setUniforms(this.program, context, this.binderUniforms, currentProperties, {zoom: (zoom: any)});
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
                dynamicLayoutBuffers ? dynamicLayoutBuffers : []
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
