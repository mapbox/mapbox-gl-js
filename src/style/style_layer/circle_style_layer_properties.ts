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
    "circle-sort-key": DataDrivenProperty<number>;
    "visibility": DataConstantProperty<"visible" | "none">;
};

const layout: Properties<LayoutProps> = new Properties({
    "circle-sort-key": new DataDrivenProperty(styleSpec["layout_circle"]["circle-sort-key"]),
    "visibility": new DataConstantProperty(styleSpec["layout_circle"]["visibility"]),
});

export type PaintProps = {
    "circle-radius": DataDrivenProperty<number>;
    "circle-color": DataDrivenProperty<Color>;
    "circle-blur": DataDrivenProperty<number>;
    "circle-opacity": DataDrivenProperty<number>;
    "circle-translate": DataConstantProperty<[number, number]>;
    "circle-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "circle-pitch-scale": DataConstantProperty<"map" | "viewport">;
    "circle-pitch-alignment": DataConstantProperty<"map" | "viewport">;
    "circle-stroke-width": DataDrivenProperty<number>;
    "circle-stroke-color": DataDrivenProperty<Color>;
    "circle-stroke-opacity": DataDrivenProperty<number>;
    "circle-emissive-strength": DataConstantProperty<number>;
};

const paint: Properties<PaintProps> = new Properties({
    "circle-radius": new DataDrivenProperty(styleSpec["paint_circle"]["circle-radius"]),
    "circle-color": new DataDrivenProperty(styleSpec["paint_circle"]["circle-color"]),
    "circle-blur": new DataDrivenProperty(styleSpec["paint_circle"]["circle-blur"]),
    "circle-opacity": new DataDrivenProperty(styleSpec["paint_circle"]["circle-opacity"]),
    "circle-translate": new DataConstantProperty(styleSpec["paint_circle"]["circle-translate"]),
    "circle-translate-anchor": new DataConstantProperty(styleSpec["paint_circle"]["circle-translate-anchor"]),
    "circle-pitch-scale": new DataConstantProperty(styleSpec["paint_circle"]["circle-pitch-scale"]),
    "circle-pitch-alignment": new DataConstantProperty(styleSpec["paint_circle"]["circle-pitch-alignment"]),
    "circle-stroke-width": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-width"]),
    "circle-stroke-color": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-color"]),
    "circle-stroke-opacity": new DataDrivenProperty(styleSpec["paint_circle"]["circle-stroke-opacity"]),
    "circle-emissive-strength": new DataConstantProperty(styleSpec["paint_circle"]["circle-emissive-strength"]),
});

export default { paint, layout };
