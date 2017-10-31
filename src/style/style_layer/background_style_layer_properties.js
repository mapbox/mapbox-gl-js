// This file is generated. Edit build/generate-style-code.js, then run `node build/generate-style-code.js`.
// @flow
/* eslint-disable */

const styleSpec = require('../../style-spec/reference/latest');

const {
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedProperty,
    HeatmapColorProperty
} = require('../properties');

import type Color from '../../style-spec/util/color';


export type PaintProperties = {|
    "background-color": DataConstantProperty<Color>,
    "background-pattern": CrossFadedProperty<string>,
    "background-opacity": DataConstantProperty<number>,
|};

const paint: PaintProperties = {
    "background-color": new DataConstantProperty(styleSpec["paint_background"]["background-color"]),
    "background-pattern": new CrossFadedProperty(styleSpec["paint_background"]["background-pattern"]),
    "background-opacity": new DataConstantProperty(styleSpec["paint_background"]["background-opacity"]),
};

module.exports = { paint };
