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
    "direction": DirectionProperty;
    "color": DataConstantProperty<Color>;
    "intensity": DataConstantProperty<number>;
    "cast-shadows": DataConstantProperty<boolean>;
    "shadow-intensity": DataConstantProperty<number>;
};

const properties: Properties<LightProps> = new Properties({
    "direction": new DirectionProperty(styleSpec["properties_light_directional"]["direction"]),
    "color": new DataConstantProperty(styleSpec["properties_light_directional"]["color"]),
    "intensity": new DataConstantProperty(styleSpec["properties_light_directional"]["intensity"]),
    "cast-shadows": new DataConstantProperty(styleSpec["properties_light_directional"]["cast-shadows"]),
    "shadow-intensity": new DataConstantProperty(styleSpec["properties_light_directional"]["shadow-intensity"]),
});

export {properties}
