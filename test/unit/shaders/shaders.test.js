import {test} from '../../util/test.js';
import {parseUsedPreprocessorDefines} from '../../../src/shaders/shaders.js';

test('parseUsedPreprocessorDefines', (t) => {
    let defines = [];

    parseUsedPreprocessorDefines(``, defines);
    t.deepEqual(defines, []);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifdef SHADER_DEFINE_1
    #ifndef SHADER_DEFINE_2
    #else
    #endif
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) || defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1) && defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if !defined(SHADER_DEFINE_1) && !defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if defined(SHADER_DEFINE_1)
    #elif defined(SHADER_DEFINE_2)
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #ifndef SHADER_DEFINE_1
    #elif defined(SHADER_DEFINE_1)
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1']);

    defines = [];
    parseUsedPreprocessorDefines(`
    #if ! defined( (SHADER_DEFINE_1) )  &&  ! defined( (SHADER_DEFINE_2) )
    #endif
    `, defines);
    t.deepEqual(defines, ['SHADER_DEFINE_1', 'SHADER_DEFINE_2']);

    t.end();
});
