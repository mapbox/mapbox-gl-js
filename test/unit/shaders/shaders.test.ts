// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {test, expect} from '../../util/vitest';
import {parseUsedPreprocessorDefines} from '../../../src/shaders/shaders';

test('parseUsedPreprocessorDefines', () => {
    let defines: Array<any> = [];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    parseUsedPreprocessorDefines(``, defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifdef SHADER_DEFINE_1
    #ifndef SHADER_DEFINE_2
    #else
    #endif
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) || defined(SHADER_DEFINE_2)
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) && defined(SHADER_DEFINE_2)
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if !defined(SHADER_DEFINE_1) && !defined(SHADER_DEFINE_2)
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1)
    #elif defined(SHADER_DEFINE_2)
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #elif defined(SHADER_DEFINE_1)
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if ! defined( (SHADER_DEFINE_1) )  &&  ! defined( (SHADER_DEFINE_2) )
    #endif
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual(['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    if (SHADER_VARIABLE) {
    }
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #endif // SHADER_DEFINE
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual([]);

    defines = [];
    parseUsedPreprocessorDefines(`
    #define SHADER_DEFINE
    `,    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
 defines);
    expect(defines).toEqual([]);
});
