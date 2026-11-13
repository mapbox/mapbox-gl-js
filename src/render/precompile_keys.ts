import {MAX_UBO_SIZE_VEC4} from './program/program_uniforms';

import type {ProgramName} from './program';
import type {DynamicDefinesType} from './program/program_uniforms';

// Program cache keys (Program.cacheKey) in the form the precompile lists use.
// A list is recorded on one device and used on all, so defines the device or map options decide are stripped.
export function deviceNeutralProgramKey(key: string): string {
    const [name, ...parts] = key.split('/');
    const neutral = [name];
    for (const part of parts) {
        // The value per GPU, the name stays as a placeholder.
        if (part.startsWith(MAX_UBO_SIZE_VEC4)) {
            neutral.push(MAX_UBO_SIZE_VEC4);
            continue;
        }
        // Only on GPUs that filter float textures linearly.
        if (part === ('TERRAIN_DEM_FLOAT_FORMAT' satisfies DynamicDefinesType)) continue;
        // Only without the map's antialias option, at zooms where the whole globe shows.
        if (name === ('globeRaster' satisfies ProgramName) && part === ('CUSTOM_ANTIALIASING' satisfies DynamicDefinesType)) continue;
        neutral.push(part);
    }
    return neutral.join('/');
}
