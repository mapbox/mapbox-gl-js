// This file is generated. Edit build/generate-style-code.js, then run `npm run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../../src/style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    ColorRampProperty
} from '../../../src/style/properties.js';

import type Color from '../../../src/style-spec/util/color.js';

import type Formatted from '../../../src/style-spec/expression/types/formatted.js';

import type ResolvedImage from '../../../src/style-spec/expression/types/resolved_image.js';

export type LayoutProps = {|
    "visibility": DataConstantProperty<"visible" | "none">,
    "model-id": DataDrivenProperty<string>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_model"]["visibility"]),
    "model-id": new DataDrivenProperty(styleSpec["layout_model"]["model-id"]),
});

export type PaintProps = {|
    "model-opacity": DataConstantProperty<number>,
    "model-rotation": DataDrivenProperty<[number, number, number]>,
    "model-scale": DataDrivenProperty<[number, number, number]>,
    "model-translation": DataDrivenProperty<[number, number, number]>,
    "model-color": DataDrivenProperty<Color>,
    "model-color-mix-intensity": DataDrivenProperty<number>,
    "model-type": DataConstantProperty<"common-3d" | "location-indicator">,
    "model-cast-shadows": DataConstantProperty<boolean>,
    "model-receive-shadows": DataConstantProperty<boolean>,
    "model-ambient-occlusion-intensity": DataConstantProperty<number>,
    "model-emissive-strength": DataDrivenProperty<number>,
    "model-roughness": DataDrivenProperty<number>,
    "model-height-based-emissive-strength-multiplier": DataDrivenProperty<[number, number, number, number, number]>,
    "model-cutoff-fade-range": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "model-opacity": new DataConstantProperty(styleSpec["paint_model"]["model-opacity"]),
    "model-rotation": new DataDrivenProperty(styleSpec["paint_model"]["model-rotation"]),
    "model-scale": new DataDrivenProperty(styleSpec["paint_model"]["model-scale"]),
    "model-translation": new DataDrivenProperty(styleSpec["paint_model"]["model-translation"]),
    "model-color": new DataDrivenProperty(styleSpec["paint_model"]["model-color"]),
    "model-color-mix-intensity": new DataDrivenProperty(styleSpec["paint_model"]["model-color-mix-intensity"]),
    "model-type": new DataConstantProperty(styleSpec["paint_model"]["model-type"]),
    "model-cast-shadows": new DataConstantProperty(styleSpec["paint_model"]["model-cast-shadows"]),
    "model-receive-shadows": new DataConstantProperty(styleSpec["paint_model"]["model-receive-shadows"]),
    "model-ambient-occlusion-intensity": new DataConstantProperty(styleSpec["paint_model"]["model-ambient-occlusion-intensity"]),
    "model-emissive-strength": new DataDrivenProperty(styleSpec["paint_model"]["model-emissive-strength"]),
    "model-roughness": new DataDrivenProperty(styleSpec["paint_model"]["model-roughness"]),
    "model-height-based-emissive-strength-multiplier": new DataDrivenProperty(styleSpec["paint_model"]["model-height-based-emissive-strength-multiplier"]),
    "model-cutoff-fade-range": new DataConstantProperty(styleSpec["paint_model"]["model-cutoff-fade-range"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
