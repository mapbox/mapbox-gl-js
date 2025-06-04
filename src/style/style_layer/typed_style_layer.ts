import type BackgroundStyleLayer from './background_style_layer';
import type BuildingStyleLayer from '../../../3d-style/style/style_layer/building_style_layer';
import type CircleStyleLayer from './circle_style_layer';
import type ClipStyleLayer from './clip_style_layer';
import type CustomStyleLayer from './custom_style_layer';
import type FillExtrusionStyleLayer from './fill_extrusion_style_layer';
import type FillStyleLayer from './fill_style_layer';
import type HeatmapStyleLayer from './heatmap_style_layer';
import type HillshadeStyleLayer from './hillshade_style_layer';
import type LineStyleLayer from './line_style_layer';
import type ModelStyleLayer from '../../../3d-style/style/style_layer/model_style_layer';
import type RasterParticleStyleLayer from './raster_particle_style_layer';
import type RasterStyleLayer from './raster_style_layer';
import type SkyStyleLayer from './sky_style_layer';
import type SlotStyleLayer from './slot_style_layer';
import type SymbolStyleLayer from './symbol_style_layer';
import type {LUT} from '../../util/lut';
import type {ConfigOptions} from '../properties';
import type {LayerSpecification} from '../../style-spec/types';

export type TypedStyleLayerConstructor = new (
    layer: LayerSpecification,
    scope: string,
    lut: LUT | null,
    options?: ConfigOptions | null
) => TypedStyleLayer;

export type TypedStyleLayer =
    | BackgroundStyleLayer
    | BuildingStyleLayer
    | CircleStyleLayer
    | ClipStyleLayer
    | CustomStyleLayer
    | FillExtrusionStyleLayer
    | FillStyleLayer
    | HeatmapStyleLayer
    | HillshadeStyleLayer
    | LineStyleLayer
    | ModelStyleLayer
    | RasterParticleStyleLayer
    | RasterStyleLayer
    | SkyStyleLayer
    | SlotStyleLayer
    | SymbolStyleLayer;
