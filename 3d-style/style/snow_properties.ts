// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest';

import {
    Properties,
    DataConstantProperty
} from '../../src/style/properties';

import type Color from '../../src/style-spec/util/color';

export type SnowProps = {
    "density": DataConstantProperty<number>;
    "intensity": DataConstantProperty<number>;
    "color": DataConstantProperty<Color>;
    "opacity": DataConstantProperty<number>;
    "vignette": DataConstantProperty<number>;
    "vignette-color": DataConstantProperty<Color>;
    "center-thinning": DataConstantProperty<number>;
    "direction": DataConstantProperty<[number, number]>;
    "flake-size": DataConstantProperty<number>;
};

let properties: Properties<SnowProps>;
export const getProperties = (): Properties<SnowProps> => properties || (properties = new Properties({
    "density": new DataConstantProperty(styleSpec["snow"]["density"]),
    "intensity": new DataConstantProperty(styleSpec["snow"]["intensity"]),
    "color": new DataConstantProperty(styleSpec["snow"]["color"]),
    "opacity": new DataConstantProperty(styleSpec["snow"]["opacity"]),
    "vignette": new DataConstantProperty(styleSpec["snow"]["vignette"]),
    "vignette-color": new DataConstantProperty(styleSpec["snow"]["vignette-color"]),
    "center-thinning": new DataConstantProperty(styleSpec["snow"]["center-thinning"]),
    "direction": new DataConstantProperty(styleSpec["snow"]["direction"]),
    "flake-size": new DataConstantProperty(styleSpec["snow"]["flake-size"]),
}));
