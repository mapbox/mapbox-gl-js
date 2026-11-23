import {test, expect} from '../../util/vitest';
import shaders, {compile, includeMap, parseUsedPreprocessorDefines, FRAGMENT_PRELUDE_BLOCK, VERTEX_PRELUDE_BLOCK} from '../../../src/shaders/shaders';
import liteShaders from '../../../3d-style/shaders/shaders_lite';
import standardShaders from '../../../3d-style/shaders/shaders_standard';
import hdShaders from '../../../3d-style/shaders/shaders_hd';

import type {DynamicDefinesType} from '../../../src/render/program/program_uniforms';

// The names on the preprocessor lines of a GLSL text, except #define lines, preprocessor keywords and GL_* names.
// Deliberately broader than parseUsedPreprocessorDefines, so the test still catches a line that parser misses.
function namesOnPreprocessorLines(glsl: string): string[] {
    const keywords = new Set(['if', 'ifdef', 'ifndef', 'elif', 'else', 'endif', 'defined', 'extension', 'require']);
    return glsl.split('\n')
        .map(line => line.split('//')[0].trim())
        .filter(line => line.startsWith('#') && !line.startsWith('#define'))
        .flatMap((line): string[] => line.match(/\b[A-Za-z_]\w*\b/g) || [])
        // GL_* names are the compiler's own.
        .filter(name => !keywords.has(name) && !name.startsWith('GL_'));
}

// programSources writes only the defines in usedDefines, so every define the compiled GLSL tests must be there.
test('usedDefines covers every define the compiled GLSL tests', () => {
    for (const [name, source] of Object.entries({...shaders, ...liteShaders, ...standardShaders, ...hdShaders})) {
        // The GLSL as programSources assembles it, after the defines block.
        const glsl = [
            FRAGMENT_PRELUDE_BLOCK, ...source.fragmentIncludes.map(include => includeMap[include]), source.fragmentSource,
            VERTEX_PRELUDE_BLOCK, ...source.vertexIncludes.map(include => includeMap[include]), source.vertexSource,
        ].join('\n');
        const missing = new Set(namesOnPreprocessorLines(glsl).filter(define => !source.usedDefines.has(define as DynamicDefinesType)));
        expect([...missing], name).toEqual([]);
    }
});

test('parseUsedPreprocessorDefines', () => {
    let defines: Set<DynamicDefinesType> = new Set();

    parseUsedPreprocessorDefines(``, defines);
    expect([...defines]).toEqual([]);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #ifdef SHADER_DEFINE_1
    #ifndef SHADER_DEFINE_2
    #else
    #endif
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) || defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) && defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #if !defined(SHADER_DEFINE_1) && !defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1)
    #elif defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #elif defined(SHADER_DEFINE_1)
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #if ! defined( (SHADER_DEFINE_1) )  &&  ! defined( (SHADER_DEFINE_2) )
    #endif
    `, defines);
    expect([...defines]).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    if (SHADER_VARIABLE) {
    }
    `, defines);
    expect([...defines]).toEqual([]);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #endif // SHADER_DEFINE
    `, defines);
    expect([...defines]).toEqual([]);

    defines = new Set();
    parseUsedPreprocessorDefines(`
    #define SHADER_DEFINE
    `, defines);
    expect([...defines]).toEqual([]);
});

test('compile accepts a registered but empty include', () => {
    // The build's dead-branch elimination (build/glsl_dead_code.js) reduces a prelude whose whole
    // body is guarded by a gl-native-only define to the empty string. `compile()` must treat that
    // as registered, not as a missing include — a truthiness check reported it as
    // "Unknown include: _prelude_material_table.vertex.glsl" in dev builds, where asserts survive.
    const name = '_test_empty_prelude.glsl';
    expect(includeMap[name]).toBeUndefined();
    includeMap[name] = '';
    try {
        expect(() => compile('', `#include "${name}"\nvoid main() {}`)).not.toThrow();
    } finally {
        delete includeMap[name];
    }
});

test('attribute pragmas count their HAS_ATTRIBUTE define as used', () => {
    const source = compile('void main() {}', '#pragma mapbox: define-attribute-vertex-shader-only highp uvec2 part_color\nvoid main() {}');
    expect(source.usedDefines.has('HAS_ATTRIBUTE_a_part_color' as DynamicDefinesType)).toBe(true);
});

test('compile still rejects a genuinely unregistered include', () => {
    expect(() => compile('', '#include "_definitely_not_registered.glsl"\nvoid main() {}'))
        .toThrow(/Unknown include: _definitely_not_registered\.glsl/);
});
