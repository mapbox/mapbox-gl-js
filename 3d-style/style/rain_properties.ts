// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest';

import {
    Properties,
    DataConstantProperty
} from '../../src/style/properties';

import type Color from '../../src/style-spec/util/color';

export type RainProps = {
    "density": DataConstantProperty<number>;
    "intensity": DataConstantProperty<number>;
    "color": DataConstantProperty<Color>;
    "opacity": DataConstantProperty<number>;
    "vignette": DataConstantProperty<number>;
    "vignette-color": DataConstantProperty<Color>;
    "center-thinning": DataConstantProperty<number>;
    "direction": DataConstantProperty<[number, number]>;
    "droplet-size": DataConstantProperty<[number, number]>;
    "distortion-strength": DataConstantProperty<number>;
};

let properties: Properties<RainProps>;
export const getProperties = (): Properties<RainProps> => properties || (properties = new Properties({
    "density": new DataConstantProperty(styleSpec["rain"]["density"]),
    "intensity": new DataConstantProperty(styleSpec["rain"]["intensity"]),
    "color": new DataConstantProperty(styleSpec["rain"]["color"]),
    "opacity": new DataConstantProperty(styleSpec["rain"]["opacity"]),
    "vignette": new DataConstantProperty(styleSpec["rain"]["vignette"]),
    "vignette-color": new DataConstantProperty(styleSpec["rain"]["vignette-color"]),
    "center-thinning": new DataConstantProperty(styleSpec["rain"]["center-thinning"]),
    "direction": new DataConstantProperty(styleSpec["rain"]["direction"]),
    "droplet-size": new DataConstantProperty(styleSpec["rain"]["droplet-size"]),
    "distortion-strength": new DataConstantProperty(styleSpec["rain"]["distortion-strength"]),
}));
