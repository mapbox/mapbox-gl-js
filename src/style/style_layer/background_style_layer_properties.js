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
    "background-color": DataConstantProperty<Color>,
    "background-pattern": CrossFadedProperty<string>,
    "background-opacity": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "background-color": new DataConstantProperty(styleSpec["paint_background"]["background-color"]),
    "background-pattern": new CrossFadedProperty(styleSpec["paint_background"]["background-pattern"]),
    "background-opacity": new DataConstantProperty(styleSpec["paint_background"]["background-opacity"]),
});

module.exports = { paint };
