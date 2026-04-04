import {test, expect, describe} from '../../util/vitest';
import Context from '../../../src/gl/context';

describe('Context GPU flags', () => {
    /**
     * Returns a WebGL2 context whose WEBGL_debug_renderer_info extension
     * reports the given renderer string.  This lets us exercise the
     * renderer-substring detection in the Context constructor without
     * relying on the host GPU.
     */
    function createGLWithRenderer(renderer: string): WebGL2RenderingContext {
        const el = window.document.createElement('canvas');
        const gl = el.getContext('webgl2');
        if (!gl) throw new Error('WebGL2 context unavailable — cannot run GPU flag tests');

        const UNMASKED_RENDERER = 0x9246; // WEBGL_debug_renderer_info constant
        const fakeExt = {UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER, UNMASKED_VENDOR_WEBGL: 0x9245};

        const origGetExtension = gl.getExtension.bind(gl);
        const origGetParameter = gl.getParameter.bind(gl);

        gl.getExtension = ((name: string) => {
            if (name === 'WEBGL_debug_renderer_info') return fakeExt;
            return origGetExtension(name);
        }) as typeof gl.getExtension;

        gl.getParameter = ((pname: number) => {
            if (pname === UNMASKED_RENDERER) return renderer;
            if (pname === fakeExt.UNMASKED_VENDOR_WEBGL) return 'Test Vendor';
            return origGetParameter(pname);
        }) as typeof gl.getParameter;

        return gl;
    }

    /**
     * Returns a WebGL2 context where WEBGL_debug_renderer_info is
     * unavailable (getExtension returns null), so Context.renderer
     * stays undefined.
     */
    function createGLWithoutRendererInfo(): WebGL2RenderingContext {
        const el = window.document.createElement('canvas');
        const gl = el.getContext('webgl2');
        if (!gl) throw new Error('WebGL2 context unavailable — cannot run GPU flag tests');

        const origGetExtension = gl.getExtension.bind(gl);

        gl.getExtension = ((name: string) => {
            if (name === 'WEBGL_debug_renderer_info') return null;
            return origGetExtension(name);
        }) as typeof gl.getExtension;

        return gl;
    }

    describe('disableSymbolUBO', () => {
        test('enabled when forceDisableSymbolUBO option is set', () => {
            const gl = createGLWithRenderer('Generic Desktop GPU');
            const context = new Context(gl, {forceDisableSymbolUBO: true});
            expect(context.disableSymbolUBO).toBe(true);
        });

        test('enabled when renderer contains Adreno', () => {
            const gl = createGLWithRenderer('Adreno (TM) 730');
            const context = new Context(gl);
            expect(context.disableSymbolUBO).toBe(true);
        });

        test('enabled when renderer contains PowerVR', () => {
            const gl = createGLWithRenderer('PowerVR Rogue GE8320');
            const context = new Context(gl);
            expect(context.disableSymbolUBO).toBe(true);
        });

        test('disabled for non-matching renderer', () => {
            const gl = createGLWithRenderer('ANGLE (Apple, Apple M2 Max, OpenGL 4.1)');
            const context = new Context(gl);
            expect(context.disableSymbolUBO).toBe(false);
        });

        test('disabled when WEBGL_debug_renderer_info is unavailable', () => {
            const gl = createGLWithoutRendererInfo();
            const context = new Context(gl);
            expect(context.disableSymbolUBO).toBeFalsy();
        });

        test('forceDisableSymbolUBO still works without renderer info', () => {
            const gl = createGLWithoutRendererInfo();
            const context = new Context(gl, {forceDisableSymbolUBO: true});
            expect(context.disableSymbolUBO).toBe(true);
        });
    });
});
