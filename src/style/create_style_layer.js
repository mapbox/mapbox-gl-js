// @flow

import type StyleLayer from './style_layer.js';
import circle from './style_layer/circle_style_layer.js';
import heatmap from './style_layer/heatmap_style_layer.js';
import hillshade from './style_layer/hillshade_style_layer.js';
import fill from './style_layer/fill_style_layer.js';
import fillExtrusion from './style_layer/fill_extrusion_style_layer.js';
import line from './style_layer/line_style_layer.js';
import symbol from './style_layer/symbol_style_layer.js';
import background from './style_layer/background_style_layer.js';
import raster from './style_layer/raster_style_layer.js';
import rasterParticle from './style_layer/raster_particle_style_layer.js';
import CustomStyleLayer from './style_layer/custom_style_layer.js';
import sky from './style_layer/sky_style_layer.js';
import slot from './style_layer/slot_style_layer.js';
import type {CustomLayerInterface} from './style_layer/custom_style_layer.js';
import model from '../../3d-style/style/style_layer/model_style_layer.js';

import type {LayerSpecification} from '../style-spec/types.js';
import type {ConfigOptions} from './properties.js';

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
    model
};

export default function createStyleLayer(layer: LayerSpecification | CustomLayerInterface, scope: string, options?: ?ConfigOptions): StyleLayer | CustomStyleLayer {
    if (layer.type === 'custom') {
        return new CustomStyleLayer(layer, scope);
    } else {
        return new subclasses[layer.type](layer, scope, options);
    }
}
