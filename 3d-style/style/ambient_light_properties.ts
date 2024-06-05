// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest';

import {
    Properties,
    DirectionProperty,
    DataConstantProperty
} from '../../src/style/properties';

import type Color from '../../src/style-spec/util/color';
import type {StylePropertySpecification} from '../../src/style-spec/style-spec';

export type LightProps = {
    "color": DataConstantProperty<Color>;
    "intensity": DataConstantProperty<number>;
};

const properties: Properties<LightProps> = new Properties({
    "color": new DataConstantProperty(styleSpec["properties_light_ambient"]["color"]),
    "intensity": new DataConstantProperty(styleSpec["properties_light_ambient"]["intensity"]),
});

export {properties}
