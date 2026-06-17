import drawBuilding from '../3d-style/render/draw_building';
import {BuildingTileBorderManager} from '../3d-style/render/building_tile_border_manager';
import IndoorManager from '../3d-style/style/indoor_manager';
import drawRasterParticle, {prepare as prepareRasterParticle} from '../src/render/draw_raster_particle';
import shaders from '../3d-style/shaders/shaders_hd';
import {Rain} from '../src/precipitation/draw_rain';
import {Snow} from '../src/precipitation/draw_snow';
import {programUniforms} from '../3d-style/render/program/program_uniforms_hd';
import {drawElevatedStructures, drawElevatedFillShadows, drawDepthPrepass, drawGroundShadowMask} from '../3d-style/render/draw_elevated_fill';
import {HdCoverageState, updateFrcCoverage, updateHdCoverageSourceCache, updateFrcCoverageFadeRange} from '../3d-style/style/frc_coverage_style';
import {HdElevationState, setupAndUpdateElevationCoverage, updateElevationCoverage, updateHdElevationSourceCache, markElevationIngestSourceCachesUsed, updateCrossSourceElevationGate, handleTerrainToggle} from '../3d-style/style/elevation_coverage_style';
import {buildElevationRequestParams} from '../3d-style/source/elevation_coverage_snapshot';
import {FrcCoverageRenderer} from '../3d-style/render/frc_coverage_renderer';
import {
    drawFillFrcCoverageFirstPass,
    drawFillFrcCoverageSecondPass,
    drawLineFrcCoverageDetect,
    drawLineFrcRenderLine,
    drawLineFrcFadePass,
    drawLineFrcCoverageSecondPass,
} from '../3d-style/render/draw_frc_coverage';
// Side-effect imports: extension class files call `register(...)` at module load.
// Including them here ensures main-thread registration happens when the HD module
// loads, before any tile carrying hdExt data is deserialized.
import '../3d-style/data/bucket/fill_hd_extension';
import '../3d-style/data/bucket/line_hd_extension';
import '../3d-style/data/bucket/circle_hd_extension';
import '../3d-style/data/bucket/symbol_hd_extension';
// `BuildingBucket` also lives entirely in the HD module — the class itself (unlike the
// fill/line/circle/symbol core buckets that carry an `hdExt`) isn't registered by core.
// Without this import, deserializing any tile containing a BuildingBucket would throw.
import '../3d-style/data/bucket/building_bucket';
import '../3d-style/elevation/elevation_feature';

export const HD = {
    loaded: true,
    drawBuilding,
    BuildingTileBorderManager,
    drawRasterParticle,
    prepareRasterParticle,
    Rain,
    Snow,
    shaders,
    programUniforms,
    drawElevatedStructures,
    drawElevatedFillShadows,
    drawDepthPrepass,
    drawGroundShadowMask,
    IndoorManager,
    HdCoverageState,
    updateFrcCoverage,
    updateHdCoverageSourceCache,
    updateFrcCoverageFadeRange,
    HdElevationState,
    setupAndUpdateElevationCoverage,
    updateElevationCoverage,
    updateHdElevationSourceCache,
    markElevationIngestSourceCachesUsed,
    updateCrossSourceElevationGate,
    handleTerrainToggle,
    buildElevationRequestParams,
    FrcCoverageRenderer,
    drawFillFrcCoverageFirstPass,
    drawFillFrcCoverageSecondPass,
    drawLineFrcCoverageDetect,
    drawLineFrcRenderLine,
    drawLineFrcFadePass,
    drawLineFrcCoverageSecondPass,
};
