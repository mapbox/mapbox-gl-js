// Non-production code paths: style-spec validators, the style-diff algorithm,
// and the debug-overlay draw functions. Lifted out of `core.js` so consumers
// that disable validation (`{validate: false}`), never call
// `setStyle(..., {diff: true})` after initial load, and never toggle any
// `map.show*` debug flag never download these ~25KB gz.
//
// Importing this file is what causes Rollup to emit the `debug.js` chunk
// (see chunkFileNames in rollup.config.esm.ts).
import {
    validateStyle,
    validateSource,
    validateLight,
    validateLights,
    validateTerrain,
    validateFog,
    validateSnow,
    validateRain,
    validateLayer,
    validateFilter,
    validatePaintProperty,
    validateLayoutProperty,
    validateModel,
} from '../src/style-spec/validate_style.min';
import diffStyles from '../src/style-spec/diff';
import drawDebug, {drawDebugPadding, drawDebugQueryGeometry} from '../src/render/draw_debug';
import drawCollisionDebug from '../src/render/draw_collision_debug';
import drawPlacementDebug from '../src/render/draw_placement_debug';

// Named `DebugModule` (not `Debug`) so call sites aren't stripped out by the
// Rollup config for prod builds.
export const DebugModule = {
    loaded: true,
    validateStyle,
    validateSource,
    validateLight,
    validateLights,
    validateTerrain,
    validateFog,
    validateSnow,
    validateRain,
    validateLayer,
    validateFilter,
    validatePaintProperty,
    validateLayoutProperty,
    validateModel,
    diffStyles,
    drawDebug,
    drawDebugPadding,
    drawDebugQueryGeometry,
    drawCollisionDebug,
    drawPlacementDebug,
};
