import {describe, test, expect, vi, waitFor, createMap} from '../../../util/vitest';

function createMeasuringMap(entries: string[]) {
    return createMap({
        measureProgramSteps: entries,
        style: {version: 8, sources: {}, layers: []},
    });
}

describe('Map#_getMeasuredProgramSteps', () => {
    test('returns null without the measureProgramSteps option', async () => {
        const map = createMap();
        await waitFor(map, 'idle');
        expect(map._getMeasuredProgramSteps()).toBeNull();
        map.remove();
    });

    test('returns null before the measurement', () => {
        const map = createMeasuringMap(['clippingMask']);
        expect(map._getMeasuredProgramSteps()).toBeNull();
        map.remove();
    });

    test('measures the entries in the given order', async () => {
        const map = createMeasuringMap(['clippingMask', 'background']);
        await waitFor(map, 'idle');
        expect(map._getMeasuredProgramSteps().programs.map(program => program.entry)).toEqual(['clippingMask', 'background']);
        map.remove();
    });

    test('measures three steps per program', async () => {
        const map = createMeasuringMap(['clippingMask']);
        await waitFor(map, 'idle');
        expect(map._getMeasuredProgramSteps().programs[0].steps).toHaveLength(3);
        map.remove();
    });

    test('lists entries without a shader source as missing', async () => {
        const map = createMeasuringMap(['clippingMask', 'noSuchProgram']);
        await waitFor(map, 'idle');
        expect(map._getMeasuredProgramSteps().missing).toEqual(['noSuchProgram']);
        map.remove();
    });

    // The measurement's shaders are the ones with its nonce define.
    const measured = (source: string) => source.includes('MEASURE_NONCE');

    test('lists entries whose program doesn\'t link as missing', async () => {
        const map = createMeasuringMap(['clippingMask', 'background']);
        const gl = map.painter.context.gl;
        const shaderSource = gl.shaderSource.bind(gl);
        vi.spyOn(gl, 'shaderSource').mockImplementation((shader, source) => shaderSource(shader, measured(source) ? `${source}\nnot glsl` : source));
        await waitFor(map, 'idle');
        const {programs, missing} = map._getMeasuredProgramSteps();
        expect({programs, missing}).toEqual({programs: [], missing: ['clippingMask', 'background']});
        map.remove();
    });

    test('finishes a measurement that fails partway, with the rest missing', async () => {
        const map = createMeasuringMap(['clippingMask', 'background']);
        const gl = map.painter.context.gl;
        const shaderSource = gl.shaderSource.bind(gl);
        let shaders = 0;
        vi.spyOn(gl, 'shaderSource').mockImplementation((shader, source) => {
            // clippingMask's two shaders go through; background's first one fails.
            if (measured(source) && ++shaders > 2) throw new Error('lost');
            shaderSource(shader, source);
        });
        await waitFor(map, 'idle');
        const {programs, missing} = map._getMeasuredProgramSteps();
        expect({entries: programs.map(program => program.entry), missing}).toEqual({entries: ['clippingMask'], missing: ['background']});
        map.remove();
    });
});
