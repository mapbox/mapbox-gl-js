import {describe, test, expect, waitFor, createMap} from '../../util/vitest';
import Program, {programSources} from '../../../src/render/program';
import {compile} from '../../../src/shaders/shaders';

import type {DynamicDefinesType} from '../../../src/render/program/program_uniforms';
import type {LinkedProgram, ProgramName} from '../../../src/render/program';
import type Context from '../../../src/gl/context';

function program(configDefines: string[], defines: string[]) {
    // A shader that reads TEST_READ but not TEST_UNREAD.
    const source = compile('#ifdef TEST_READ\n#endif\nvoid main() {}', 'void main() {}');
    const map = createMap();
    const fixedDefines = defines as DynamicDefinesType[];
    const built = {key: Program.cacheKey(source, 'test', fixedDefines), ...programSources(map.painter.context, source, configDefines, fixedDefines)};
    map.remove();
    return built;
}

describe('programSources', () => {
    test('gives programs with the same cache key the same GLSL', () => {
        // The second one has a define the shader doesn't read, and its paint configuration's defines in another order.
        expect(program(['#define HAS_UNIFORM_u_y', '#define HAS_UNIFORM_u_x'], ['TEST_READ', 'TEST_UNREAD', 'TEST_VALUE 4']))
            .toEqual(program(['#define HAS_UNIFORM_u_x', '#define HAS_UNIFORM_u_y'], ['TEST_READ', 'TEST_VALUE 4']));
    });

    test('keeps the defines the shader reads and value defines, in the key and the GLSL', () => {
        const {key, fragmentSource} = program([], ['TEST_READ', 'TEST_UNREAD', 'TEST_VALUE 4']);
        expect({key, defines: fragmentSource.split('\n').filter(line => line.startsWith('#define TEST_'))})
            .toEqual({key: 'test/TEST_READ/TEST_VALUE 4', defines: ['#define TEST_READ', '#define TEST_VALUE 4']});
    });
});

describe('Program with a linked program', () => {
    const source = () => compile('void main() {}', 'void main() {}');

    // A program linked from these sources, as the list precompile links them.
    function link(gl: WebGL2RenderingContext, sources: {vertexSource: string; fragmentSource: string}): LinkedProgram {
        const program = gl.createProgram();
        for (const [type, text] of [[gl.FRAGMENT_SHADER, sources.fragmentSource], [gl.VERTEX_SHADER, sources.vertexSource]] as const) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, text);
            gl.compileShader(shader);
            gl.attachShader(program, shader);
        }
        gl.linkProgram(program);
        return {program, ...sources};
    }

    function create(context: Context, linked: LinkedProgram) {
        return new Program(context, 'test' as ProgramName, source(), null, () => ({}), [], false, linked);
    }

    test('takes it over when the GLSL is the same', () => {
        const map = createMap();
        const linked = link(map.painter.context.gl, programSources(map.painter.context, source(), [], []));
        const program = create(map.painter.context, linked);
        program._ensureReady();
        expect({same: program.program === linked.program, failed: !!program.failedToCreate}).toEqual({same: true, failed: false});
        map.remove();
    });

    test('takes it over without KHR_parallel_shader_compile', () => {
        const map = createMap();
        map.painter.context.extParallelShaderCompile = null;
        const linked = link(map.painter.context.gl, programSources(map.painter.context, source(), [], []));
        const program = create(map.painter.context, linked);
        expect({same: program.program === linked.program, pending: program._pending, failed: !!program.failedToCreate}).toEqual({same: true, pending: false, failed: false});
        map.remove();
    });

    test('builds the program again and deletes the linked one when the GLSL differs', () => {
        const map = createMap();
        const gl = map.painter.context.gl;
        const sources = programSources(map.painter.context, source(), [], []);
        const linked = link(gl, {...sources, fragmentSource: `${sources.fragmentSource}\n// other`});
        const program = create(map.painter.context, linked);
        program._ensureReady();
        expect({same: program.program === linked.program, linkedLive: gl.isProgram(linked.program), failed: !!program.failedToCreate})
            .toEqual({same: false, linkedLive: false, failed: false});
        map.remove();
    });

    test('doesn\'t take it over on a lost context', async () => {
        const map = createMap();
        const linked = link(map.painter.context.gl, programSources(map.painter.context, source(), [], []));
        const lost = waitFor(map, 'webglcontextlost');
        map.painter.context.gl.getExtension('WEBGL_lose_context').loseContext();
        const program = create(map.painter.context, linked);
        await lost;
        expect({same: program.program === linked.program, failed: !!program.failedToCreate}).toEqual({same: false, failed: true});
        map.remove();
    });
});
