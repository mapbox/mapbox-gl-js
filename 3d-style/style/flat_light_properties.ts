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
    "anchor": DataConstantProperty<"map" | "viewport">;
    "position": DataConstantProperty<[number, number, number]>;
    "color": DataConstantProperty<Color>;
    "color-use-theme": DataConstantProperty<string>;
    "intensity": DataConstantProperty<number>;
};

let properties: Properties<LightProps>;
export const getProperties = (): Properties<LightProps> => properties || (properties = new Properties({
    "anchor": new DataConstantProperty(styleSpec["properties_light_flat"]["anchor"]),
    "position": new DataConstantProperty(styleSpec["properties_light_flat"]["position"]),
    "color": new DataConstantProperty(styleSpec["properties_light_flat"]["color"]),
    "color-use-theme": new DataConstantProperty({"type":"string","default":"default","property-type":"data-constant"}),
    "intensity": new DataConstantProperty(styleSpec["properties_light_flat"]["intensity"]),
}));
