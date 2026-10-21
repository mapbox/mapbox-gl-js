import RasterArrayTileSource from '../src/source/raster_array_tile_source';
import {resolveRasterMask, renderRasterMask, clearRasterMask, stencilModeWithRasterMask} from '../src/render/raster_mask';
// Side-effect import: registers the RasterArrayTile factory (see raster_array_plugin) so
// core's SourceCache can build tiles, and — transitively, via raster_array_tile_source —
// registers MRTData for main-thread deserialization.
import '../src/source/raster_array_tile';

export const RasterArray = {
    RasterArrayTileSource,
    resolveRasterMask,
    renderRasterMask,
    clearRasterMask,
    stencilModeWithRasterMask,
};
