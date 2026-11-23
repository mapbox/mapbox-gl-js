import {describe, test, expect, waitFor, createMap} from '../../util/vitest';
import {programsForDeviceNeutralKey} from '../../../src/render/precompile_programs';
import {deviceNeutralProgramKey} from '../../../src/render/precompile_keys';
import {PRECOMPILE_LISTS} from '../../../src/render/precompile_lists';
import ProgramConfiguration from '../../../src/data/program_configuration';
import createStyleLayer from '../../../src/style/create_style_layer';
import EvaluationParameters from '../../../src/style/evaluation_parameters';
import {prepareStandard} from '../../../modules/standard_main';
import {prepareLite} from '../../../modules/lite_main';
import styleSpec from '../../../src/style-spec/reference/latest';

import type {Map} from '../../../src/ui/map';
import type {LayerSpecification} from '../../../src/style-spec/types';
import type {ProgramToPrecompile} from '../../../src/render/precompile_programs';
import type {WebGL2BlendFuncExtended} from '../../../src/gl/types';
import type FillStyleLayer from '../../../src/style/style_layer/fill_style_layer';

// Some list entries' shaders come with the lazy Standard and Lite modules.
async function loadedMap(options: Record<string, unknown> = {}): Promise<Map> {
    await Promise.all([prepareStandard(), prepareLite()]);
    const map = createMap({zoom: 12, ...options});
    await waitFor(map, 'load');
    return map;
}

function keysFor(map: Map, entry: string): string[] {
    return programsForDeviceNeutralKey(map.painter, entry).map(program => program.key);
}

function listEntries(): string[] {
    const entries = new Set<string>();
    for (const {lists} of Object.values(PRECOMPILE_LISTS)) {
        for (const list of Object.values(lists)) {
            for (const entry of list) entries.add(entry.key);
        }
    }
    return [...entries];
}

function links(gl: WebGL2RenderingContext, {vertexSource, fragmentSource}: ProgramToPrecompile): boolean {
    const program = gl.createProgram();
    for (const [type, text] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, text);
        gl.compileShader(shader);
        gl.attachShader(program, shader);
        gl.deleteShader(shader);
    }
    gl.linkProgram(program);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
    gl.deleteProgram(program);
    return linked;
}

function hasUniformDefines(glsl: string): string[] {
    return glsl.split('\n').filter(line => line.startsWith('#define HAS_UNIFORM_')).sort();
}

