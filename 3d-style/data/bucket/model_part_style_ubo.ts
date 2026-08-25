import type Context from '../../../src/gl/context';

// Must stay in step with MODEL_PART_COUNT in model.vertex.glsl, and with PartNames in
// tiled_3d_model_bucket.ts.
export const MODEL_PART_COUNT = 7;

// Four vec4 per part. Must stay in step with MODEL_PART_STYLE_SIZE_VEC4 in model.vertex.glsl.
export const MODEL_PART_STYLE_SIZE_VEC4 = MODEL_PART_COUNT * 4;

export const MODEL_PART_STYLE_FLOATS = MODEL_PART_STYLE_SIZE_VEC4 * 4;

const BLOCK_NAME = 'ModelPartStyleUniform';
const BINDING_POINT = 0;

// Resolving the block and pointing it at a binding point is program state that lasts for the
// program's lifetime, so gl-native does both once at link time. False means the variant optimized
// the block out.
const hasBlockByProgram: WeakMap<WebGLProgram, boolean> = new WeakMap();

/**
 * GPU buffer for one node's ModelPartStyleUniform block, the evaluated style of every building part.
 * Replaces the per-vertex PBR encoding: a vertex now carries only a part id, and the shader looks
 * the style up here.
 *
 * The values themselves live in Tiled3dModelFeature.partStyle, which evaluation fills without a
 * Context. Layout is 4 vec4 per part, indexed by part id, matching ModelPartStyle in
 * model.vertex.glsl:
 *   0 color_mix       model-color rgb, model-color-mix-intensity in w
 *   1 rmea            roughness, metallic, emissive strength, model-color alpha
 *   2 gradient        emissive gradient begin and finish as a fraction of the mesh z range, then
 *                     the multiplier at begin and its span up to finish
 *   3 gradient_power  x is pow(10, styled curve power); y to w unused
 */
export class ModelPartStyleUBO {
    buffer: WebGLBuffer | null;
    context: Context;

    constructor(context: Context, data: Float32Array) {
        const gl = context.gl;
        this.context = context;
        this.buffer = gl.createBuffer();
        if (!this.buffer) throw new Error('Failed to create model part style UBO buffer');
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    update(data: Float32Array): void {
        const gl = this.context.gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
        gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    }

    /**
     * Binds the block for the given program. Call before each draw: symbol layers bind their own
     * buffers over the same point, so the binding cannot be assumed to survive between draws.
     */
    bind(context: Context, program: WebGLProgram): void {
        let hasBlock = hasBlockByProgram.get(program);
        if (hasBlock === undefined) {
            const gl = context.gl;
            // A shader variant that never reads the block has it optimized out.
            const blockIndex = gl.getUniformBlockIndex(program, BLOCK_NAME);
            hasBlock = blockIndex !== (gl.INVALID_INDEX as number);
            if (hasBlock) gl.uniformBlockBinding(program, blockIndex, BINDING_POINT);
            hasBlockByProgram.set(program, hasBlock);
        }
        if (!hasBlock) return;

        const gl = context.gl;
        gl.bindBufferBase(gl.UNIFORM_BUFFER, BINDING_POINT, this.buffer);
    }

    destroy(): void {
        if (this.buffer) {
            this.context.gl.deleteBuffer(this.buffer);
            this.buffer = null;
        }
    }
}
