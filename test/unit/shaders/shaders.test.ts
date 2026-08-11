import {test, expect} from '../../util/vitest';
import {compile, includeMap, parseUsedPreprocessorDefines} from '../../../src/shaders/shaders';

import type {DynamicDefinesType} from '../../../src/render/program/program_uniforms';

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
