import styleSpec from '../style-spec/reference/latest';
import {appendUsedDefines, maxUBOSizeVec4Define, programSources} from './program';
import {paintAttributeNames} from '../data/program_configuration';
import {globeUseCustomAntiAliasing} from '../geo/projection/globe_util';
import {MAX_UBO_SIZE_VEC4} from './program/program_uniforms';
import {deviceNeutralProgramKey} from './precompile_keys';
import assert from '../style-spec/util/assert';

import type Painter from './painter';
import type {ProgramName, ShaderSource} from './program';
import type {DynamicDefinesType} from './program/program_uniforms';

export type ProgramToPrecompile = {
    name: ProgramName;
    key: string;
    vertexSource: string;
    fragmentSource: string;
};

// Paint configuration parts of a key: a property bound to a uniform, an attribute or a zoom-interpolated attribute.
const CONFIG_PART = /^[uaz]_/;

// The programs gl-js would create for a device-neutral key, as precompile lists store them, with this painter's device
// and camera, or null while the key's shader source isn't loaded (some shaders come with a lazy module).
export function programsForDeviceNeutralKey(painter: Painter, neutralKey: string): Array<ProgramToPrecompile> | null {
    const [name, ...parts] = neutralKey.split('/') as [ProgramName, ...string[]];
    const source = painter.getShaderSource(name);
    if (!source) return null;

    const context = painter.context;

    let firstDefine = parts.findIndex(part => part !== '' && !CONFIG_PART.test(part));
    if (firstDefine === -1) firstDefine = parts.length;
    const defines: DynamicDefinesType[] = [];
    for (const part of parts.slice(firstDefine) as Array<DynamicDefinesType | typeof MAX_UBO_SIZE_VEC4>) {
        // a list keeps MAX_UBO_SIZE_VEC4 without its value
        if (part === MAX_UBO_SIZE_VEC4) {
            defines.push(maxUBOSizeVec4Define(context));
            continue;
        }
        defines.push(part);
        // Right after TERRAIN, as Painter#currentGlobalDefines adds it.
        if (part === 'TERRAIN' && painter.linearFloatFilteringSupported()) defines.push('TERRAIN_DEM_FLOAT_FORMAT');
        // Lists are recorded without `emissiveColorPrecision: 'exact'`, which adds `USE_MRT1_RGBA` right after these, except in
        // the ground effect's emissive pass. Draped entries of styles without data-driven emissive strength have no
        // `USE_MRT1` to follow, so they stay unmatched.
        if ((part === 'USE_MRT1' || part === 'LIGHTING_3D_ALPHA_EMISSIVENESS') && painter._forceFullRgbaEmissive && name !== 'fillExtrusionGroundEffect') {
            defines.push('USE_MRT1_RGBA');
        }
    }
    // Last, as drawTerrainForGlobe adds it.
    if (name === 'globeRaster' && globeUseCustomAntiAliasing(painter, context, painter.transform)) defines.push('CUSTOM_ANTIALIASING');

    // paint configurations, come before defines, after name and an empty part: 'fill//u_fill-color/...'.
    const configParts = parts.slice(0, firstDefine);

    // Lists come from devices without `WEBGL_blend_func_extended`. On a device with it, draped layers don't get
    // `USE_MRT1`, and a draped line or linePattern whose emissive strength varies by feature gets `DUAL_SOURCE_BLENDING`
    // instead. A linePattern key shows which in its paint configuration; a line key can't (line paint properties are in
    // a UBO), so a line gets both programs.
    // With `emissiveColorPrecision: 'exact'`, or an emissive mode forced as render tests do, draped layers keep `USE_MRT1`.
    let variants = [defines];
    if (context.extBlendFuncExtended && defines.includes('USE_MRT1') && !painter._forceFullRgbaEmissive && !painter._forceEmissiveMode) {
        const withoutMRT = defines.filter(define => define !== 'USE_MRT1');
        const withDualSource = defines.map(define => (define === 'USE_MRT1' ? 'DUAL_SOURCE_BLENDING' : define));
        const variesByFeature = configParts.includes('a_line-emissive-strength') || configParts.includes('z_line-emissive-strength');
        if (name === 'line') variants = [withoutMRT, withDualSource];
        else if (name === 'linePattern' && variesByFeature) variants = [withDualSource];
        else variants = [withoutMRT];
    }

    const prefix = [name, ...configParts].join('/');
    const configDefines = configParts.filter(part => part.startsWith('u_')).flatMap(part => constantUniformDefines(part.slice(2)));

    return variants.map(variant => {
        const {vertexSource, fragmentSource} = programSources(context, source, configDefines, variant);
        return {name, key: appendUsedDefines(prefix, source, variant), vertexSource, fragmentSource};
    });
}

