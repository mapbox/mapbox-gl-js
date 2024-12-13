import {
    prelude,
    preludeFragPrecisionQualifiers,
    preludeVertPrecisionQualifiers,
    preludeCommonSource,
    includeMap,
} from '../shaders/shaders';
import assert from 'assert';
import VertexArrayObject from './vertex_array_object';
import {terrainUniforms, globeUniforms} from '../terrain/terrain';
import {fogUniforms} from './fog';
import {cutoffUniforms} from './cutoff';
import {lightsUniforms} from '../../3d-style/render/lights';
import {shadowUniforms} from '../../3d-style/render/shadow_uniforms';
import DepthMode from '../gl/depth_mode';
import StencilMode from '../gl/stencil_mode';
import ColorMode from '../gl/color_mode';
import Color from '../style-spec/util/color';
import {Uniform1i} from './uniform_binding';

import type ProgramConfiguration from '../data/program_configuration';
import type Context from '../gl/context';
import type {TerrainUniformsType, GlobeUniformsType} from '../terrain/terrain';
import type {FogUniformsType} from './fog';
import type {CutoffUniformsType} from './cutoff';
import type {LightsUniformsType} from '../../3d-style/render/lights';
import type {ShadowUniformsType} from '../../3d-style/render/shadow_uniforms';
import type SegmentVector from '../data/segment';
import type VertexBuffer from '../gl/vertex_buffer';
import type IndexBuffer from '../gl/index_buffer';
import type CullFaceMode from '../gl/cull_face_mode';
import type {UniformBindings, UniformValues} from './uniform_binding';
import type {BinderUniform} from '../data/program_configuration';
import type Painter from './painter';
import type {Segment} from "../data/segment";
import type {DynamicDefinesType} from '../render/program/program_uniforms';

export type DrawMode = WebGL2RenderingContext['POINTS'] | WebGL2RenderingContext['LINES'] | WebGL2RenderingContext['TRIANGLES'] | WebGL2RenderingContext['LINE_STRIP'];

type ShaderSource = {
    fragmentSource: string;
    vertexSource: string;
    staticAttributes: Array<string>;
    usedDefines: Array<DynamicDefinesType>;
    vertexIncludes: Array<string>;
    fragmentIncludes: Array<string>;
};

const debugWireframe2DLayerProgramNames = [
    'fill', 'fillOutline', 'fillPattern',
    'line', 'linePattern',
    'background', 'backgroundPattern',
    "hillshade",
    "raster"];

const debugWireframe3DLayerProgramNames = [
    "stars",
    "rainParticle",
    "snowParticle",
    "fillExtrusion",  "fillExtrusionGroundEffect",
    "model",
    "symbol"];

type InstancingUniformType = {
    ['u_instanceID']: Uniform1i;
}

const instancingUniforms = (context: Context): InstancingUniformType => ({
    'u_instanceID': new Uniform1i(context)});

class Program<Us extends UniformBindings> {
    program: WebGLProgram;
    attributes: {
        [_: string]: number;
    };
    numAttributes: number;
    fixedUniforms: Us;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;
    terrainUniforms: TerrainUniformsType | null | undefined;
    fogUniforms: FogUniformsType | null | undefined;
    cutoffUniforms: CutoffUniformsType | null | undefined;
    lightsUniforms: LightsUniformsType | null | undefined;
    globeUniforms: GlobeUniformsType | null | undefined;
    shadowUniforms: ShadowUniformsType | null | undefined;

    name: string;
    configuration: ProgramConfiguration | null | undefined;
    fixedDefines: DynamicDefinesType[];

    // Manually handle instancing by issuing draw calls and replacing gl_InstanceID with uniform
    forceManualRenderingForInstanceIDShaders: boolean;
    instancingUniforms: InstancingUniformType | null | undefined;

