import {test, expect} from '../../util/vitest';
import shaders, {compile, includeMap, parseUsedPreprocessorDefines} from '../../../src/shaders/shaders';
import liteShaders from '../../../3d-style/shaders/shaders_lite';
import standardShaders from '../../../3d-style/shaders/shaders_standard';
import hdShaders from '../../../3d-style/shaders/shaders_hd';

import type {DynamicDefinesType} from '../../../src/render/program/program_uniforms';

test('pragma expansion only introduces GL JS runtime defines', () => {
    for (const [name, source] of Object.entries({...shaders, ...liteShaders, ...standardShaders, ...hdShaders})) {
        const defines = new Set<DynamicDefinesType>();
        parseUsedPreprocessorDefines(source.vertexSource, defines);
        parseUsedPreprocessorDefines(source.fragmentSource, defines);
        const unknown = [...defines].filter((define) => !source.usedDefines.has(define) &&
            !define.startsWith('HAS_UNIFORM_') && !define.startsWith('HAS_ATTRIBUTE_'));
        expect(unknown, name).toEqual([]);
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

test('compile still rejects a genuinely unregistered include', () => {
    expect(() => compile('', '#include "_definitely_not_registered.glsl"\nvoid main() {}'))
        .toThrow(/Unknown include: _definitely_not_registered\.glsl/);
});