describe('programsForDeviceNeutralKey', () => {
    test('rebuilds the keys gl-js used during a load', async () => {
        const features = [
            {type: 'Feature', properties: {color: 'blue', opacity: 0.5}, geometry: {type: 'Polygon', coordinates: [[[0, 0], [0.01, 0], [0.01, 0.01], [0, 0]]]}},
            {type: 'Feature', properties: {}, geometry: {type: 'LineString', coordinates: [[0, 0], [0.01, 0.01]]}},
            {type: 'Feature', properties: {}, geometry: {type: 'Point', coordinates: [0, 0]}},
        ];
        const map = await loadedMap({
            recordProgramsDuringLoad: true,
            center: [0, 0],
            style: {
                version: 8,
                sources: {data: {type: 'geojson', data: {type: 'FeatureCollection', features}}},
                layers: [
                    {id: 'background', type: 'background', paint: {'background-color': 'white'}},
                    // The fill key gets all three kinds of paint configuration parts: z_ for fill-color, a_ for fill-opacity, u_ for the rest.
                    {id: 'fill', type: 'fill', source: 'data', paint: {
                        'fill-color': ['interpolate', ['linear'], ['zoom'], 0, 'red', 22, ['get', 'color']],
                        'fill-opacity': ['get', 'opacity'],
                    }},
                    {id: 'line', type: 'line', source: 'data', paint: {'line-color': 'blue'}},
                    {id: 'circle', type: 'circle', source: 'data'},
                ],
            },
        });
        const keys = map._getRecordedProgramsDuringLoad().programs.map(program => program.key);
        const rebuilt = keys.filter(key => keysFor(map, deviceNeutralProgramKey(key)).includes(key));
        expect(rebuilt).toEqual(keys);
        map.remove();
    });

    test('builds every list entry', async () => {
        const map = await loadedMap();
        expect(listEntries().filter(entry => !programsForDeviceNeutralKey(map.painter, entry))).toEqual([]);
        map.remove();
    });

    test('every program built from a list entry links', async () => {
        const map = await loadedMap();
        const programs = listEntries().flatMap(entry => programsForDeviceNeutralKey(map.painter, entry));
        expect(programs.filter(program => !links(map.painter.context.gl, program)).map(program => program.key)).toEqual([]);
        map.remove();
    });

    test('writes the HAS_UNIFORM defines of the paint configuration', async () => {
        const map = await loadedMap();
        const layer = createStyleLayer({id: 'fill', type: 'fill', source: 'data', paint: {'fill-color': 'red', 'fill-opacity': ['get', 'opacity']}}, '') as FillStyleLayer;
        layer.recalculate(new EvaluationParameters(0), []);
        const configuration = new ProgramConfiguration(layer, {zoom: 0, lut: null});
        const [program] = programsForDeviceNeutralKey(map.painter, `fill/${configuration.cacheKey}`);
        expect(hasUniformDefines(program.fragmentSource)).toEqual(configuration.defines().sort());
        map.remove();
    });

    test('writes the HAS_UNIFORM defines of every layer type\'s paint configuration', async () => {
        const map = await loadedMap();
        const mismatches: Record<string, {rebuilt: string[]; expected: string[]}> = {};
        for (const type of Object.keys((styleSpec.layer as {type: {values: Record<string, unknown>}}).type.values)) {
            // Default paint values are constant, so every property of the configuration is a u_ part.
            const layer = createStyleLayer({id: type, type, source: 'data'} as LayerSpecification, '');
            layer.recalculate(new EvaluationParameters(0), []);
            const configuration = new ProgramConfiguration(layer, {zoom: 0, lut: null});
            // HAS_UNIFORM defines aren't filtered by the program's source, so any program rebuilds them.
            const [program] = programsForDeviceNeutralKey(map.painter, `fill/${configuration.cacheKey}`);
            const rebuilt = hasUniformDefines(program.fragmentSource);
            const expected = configuration.defines().sort();
            if (rebuilt.join() !== expected.join()) mismatches[type] = {rebuilt, expected};
        }
        expect(mismatches).toEqual({});
        map.remove();
    });

    test('fills in the uniform block size', async () => {
        const map = await loadedMap();
        map.painter.context.maxUniformBlockSize = 16384;
        expect(keysFor(map, 'line/LIGHTING_3D_MODE/MAX_UBO_SIZE_VEC4')).toEqual(['line/LIGHTING_3D_MODE/MAX_UBO_SIZE_VEC4 1024u']);
        map.remove();
    });

    test('adds TERRAIN_DEM_FLOAT_FORMAT after TERRAIN with linear float filtering', async () => {
        const map = await loadedMap();
        map.painter.context.extTextureFloatLinear = {};
        expect(keysFor(map, 'terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/TERRAIN'))
            .toEqual(['terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/TERRAIN/TERRAIN_DEM_FLOAT_FORMAT']);
        map.remove();
    });

    test('leaves TERRAIN_DEM_FLOAT_FORMAT out without linear float filtering', async () => {
        const map = await loadedMap();
        map.painter.context.extTextureFloatLinear = null;
        expect(keysFor(map, 'terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/TERRAIN'))
            .toEqual(['terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/TERRAIN']);
        map.remove();
    });

    test('keeps USE_MRT1 without WEBGL_blend_func_extended', async () => {
        const map = await loadedMap();
        map.painter.context.extBlendFuncExtended = null;
        expect(keysFor(map, 'background/USE_MRT1')).toEqual(['background/USE_MRT1']);
        map.remove();
    });

    test('drops USE_MRT1 with WEBGL_blend_func_extended', async () => {
        const map = await loadedMap();
        map.painter.context.extBlendFuncExtended = {} as WebGL2BlendFuncExtended;
        expect(keysFor(map, 'background/USE_MRT1')).toEqual(['background']);
        map.remove();
    });

    test('builds a draped line with and without DUAL_SOURCE_BLENDING with WEBGL_blend_func_extended', async () => {
        const map = await loadedMap();
        map.painter.context.extBlendFuncExtended = {} as WebGL2BlendFuncExtended;
        map.painter.context.maxUniformBlockSize = 16384;
        expect(keysFor(map, 'line/RENDER_TO_TEXTURE/MAX_UBO_SIZE_VEC4/USE_MRT1')).toEqual([
            'line/RENDER_TO_TEXTURE/MAX_UBO_SIZE_VEC4 1024u',
            'line/RENDER_TO_TEXTURE/MAX_UBO_SIZE_VEC4 1024u/DUAL_SOURCE_BLENDING',
        ]);
        map.remove();
    });

    test('builds a draped linePattern with DUAL_SOURCE_BLENDING when its emissive strength varies by feature', async () => {
        const map = await loadedMap();
        map.painter.context.extBlendFuncExtended = {} as WebGL2BlendFuncExtended;
        expect(keysFor(map, 'linePattern//a_line-emissive-strength/RENDER_TO_TEXTURE/USE_MRT1'))
            .toEqual(['linePattern//a_line-emissive-strength/RENDER_TO_TEXTURE/DUAL_SOURCE_BLENDING']);
        map.remove();
    });

    test('builds a draped linePattern without USE_MRT1 when its emissive strength is constant', async () => {
        const map = await loadedMap();
        map.painter.context.extBlendFuncExtended = {} as WebGL2BlendFuncExtended;
        expect(keysFor(map, 'linePattern//u_line-emissive-strength/RENDER_TO_TEXTURE/USE_MRT1'))
            .toEqual(['linePattern//u_line-emissive-strength/RENDER_TO_TEXTURE']);
        map.remove();
    });

    test('adds USE_MRT1_RGBA after USE_MRT1 with exact emissive color', async () => {
        const map = await loadedMap({emissiveColorPrecision: 'exact'});
        map.painter.context.extBlendFuncExtended = null;
        expect(keysFor(map, 'background/USE_MRT1')).toEqual(['background/USE_MRT1/USE_MRT1_RGBA']);
        map.remove();
    });

    test('keeps USE_MRT1 with WEBGL_blend_func_extended and exact emissive color', async () => {
        const map = await loadedMap({emissiveColorPrecision: 'exact'});
        map.painter.context.extBlendFuncExtended = {} as WebGL2BlendFuncExtended;
        map.painter.context.maxUniformBlockSize = 16384;
        expect(keysFor(map, 'line/RENDER_TO_TEXTURE/MAX_UBO_SIZE_VEC4/USE_MRT1'))
            .toEqual(['line/RENDER_TO_TEXTURE/MAX_UBO_SIZE_VEC4 1024u/USE_MRT1/USE_MRT1_RGBA']);
        map.remove();
    });

    test('adds USE_MRT1_RGBA to terrainRaster with exact emissive color', async () => {
        const map = await loadedMap({emissiveColorPrecision: 'exact'});
        map.painter.context.extTextureFloatLinear = null;
        expect(keysFor(map, 'terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/TERRAIN'))
            .toEqual(['terrainRaster/LIGHTING_3D_MODE/LIGHTING_3D_ALPHA_EMISSIVENESS/USE_MRT1_RGBA/TERRAIN']);
        map.remove();
    });

    test('leaves USE_MRT1_RGBA out of the ground effect with exact emissive color', async () => {
        const map = await loadedMap({emissiveColorPrecision: 'exact'});
        expect(keysFor(map, 'fillExtrusionGroundEffect//a_fill-extrusion-flood-light-ground-radius/USE_MRT1'))
            .toEqual(['fillExtrusionGroundEffect//a_fill-extrusion-flood-light-ground-radius/USE_MRT1']);
        map.remove();
    });

    test('adds CUSTOM_ANTIALIASING to globeRaster while the whole globe shows', async () => {
        const map = await loadedMap({zoom: 1});
        expect(keysFor(map, 'globeRaster/PROJECTION_GLOBE_VIEW')).toEqual(['globeRaster/PROJECTION_GLOBE_VIEW/CUSTOM_ANTIALIASING']);
        map.remove();
    });

    test('leaves CUSTOM_ANTIALIASING out of globeRaster at zoom 12', async () => {
        const map = await loadedMap();
        expect(keysFor(map, 'globeRaster/PROJECTION_GLOBE_VIEW')).toEqual(['globeRaster/PROJECTION_GLOBE_VIEW']);
        map.remove();
    });
});
