// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest';

import { Properties, DataConstantProperty, DataDrivenProperty, CrossFadedProperty, HeatmapColorProperty } from '../properties';

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

const exported = {
    paint
};

export default exported;
export { paint };
