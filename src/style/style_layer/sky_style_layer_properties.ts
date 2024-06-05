// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest';

import {
    Properties,
    ColorRampProperty,
    DataDrivenProperty,
    DataConstantProperty
} from '../properties';


import type Color from '../../style-spec/util/color';
import type Formatted from '../../style-spec/expression/types/formatted';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image';
import type {StylePropertySpecification} from '../../style-spec/style-spec';

export type LayoutProps = {
    "visibility": DataConstantProperty<"visible" | "none">;
};

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_sky"]["visibility"]),
});

export type PaintProps = {
    "sky-type": DataConstantProperty<"gradient" | "atmosphere">;
    "sky-atmosphere-sun": DataConstantProperty<[number, number]>;
    "sky-atmosphere-sun-intensity": DataConstantProperty<number>;
    "sky-gradient-center": DataConstantProperty<[number, number]>;
    "sky-gradient-radius": DataConstantProperty<number>;
    "sky-gradient": ColorRampProperty;
    "sky-atmosphere-halo-color": DataConstantProperty<Color>;
    "sky-atmosphere-color": DataConstantProperty<Color>;
    "sky-opacity": DataConstantProperty<number>;
};

const paint: Properties<PaintProps> = new Properties({
    "sky-type": new DataConstantProperty(styleSpec["paint_sky"]["sky-type"]),
    "sky-atmosphere-sun": new DataConstantProperty(styleSpec["paint_sky"]["sky-atmosphere-sun"]),
    "sky-atmosphere-sun-intensity": new DataConstantProperty(styleSpec["paint_sky"]["sky-atmosphere-sun-intensity"]),
    "sky-gradient-center": new DataConstantProperty(styleSpec["paint_sky"]["sky-gradient-center"]),
    "sky-gradient-radius": new DataConstantProperty(styleSpec["paint_sky"]["sky-gradient-radius"]),
    "sky-gradient": new ColorRampProperty(styleSpec["paint_sky"]["sky-gradient"]),
    "sky-atmosphere-halo-color": new DataConstantProperty(styleSpec["paint_sky"]["sky-atmosphere-halo-color"]),
    "sky-atmosphere-color": new DataConstantProperty(styleSpec["paint_sky"]["sky-atmosphere-color"]),
    "sky-opacity": new DataConstantProperty(styleSpec["paint_sky"]["sky-opacity"]),
});

export default { paint, layout };