    static cacheKey(
        source: ShaderSource,
        name: string,
        defines: DynamicDefinesType[],
        programConfiguration?: ProgramConfiguration | null,
    ): string {
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
                configuration: ProgramConfiguration | null | undefined,
                fixedUniforms: (arg1: Context) => Us,
                fixedDefines: DynamicDefinesType[]) {
        const gl = context.gl;
        this.program = (gl.createProgram());

        this.configuration = configuration;
        this.name = name;
        this.fixedDefines = [...fixedDefines];

        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = (source.staticAttributes || []).concat(dynamicAttrInfo);

        let defines = configuration ? configuration.defines() : [];
        defines = defines.concat(fixedDefines.map((define) => `#define ${define}`));
        const version = '#version 300 es\n';

        let fragmentSource = version + defines.concat(
            preludeFragPrecisionQualifiers,
            preludeCommonSource,
            prelude.fragmentSource).join('\n');
        for (const include of source.fragmentIncludes) {
            fragmentSource += `\n${includeMap[include]}`;
        }
        fragmentSource += `\n${source.fragmentSource}`;

        let vertexSource = version + defines.concat(
            preludeVertPrecisionQualifiers,
            preludeCommonSource,
            prelude.vertexSource).join('\n');
        for (const include of source.vertexIncludes) {
            vertexSource += `\n${includeMap[include]}`;
        }

        this.forceManualRenderingForInstanceIDShaders = context.forceManualRenderingForInstanceIDShaders && source.vertexSource.indexOf("gl_InstanceID") !== -1;

        if (this.forceManualRenderingForInstanceIDShaders) {
            vertexSource += `\nuniform int u_instanceID;\n`;
        }

        vertexSource += `\n${source.vertexSource}`;

        if (this.forceManualRenderingForInstanceIDShaders) {
            vertexSource = vertexSource.replaceAll("gl_InstanceID", "u_instanceID");
        }

        // Replace

        const fragmentShader = (gl.createShader(gl.FRAGMENT_SHADER));
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        assert(gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(fragmentShader) as any));
        gl.attachShader(this.program, fragmentShader);

