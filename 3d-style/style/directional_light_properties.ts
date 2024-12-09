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
    "color-use-theme": DataConstantProperty<string>;
    "intensity": DataConstantProperty<number>;
    "cast-shadows": DataConstantProperty<boolean>;
    "shadow-quality": DataConstantProperty<number>;
    "shadow-intensity": DataConstantProperty<number>;
};

let properties: Properties<LightProps>;
export const getProperties = (): Properties<LightProps> => properties || (properties = new Properties({
    "direction": new DirectionProperty(styleSpec["properties_light_directional"]["direction"]),
    "color": new DataConstantProperty(styleSpec["properties_light_directional"]["color"]),
    "color-use-theme": new DataConstantProperty({"type":"string","default":"default","property-type":"data-constant"}),
    "intensity": new DataConstantProperty(styleSpec["properties_light_directional"]["intensity"]),
    "cast-shadows": new DataConstantProperty(styleSpec["properties_light_directional"]["cast-shadows"]),
    "shadow-quality": new DataConstantProperty(styleSpec["properties_light_directional"]["shadow-quality"]),
    "shadow-intensity": new DataConstantProperty(styleSpec["properties_light_directional"]["shadow-intensity"]),
}));
