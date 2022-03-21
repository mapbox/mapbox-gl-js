// @flow

import type CircleStyleLayer from './circle_style_layer.js';
import type FillStyleLayer from './fill_style_layer.js';
import type FillExtrusionStyleLayer from './fill_extrusion_style_layer.js';
import type HeatmapStyleLayer from './heatmap_style_layer.js';
import type LineStyleLayer from './line_style_layer.js';
import type SymbolStyleLayer from './symbol_style_layer.js';

export type TypedStyleLayer = CircleStyleLayer |
    FillStyleLayer |
    FillExtrusionStyleLayer |
    HeatmapStyleLayer |
    LineStyleLayer |
    SymbolStyleLayer;