        const vertexShader = (gl.createShader(gl.VERTEX_SHADER));
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        assert(gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS), (gl.getShaderInfoLog(vertexShader) as any));
        gl.attachShader(this.program, vertexShader);

        this.attributes = {};

        this.numAttributes = allAttrInfo.length;

        for (let i = 0; i < this.numAttributes; i++) {
            if (allAttrInfo[i]) {
                // Handle pragma defined attributes
                const attributeName = allAttrInfo[i].startsWith('a_') ? allAttrInfo[i] : `a_${allAttrInfo[i]}`;
                gl.bindAttribLocation(this.program, i, attributeName);
                this.attributes[attributeName] = i;
            }
        }

        gl.linkProgram(this.program);
        assert(gl.getProgramParameter(this.program, gl.LINK_STATUS), (gl.getProgramInfoLog(this.program) as any));

        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.fixedUniforms = fixedUniforms(context);
        this.binderUniforms = configuration ? configuration.getUniforms(context) : [];

        if (this.forceManualRenderingForInstanceIDShaders) {
            this.instancingUniforms = instancingUniforms(context);
        }

        // Symbol and circle layer are depth (terrain + 3d layers) occluded
        // For the sake of native compatibility depth occlusion goes via terrain uniforms block
        if (fixedDefines.includes('TERRAIN') || name.indexOf("symbol") !== -1 || name.indexOf("circle") !== -1) {
            this.terrainUniforms = terrainUniforms(context);
        }
        if (fixedDefines.includes('GLOBE')) {
            this.globeUniforms = globeUniforms(context);
        }
        if (fixedDefines.includes('FOG')) {
            this.fogUniforms = fogUniforms(context);
        }
        if (fixedDefines.includes('RENDER_CUTOFF')) {
            this.cutoffUniforms = cutoffUniforms(context);
        }
        if (fixedDefines.includes('LIGHTING_3D_MODE')) {
            this.lightsUniforms = lightsUniforms(context);
        }
        if (fixedDefines.includes('RENDER_SHADOWS')) {
            this.shadowUniforms = shadowUniforms(context);
        }
    }

    setTerrainUniformValues(context: Context, terrainUniformValues: UniformValues<TerrainUniformsType>) {
        if (!this.terrainUniforms) return;
        const uniforms: TerrainUniformsType = this.terrainUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in terrainUniformValues) {
            if (uniforms[name]) {
                uniforms[name].set(this.program, name, terrainUniformValues[name]);
            }
        }
    }

    setGlobeUniformValues(context: Context, globeUniformValues: UniformValues<GlobeUniformsType>) {
        if (!this.globeUniforms) return;
        const uniforms: GlobeUniformsType = this.globeUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in globeUniformValues) {
            if (uniforms[name]) {
                uniforms[name].set(this.program, name, globeUniformValues[name]);
            }
        }
    }

    setFogUniformValues(context: Context, fogUniformValues: UniformValues<FogUniformsType>) {
        if (!this.fogUniforms) return;
        const uniforms: FogUniformsType = this.fogUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in fogUniformValues) {
            uniforms[name].set(this.program, name, fogUniformValues[name]);
        }
    }

    setCutoffUniformValues(context: Context, cutoffUniformValues: UniformValues<CutoffUniformsType>) {
        if (!this.cutoffUniforms) return;
        const uniforms: CutoffUniformsType = this.cutoffUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in cutoffUniformValues) {
            uniforms[name].set(this.program, name, cutoffUniformValues[name]);
        }
    }

    setLightsUniformValues(context: Context, lightsUniformValues: UniformValues<LightsUniformsType>) {
        if (!this.lightsUniforms) return;
        const uniforms: LightsUniformsType = this.lightsUniforms;

        if (this.failedToCreate) return;
        context.program.set(this.program);

        for (const name in lightsUniformValues) {
            uniforms[name].set(this.program, name, lightsUniformValues[name]);
        }
    }

    setShadowUniformValues(context: Context, shadowUniformValues: UniformValues<ShadowUniformsType>) {
        if (this.failedToCreate || !this.shadowUniforms) return;

        const uniforms: ShadowUniformsType = this.shadowUniforms;
        context.program.set(this.program);

        for (const name in shadowUniformValues) {
            uniforms[name].set(this.program, name, shadowUniformValues[name]);
        }
    }

    _drawDebugWireframe(painter: Painter, depthMode: Readonly<DepthMode>,
        stencilMode: Readonly<StencilMode>,
        colorMode: Readonly<ColorMode>,
        indexBuffer: IndexBuffer, segment: Segment,
        currentProperties: any, zoom?: number | null, configuration?: ProgramConfiguration | null, instanceCount?: number | null) {

        const wireframe = painter.options.wireframe;

        if (wireframe.terrain === false && wireframe.layers2D === false && wireframe.layers3D === false) {
            return;
        }

        const context = painter.context;

        const subjectForWireframe = (() => {
            // Terrain
            if (wireframe.terrain && (this.name === 'terrainRaster' || this.name === 'globeRaster')) {
                return true;
            }

            const drapingInProgress = painter._terrain && painter._terrain.renderingToTexture;

            // 2D
            if (wireframe.layers2D && !drapingInProgress) {
                if (debugWireframe2DLayerProgramNames.includes(this.name)) {
                    return true;
                }
            }

            // 3D
            if (wireframe.layers3D) {
                if (debugWireframe3DLayerProgramNames.includes(this.name)) {
                    return true;
                }
            }

            return false;
        })();

        if (!subjectForWireframe) {
            return;
        }

        const gl = context.gl;
        const linesIndexBuffer = painter.wireframeDebugCache.getLinesFromTrianglesBuffer(painter.frameCounter, indexBuffer, context);

        if (!linesIndexBuffer) {
            return;
        }

        const debugDefines = [...this.fixedDefines] as DynamicDefinesType[];
        debugDefines.push('DEBUG_WIREFRAME');
        const debugProgram = painter.getOrCreateProgram(this.name, {config: this.configuration, defines: debugDefines});

        context.program.set(debugProgram.program);

        const copyUniformValues = (group: string, pSrc: any, pDst: any) => {
            if (pSrc[group] && pDst[group]) {
                for (const name in pSrc[group]) {
                    if (pDst[group][name]) {
                        pDst[group][name].set(pDst.program, name, pSrc[group][name].current);
                    }
                }
            }
        };

        if (configuration) {
            configuration.setUniforms(debugProgram.program, context, debugProgram.binderUniforms, currentProperties, {zoom: (zoom as any)});
        }

        copyUniformValues("fixedUniforms", this, debugProgram);
        copyUniformValues("terrainUniforms", this, debugProgram);
        copyUniformValues("globeUniforms", this, debugProgram);
        copyUniformValues("fogUniforms", this, debugProgram);
        copyUniformValues("lightsUniforms", this, debugProgram);
        copyUniformValues("shadowUniforms", this, debugProgram);

        linesIndexBuffer.bind();

        // Debug wireframe uses premultiplied alpha blending (alpha channel is left unchanged)
        context.setColorMode(new ColorMode([gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE],
            Color.transparent, [true, true, true, false]));
        context.setDepthMode(new DepthMode(depthMode.func === gl.LESS ? gl.LEQUAL : depthMode.func, DepthMode.ReadOnly, depthMode.range));
        context.setStencilMode(StencilMode.disabled);

        const count = segment.primitiveLength * 3 * 2; // One triangle corresponds to 3 lines (each has 2 indices)
        const offset = segment.primitiveOffset * 3 * 2 * 2; // One triangles corresponds to 3 lines (2 indices * 2 bytes per index)

        if (this.forceManualRenderingForInstanceIDShaders) {
            const renderInstanceCount = instanceCount ? instanceCount : 1;
            for (let i = 0; i < renderInstanceCount; ++i) {
                debugProgram.instancingUniforms["u_instanceID"].set(this.program, "u_instanceID", i);

                gl.drawElements(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset
                );
            }
        } else {
            if (instanceCount && instanceCount > 1) {
                gl.drawElementsInstanced(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset,
                    instanceCount);
            } else {
                gl.drawElements(
                    gl.LINES,
                    count,
                    gl.UNSIGNED_SHORT,
                    offset
                );
            }
        }

        // Revert to non-wireframe parameters
        indexBuffer.bind();
        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
    }

    checkUniforms(name: string, define: DynamicDefinesType, uniforms: any) {
        if (this.fixedDefines.includes(define)) {
            for (const key of Object.keys(uniforms)) {
                if (!uniforms[key].initialized) {
                    throw new Error(`Program '${this.name}', from draw '${name}': uniform ${key} not set but required by ${define} being defined`);
                }
            }
        }
    }

    draw(
         painter: Painter,
         drawMode: DrawMode,
         depthMode: Readonly<DepthMode>,
         stencilMode: Readonly<StencilMode>,
         colorMode: Readonly<ColorMode>,
         cullFaceMode: Readonly<CullFaceMode>,
         uniformValues: UniformValues<Us>,
         layerID: string,
         layoutVertexBuffer: VertexBuffer,
         indexBuffer: IndexBuffer | undefined,
         segments: SegmentVector,
         currentProperties: any,
         zoom?: number | null,
         configuration?: ProgramConfiguration | null,
         dynamicLayoutBuffers?: Array<VertexBuffer | null | undefined> | null,
         instanceCount?: number | null) {

        const context = painter.context;
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
            configuration.setUniforms(this.program, context, this.binderUniforms, currentProperties, {zoom: (zoom as any)});
        }

        const primitiveSize = {
            [gl.POINTS]: 1,
            [gl.LINES]: 2,
            [gl.TRIANGLES]: 3,
            [gl.LINE_STRIP]: 1
        }[drawMode];

        this.checkUniforms(layerID, 'RENDER_SHADOWS', this.shadowUniforms);

        const vertexAttribDivisorValue = instanceCount && instanceCount > 0 ? 1 : undefined;
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
                dynamicLayoutBuffers ? dynamicLayoutBuffers : [],
                vertexAttribDivisorValue
            );

            if (this.forceManualRenderingForInstanceIDShaders) {
                const renderInstanceCount = instanceCount ? instanceCount : 1;

                for (let i = 0; i < renderInstanceCount; ++i) {
                    this.instancingUniforms["u_instanceID"].set(this.program, "u_instanceID", i);

                    if (indexBuffer) {
                        gl.drawElements(
                            drawMode,
                            segment.primitiveLength * primitiveSize,
                            gl.UNSIGNED_SHORT,
                            segment.primitiveOffset * primitiveSize * 2);
                    } else {
                        gl.drawArrays(drawMode, segment.vertexOffset, segment.vertexLength);
                    }
                }
            } else {
                if (instanceCount && instanceCount > 1) {
                    assert(indexBuffer);
                    gl.drawElementsInstanced(
                        drawMode,
                        segment.primitiveLength * primitiveSize,
                        gl.UNSIGNED_SHORT,
                        segment.primitiveOffset * primitiveSize * 2,
                        instanceCount);
                } else if (indexBuffer) {
                    gl.drawElements(
                        drawMode,
                        segment.primitiveLength * primitiveSize,
                        gl.UNSIGNED_SHORT,
                        segment.primitiveOffset * primitiveSize * 2);
                } else {
                    gl.drawArrays(drawMode, segment.vertexOffset, segment.vertexLength);
                }
            }
            if (drawMode === gl.TRIANGLES && indexBuffer) {
                // Handle potential wireframe rendering for current draw call
                this._drawDebugWireframe(painter, depthMode, stencilMode, colorMode, indexBuffer, segment,
                    currentProperties, zoom, configuration, instanceCount);
            }
        }
    }
}

export default Program;