// Precompiling builds programs from device-neutral keys, so each program gl-js creates must come back from its
// device-neutral key with the same key and GLSL. A mismatch means the rebuild rules no longer follow how it's built.
export function assertRebuildsFromDeviceNeutralKey(
    painter: Painter,
    key: string,
    source: ShaderSource,
    configDefines: ReadonlyArray<string>,
    defines: ReadonlyArray<DynamicDefinesType>
): void {
    // Before the first render there's no style, which some rebuild rules read (e.g. the map's antialias option).
    if (!painter.style) return;
    const mismatch = deviceNeutralKeyRebuildMismatch(painter, key, source, configDefines, defines);
    assert(!mismatch, `Precompile: ${mismatch}`);
}

function deviceNeutralKeyRebuildMismatch(
    painter: Painter,
    key: string,
    source: ShaderSource,
    configDefines: ReadonlyArray<string>,
    defines: ReadonlyArray<DynamicDefinesType>
): string | null {
    const neutralKey = deviceNeutralProgramKey(key);
    const programs = programsForDeviceNeutralKey(painter, neutralKey) || [];
    const rebuilt = programs.find(program => program.key === key);
    const call = `${programsForDeviceNeutralKey.name}("${neutralKey}")`;
    if (!rebuilt) return `${call} gives keys [${programs.map(program => program.key).join(', ')}], not ${key}`;

    const {vertexSource, fragmentSource} = programSources(painter.context, source, configDefines, defines);
    const difference = firstDifferentLine('vertex', rebuilt.vertexSource, vertexSource) || firstDifferentLine('fragment', rebuilt.fragmentSource, fragmentSource);
    return difference && `${call} gives ${key} with different GLSL, ${difference}`;
}

function firstDifferentLine(stage: string, rebuilt: string, created: string): string | null {
    const rebuiltLines = rebuilt.split('\n');
    const createdLines = created.split('\n');
    for (let i = 0; i < Math.max(rebuiltLines.length, createdLines.length); i++) {
        if (rebuiltLines[i] !== createdLines[i]) {
            return `${stage} line ${i + 1}: rebuilt "${rebuiltLines[i] ?? ''}", gl-js "${createdLines[i] ?? ''}"`;
        }
    }
    return null;
}

// The constant uniform defines of a paint property.
function constantUniformDefines(property: string): string[] {
    const type = paintLayerType(property);
    if (!type) return [];
    return paintAttributeNames(property, type).map(name => `#define HAS_UNIFORM_u_${name}`);
}

// The layer type of a paint property: its spec table (symbol's are `icon-*` and `text-*`), else, for properties gl-js
// derives without a spec entry such as `line-floorwidth`, the longest layer type its name starts with.
function paintLayerType(property: string): string | undefined {
    const table = (styleSpec.paint as string[]).find(paint => property in (styleSpec[paint] as Record<string, unknown>));
    if (table) return table.slice('paint_'.length);
    const layerSpec = styleSpec.layer as {type: {values: Record<string, unknown>}};
    const prefixes = Object.keys(layerSpec.type.values).filter(type => property.startsWith(`${type}-`));
    return prefixes.sort((a, b) => b.length - a.length)[0];
}
