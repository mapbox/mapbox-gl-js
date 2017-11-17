// This file is generated. Edit build/generate-style-code.js, then run `node build/generate-style-code.js`.
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
    "circle-radius": DataDrivenProperty<number>,
    "circle-color": DataDrivenProperty<Color>,
    "circle-blur": DataDrivenProperty<number>,
    "circle-opacity": DataDrivenProperty<number>,
    "circle-translate": DataConstantProperty<[number, number]>,
    "circle-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "circle-pitch-scale": DataConstantProperty<"map" | "viewport">,
    "circle-pitch-alignment": DataConstantProperty<"map" | "viewport">,
    "circle-stroke-width": DataDrivenProperty<number>,
    "circle-stroke-color": DataDrivenProperty<Color>,
    "circle-stroke-opacity": DataDrivenProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "circle-radius": new DataDrivenProperty(styleSpec["paint_circle"]["circle-radius"]),
    "circle-color": new DataDrivenProperty(styleSpec["paint_circle"]["circle-color"]),
    "circle-blur": new DataDrivenProperty(styleSpec["paint_circle"]["circle-blur"]),
    "circle-opacity": new DataDrivenProperty(styleSpec["paint_circle"]["circle-opacity"]),
    "circle-translate": new DataConstantProperty(styleSpec["paint_circle"]["circle-translate"]),
    "circle-translate-anchor": new DataConstantProperty(styleSpec["paint_circle"]["circle-translate-anchor"]),
    "circle-pitch-scale": new DataConstantProperty(styleSpec["paint_circle"]["circle-pitch-scale"]),
    "circle-pitch-alignment": new DataConstantProperty(styleSpec["paint_circle"]["circle-pitch-alignment"]),
    "circle-stroke-width": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-width"]),
    "circle-stroke-color": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-color"]),
    "circle-stroke-opacity": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-opacity"]),
});

module.exports = { paint };
