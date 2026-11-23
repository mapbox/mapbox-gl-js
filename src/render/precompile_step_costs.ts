import {programsForDeviceNeutralKey} from './precompile_programs';
import {warnOnce} from '../util/util';
import assert from '../style-spec/util/assert';
import {prepareStandard} from '../../modules/standard_main';
import {prepareLite} from '../../modules/lite_main';
import {prepareHD} from '../../modules/hd_main';

import type Painter from './painter';

// Fragment compile, vertex compile and link, in ms.
export type ProgramSteps = [number, number, number];

/**
 * Measurement of what each step of building the programs of some precompile list entries costs.
 * @private
 */
export type ProgramStepsMeasurement = {
    /** The list entries to measure, in the order to measure them. */
    entries: Array<string>;
    state: 'start' | 'loading' | 'ready' | 'done';
    /** One per program, in the order measured. */
    programs: Array<{entry: string; steps: ProgramSteps}>;
    /** Entries whose programs weren't measured: no shader source, a program that didn't link, or an error partway. */
    missing: Array<string>;
};

export function createProgramStepsMeasurement(entries: Array<string>): ProgramStepsMeasurement {
    return {entries, state: 'start', programs: [], missing: []};
}

const VERSION_LINE = /^(#version[^\n]*\n)/;

// Called after each frame. Once the lazy modules have loaded, builds each entry's programs one step at a time and waits
// with getError, which returns after the step only without KHR_parallel_shader_compile. A program is much cheaper to
// build after one with the same vertex or fragment shader, so a list's costs hold only for its order.
export function measureProgramSteps(painter: Painter, measurement: ProgramStepsMeasurement) {
    if (measurement.state === 'start') {
        measurement.state = 'loading';
        // A module that fails to load leaves its entries missing instead of holding the map.
        const ready = () => { measurement.state = 'ready'; };
        Promise.all([prepareStandard(), prepareLite(), prepareHD()]).then(ready, ready);
        return;
    }
    if (measurement.state !== 'ready') return;

    const gl = painter.context.gl;
    // Waits for whatever is still queued.
    gl.getError();
    // One per load: the browser's program cache can't serve programs from earlier loads or the map's own, but can serve
    // one whose GLSL repeats an earlier entry's, as in a real load.
    const define = `$1#define MEASURE_NONCE_${Math.random().toString(36).slice(2)}\n`;
    let next = 0;
    try {
        for (; next < measurement.entries.length; next++) {
            const entry = measurement.entries[next]!;
            const programs = programsForDeviceNeutralKey(painter, entry);
            if (!programs) {
                measurement.missing.push(entry);
                continue;
            }
            for (const {vertexSource, fragmentSource} of programs) {
                const program = gl.createProgram();
                const shaders: WebGLShader[] = [];
                const steps: number[] = [];
                for (const [type, source] of [[gl.FRAGMENT_SHADER, fragmentSource], [gl.VERTEX_SHADER, vertexSource]] as const) {
                    const shader = gl.createShader(type)!;
                    assert(VERSION_LINE.test(source), 'shader source without a #version line to put the nonce after');
                    gl.shaderSource(shader, source.replace(VERSION_LINE, define));
                    const start = performance.now();
                    gl.compileShader(shader);
                    gl.getError();
                    steps.push(performance.now() - start);
                    gl.attachShader(program, shader);
                    shaders.push(shader);
                }
                const start = performance.now();
                gl.linkProgram(program);
                gl.getError();
                steps.push(performance.now() - start);
                const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
                for (const shader of shaders) gl.deleteShader(shader);
                gl.deleteProgram(program);
                // A program that didn't build has no steps worth keeping.
                if (linked) measurement.programs.push({entry, steps: steps as ProgramSteps});
                else measurement.missing.push(entry);
            }
        }
    } catch (e) {
        // A measurement that fails partway still finishes, with what it didn't measure missing, instead of starting
        // over on the next frame.
        measurement.missing.push(...measurement.entries.slice(next));
        warnOnce(`Couldn't measure program steps: ${(e as Error).message}`);
    }
    measurement.state = 'done';
}
