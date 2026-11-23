import {describe, test, expect, createMap} from '../../util/vitest';
import Program, {programSources} from '../../../src/render/program';
import {compile} from '../../../src/shaders/shaders';

import type {DynamicDefinesType} from '../../../src/render/program/program_uniforms';

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
