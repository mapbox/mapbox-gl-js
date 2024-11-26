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
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_raster"]["visibility"]),
}));

export type PaintProps = {
    "raster-opacity": DataConstantProperty<number>;
    "raster-color": ColorRampProperty;
    "raster-color-mix": DataConstantProperty<[number, number, number, number]>;
    "raster-color-range": DataConstantProperty<[number, number]>;
    "raster-hue-rotate": DataConstantProperty<number>;
    "raster-brightness-min": DataConstantProperty<number>;
    "raster-brightness-max": DataConstantProperty<number>;
    "raster-saturation": DataConstantProperty<number>;
    "raster-contrast": DataConstantProperty<number>;
    "raster-resampling": DataConstantProperty<"linear" | "nearest">;
    "raster-fade-duration": DataConstantProperty<number>;
    "raster-emissive-strength": DataConstantProperty<number>;
    "raster-array-band": DataConstantProperty<string>;
    "raster-elevation": DataConstantProperty<number>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "raster-opacity": new DataConstantProperty(styleSpec["paint_raster"]["raster-opacity"]),
    "raster-color": new ColorRampProperty(styleSpec["paint_raster"]["raster-color"]),
    "raster-color-mix": new DataConstantProperty(styleSpec["paint_raster"]["raster-color-mix"]),
    "raster-color-range": new DataConstantProperty(styleSpec["paint_raster"]["raster-color-range"]),
    "raster-hue-rotate": new DataConstantProperty(styleSpec["paint_raster"]["raster-hue-rotate"]),
    "raster-brightness-min": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-min"]),
    "raster-brightness-max": new DataConstantProperty(styleSpec["paint_raster"]["raster-brightness-max"]),
    "raster-saturation": new DataConstantProperty(styleSpec["paint_raster"]["raster-saturation"]),
    "raster-contrast": new DataConstantProperty(styleSpec["paint_raster"]["raster-contrast"]),
    "raster-resampling": new DataConstantProperty(styleSpec["paint_raster"]["raster-resampling"]),
    "raster-fade-duration": new DataConstantProperty(styleSpec["paint_raster"]["raster-fade-duration"]),
    "raster-emissive-strength": new DataConstantProperty(styleSpec["paint_raster"]["raster-emissive-strength"]),
    "raster-array-band": new DataConstantProperty(styleSpec["paint_raster"]["raster-array-band"]),
    "raster-elevation": new DataConstantProperty(styleSpec["paint_raster"]["raster-elevation"]),
}));
