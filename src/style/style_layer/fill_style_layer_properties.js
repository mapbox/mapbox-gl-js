// This file is generated. Edit build/generate-style-code.js, then run `npm run codegen`.
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
    "fill-sort-key": DataDrivenProperty<number>,
    "visibility": DataConstantProperty<"visible" | "none">,
|};

const layout: Properties<LayoutProps> = new Properties({
    "fill-sort-key": new DataDrivenProperty(styleSpec["layout_fill"]["fill-sort-key"]),
    "visibility": new DataConstantProperty(styleSpec["layout_fill"]["visibility"]),
});

export type PaintProps = {|
    "fill-antialias": DataConstantProperty<boolean>,
    "fill-opacity": DataDrivenProperty<number>,
    "fill-color": DataDrivenProperty<Color>,
    "fill-outline-color": DataDrivenProperty<Color>,
    "fill-translate": DataConstantProperty<[number, number]>,
    "fill-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "fill-pattern": DataDrivenProperty<?ResolvedImage>,
    "fill-emissive-strength": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "fill-antialias": new DataConstantProperty(styleSpec["paint_fill"]["fill-antialias"]),
    "fill-opacity": new DataDrivenProperty(styleSpec["paint_fill"]["fill-opacity"]),
    "fill-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-color"]),
    "fill-outline-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-outline-color"]),
    "fill-translate": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate"]),
    "fill-translate-anchor": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate-anchor"]),
    "fill-pattern": new DataDrivenProperty(styleSpec["paint_fill"]["fill-pattern"]),
    "fill-emissive-strength": new DataConstantProperty(styleSpec["paint_fill"]["fill-emissive-strength"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
