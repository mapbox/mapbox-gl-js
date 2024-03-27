// This file is generated. Edit build/generate-style-code.js, then run `npm run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DirectionProperty,
} from '../../src/style/properties.js';

import type Color from '../../src/style-spec/util/color.js';

export type LightProps = {|
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
|};

const properties: Properties<LightProps> = new Properties({
    "color": new DataConstantProperty(styleSpec["properties_light_ambient"]["color"]),
    "intensity": new DataConstantProperty(styleSpec["properties_light_ambient"]["intensity"]),
});

export {properties}
