import type StyleLayer from './style_layer';
import circle from './style_layer/circle_style_layer';
import heatmap from './style_layer/heatmap_style_layer';
import hillshade from './style_layer/hillshade_style_layer';
import fill from './style_layer/fill_style_layer';
import clip from './style_layer/clip_style_layer';
import fillExtrusion from './style_layer/fill_extrusion_style_layer';
import line from './style_layer/line_style_layer';
import symbol from './style_layer/symbol_style_layer';
import background from './style_layer/background_style_layer';
import raster from './style_layer/raster_style_layer';
import rasterParticle from './style_layer/raster_particle_style_layer';
import CustomStyleLayer from './style_layer/custom_style_layer';
import sky from './style_layer/sky_style_layer';
import slot from './style_layer/slot_style_layer';
import type {CustomLayerInterface} from './style_layer/custom_style_layer';
import model from '../../3d-style/style/style_layer/model_style_layer';

import type {LayerSpecification} from '../style-spec/types';
import type {ConfigOptions} from './properties';
import type {LUT} from "../util/lut";

const subclasses = {
    circle,
    heatmap,
    hillshade,
    fill,
    'fill-extrusion': fillExtrusion,
    line,
    symbol,
    background,
    raster,
    'raster-particle': rasterParticle,
    sky,
    slot,
    model,
    clip
};

export default function createStyleLayer(
    layer: LayerSpecification | CustomLayerInterface,
    scope: string,
    lut: LUT | null,
    options?: ConfigOptions | null,
): StyleLayer | CustomStyleLayer {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, scope);
    } else {
        return new subclasses[layer.type](layer, scope, lut, options);
    }
}
