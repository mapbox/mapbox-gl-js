import type CircleStyleLayer from './circle_style_layer';
import type FillStyleLayer from './fill_style_layer';
import type FillExtrusionStyleLayer from './fill_extrusion_style_layer';
import type HeatmapStyleLayer from './heatmap_style_layer';
import type LineStyleLayer from './line_style_layer';
import type SymbolStyleLayer from './symbol_style_layer';
import type ModelStyleLayer from '../../../3d-style/style/style_layer/model_style_layer';
import type ClipStyleLayer from './clip_style_layer';

export type TypedStyleLayer = CircleStyleLayer | FillStyleLayer | FillExtrusionStyleLayer | HeatmapStyleLayer | LineStyleLayer | SymbolStyleLayer | ModelStyleLayer | ClipStyleLayer;
