import {describe, test, expect, vi} from '../../util/vitest';
import Context from '../../../src/gl/context';

function createContext(renderer: string | null, maxUniformBlockSize: number): Context {
    const gl = window.document.createElement('canvas').getContext('webgl2');
    const debugRendererInfo = {UNMASKED_RENDERER_WEBGL: 0x9246, UNMASKED_VENDOR_WEBGL: 0x9245};

    const getExtension = gl.getExtension.bind(gl);
    vi.spyOn(gl, 'getExtension').mockImplementation((name: string) => {
        if (name === 'WEBGL_debug_renderer_info') return renderer === null ? null : debugRendererInfo;
        return getExtension(name);
    });

    const getParameter = gl.getParameter.bind(gl);
    vi.spyOn(gl, 'getParameter').mockImplementation((pname: number) => {
        if (pname === debugRendererInfo.UNMASKED_RENDERER_WEBGL) return renderer;
        if (pname === debugRendererInfo.UNMASKED_VENDOR_WEBGL) return 'Test Vendor';
        if (pname === gl.MAX_UNIFORM_BLOCK_SIZE) return maxUniformBlockSize;
        return getParameter(pname);
    });

    return new Context(gl);
}

describe('Context#maxUniformBlockSize', () => {
    test('caps the UBO size to 32KB', () => {
        expect(createContext('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro)', 65536).maxUniformBlockSize).toEqual(32 * 1024);
    });

    test('keeps a smaller reported UBO size', () => {
        expect(createContext('ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro)', 16384).maxUniformBlockSize).toEqual(16384);
    });

    test('caps the UBO size to 1KB on PowerVR with ANGLE on OpenGL ES', () => {
        const renderer = 'ANGLE (Imagination Technologies, PowerVR D-Series DXT-48-1536, OpenGL ES 3.2 build 25.1@6794074)';
        expect(createContext(renderer, 65536).maxUniformBlockSize).toEqual(1024);
    });

    test('uses the 32KB cap on PowerVR with ANGLE on Vulkan', () => {
        const renderer = 'ANGLE (Imagination Technologies, Vulkan 1.4.303 (PowerVR D-Series DXT-48-1536 MC1 (0x71061212)), PowerVR D-Series Vulkan Driver)';
        expect(createContext(renderer, 65536).maxUniformBlockSize).toEqual(32 * 1024);
    });

    test('uses the 32KB cap on PowerVR without ANGLE', () => {
        expect(createContext('PowerVR D-Series DXT-48-1536', 134217728).maxUniformBlockSize).toEqual(32 * 1024);
    });

    test('uses the 32KB cap when the renderer is unknown', () => {
        expect(createContext(null, 65536).maxUniformBlockSize).toEqual(32 * 1024);
    });
});
