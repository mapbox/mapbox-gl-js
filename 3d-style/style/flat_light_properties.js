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
    "anchor": DataConstantProperty<"map" | "viewport">,
    "position": DataConstantProperty<[number, number, number]>,
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
|};

const properties: Properties<LightProps> = new Properties({
    "anchor": new DataConstantProperty(styleSpec["properties_light_flat"]["anchor"]),
    "position": new DataConstantProperty(styleSpec["properties_light_flat"]["position"]),
    "color": new DataConstantProperty(styleSpec["properties_light_flat"]["color"]),
    "intensity": new DataConstantProperty(styleSpec["properties_light_flat"]["intensity"]),
});

export {properties}
