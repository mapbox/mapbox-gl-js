import {test, expect} from '../../util/vitest';
import {parseUsedPreprocessorDefines} from '../../../src/shaders/shaders';

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
