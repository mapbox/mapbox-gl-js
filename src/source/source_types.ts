import type VectorTileSource from '../source/vector_tile_source';
import type RasterTileSource from '../source/raster_tile_source';
import type RasterDemTileSource from '../source/raster_dem_tile_source';
import type RasterArrayTileSource from '../source/raster_array_tile_source';
import type GeoJSONSource from '../source/geojson_source';
import type VideoSource from '../source/video_source';
import type ImageSource from '../source/image_source';
import type CanvasSource from '../source/canvas_source';
import type ModelSource from '../../3d-style/source/model_source';
import type Tiled3DModelSource from '../../3d-style/source/tiled_3d_model_source';
import type CustomSource from '../source/custom_source';

export type Source =
  | VectorTileSource
  | RasterTileSource
  | RasterDemTileSource
  | RasterArrayTileSource
  | GeoJSONSource
  | VideoSource
  | ImageSource
  | CanvasSource
  | CustomSource<ImageData | ImageBitmap | HTMLCanvasElement | HTMLImageElement>
  | ModelSource
  | Tiled3DModelSource;

export type {
    VectorTileSource,
    RasterTileSource,
    RasterDemTileSource,
    RasterArrayTileSource,
    GeoJSONSource,
    VideoSource,
    ImageSource,
    CanvasSource,
    ModelSource,
    Tiled3DModelSource,
    CustomSource,
};
