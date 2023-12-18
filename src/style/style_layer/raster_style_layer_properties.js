// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    ColorRampProperty
} from '../properties.js';

import type Color from '../../style-spec/util/color.js';

import type Formatted from '../../style-spec/expression/types/formatted.js';

import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

export type LayoutProps = {|
    "visibility": DataConstantProperty<"visible" | "none">,
|};

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_raster"]["visibility"]),
});

export type PaintProps = {|
    "raster-opacity": DataConstantProperty<number>,
    "raster-color": ColorRampProperty,
    "raster-color-mix": DataConstantProperty<[number, number, number, number]>,
    "raster-color-range": DataConstantProperty<[number, number]>,
    "raster-hue-rotate": DataConstantProperty<number>,
    "raster-brightness-min": DataConstantProperty<number>,
    "raster-brightness-max": DataConstantProperty<number>,
    "raster-saturation": DataConstantProperty<number>,
    "raster-contrast": DataConstantProperty<number>,
    "raster-resampling": DataConstantProperty<"linear" | "nearest">,
    "raster-fade-duration": DataConstantProperty<number>,
    "raster-emissive-strength": DataConstantProperty<number>,
    "raster-array-band": DataConstantProperty<string>,
    "raster-elevation": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
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
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
