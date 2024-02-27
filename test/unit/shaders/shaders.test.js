import {test, expect} from "../../util/vitest.js";
import {parseUsedPreprocessorDefines} from '../../../src/shaders/shaders.js';

test('parseUsedPreprocessorDefines', () => {
    let defines = [];

    parseUsedPreprocessorDefines(``, defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifdef SHADER_DEFINE_1
    #ifndef SHADER_DEFINE_2
    #else
    #endif
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) || defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) && defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if !defined(SHADER_DEFINE_1) && !defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1)
    #elif defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #elif defined(SHADER_DEFINE_1)
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if ! defined( (SHADER_DEFINE_1) )  &&  ! defined( (SHADER_DEFINE_2) )
    #endif
    `, defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    if (SHADER_VARIABLE) {
    }
    `, defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #endif // SHADER_DEFINE
    `, defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #define SHADER_DEFINE
    `, defines);
    expect(defines).toEqual([]);
});
