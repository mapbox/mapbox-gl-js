// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

const styleSpec = require('../../style-spec/reference/latest');

const {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedProperty,
    HeatmapColorProperty
} = require('../properties');

import type Color from '../../style-spec/util/color';


export type PaintProps = {|
    "heatmap-radius": DataDrivenProperty<number>,
    "heatmap-weight": DataDrivenProperty<number>,
    "heatmap-intensity": DataConstantProperty<number>,
    "heatmap-color": HeatmapColorProperty,
    "heatmap-opacity": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "heatmap-radius": new DataDrivenProperty(styleSpec["paint_heatmap"]["heatmap-radius"]),
    "heatmap-weight": new DataDrivenProperty(styleSpec["paint_heatmap"]["heatmap-weight"]),
    "heatmap-intensity": new DataConstantProperty(styleSpec["paint_heatmap"]["heatmap-intensity"]),
    "heatmap-color": new HeatmapColorProperty(styleSpec["paint_heatmap"]["heatmap-color"]),
    "heatmap-opacity": new DataConstantProperty(styleSpec["paint_heatmap"]["heatmap-opacity"]),
});

module.exports = { paint };
