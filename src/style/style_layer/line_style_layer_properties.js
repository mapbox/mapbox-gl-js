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
    "line-cap": DataDrivenProperty<"butt" | "round" | "square">,
    "line-join": DataDrivenProperty<"bevel" | "round" | "miter">,
    "line-miter-limit": DataConstantProperty<number>,
    "line-round-limit": DataConstantProperty<number>,
    "line-sort-key": DataDrivenProperty<number>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "line-cap": new DataDrivenProperty(styleSpec["layout_line"]["line-cap"]),
    "line-join": new DataDrivenProperty(styleSpec["layout_line"]["line-join"]),
    "line-miter-limit": new DataConstantProperty(styleSpec["layout_line"]["line-miter-limit"]),
    "line-round-limit": new DataConstantProperty(styleSpec["layout_line"]["line-round-limit"]),
    "line-sort-key": new DataDrivenProperty(styleSpec["layout_line"]["line-sort-key"]),
});

export type PaintProps = {|
    "line-opacity": DataDrivenProperty<number>,
    "line-color": DataDrivenProperty<Color>,
    "line-translate": DataConstantProperty<[number, number]>,
    "line-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "line-width": DataDrivenProperty<number>,
    "line-gap-width": DataDrivenProperty<number>,
    "line-offset": DataDrivenProperty<number>,
    "line-blur": DataDrivenProperty<number>,
    "line-dasharray": DataDrivenProperty<?Array<number>>,
    "line-pattern": DataDrivenProperty<?ResolvedImage>,
    "line-gradient": ColorRampProperty,
    "line-trim-offset": DataConstantProperty<[number, number]>,
|};

const paint: Properties<PaintProps> = new Properties({
    "line-opacity": new DataDrivenProperty(styleSpec["paint_line"]["line-opacity"]),
    "line-color": new DataDrivenProperty(styleSpec["paint_line"]["line-color"]),
    "line-translate": new DataConstantProperty(styleSpec["paint_line"]["line-translate"]),
    "line-translate-anchor": new DataConstantProperty(styleSpec["paint_line"]["line-translate-anchor"]),
    "line-width": new DataDrivenProperty(styleSpec["paint_line"]["line-width"]),
    "line-gap-width": new DataDrivenProperty(styleSpec["paint_line"]["line-gap-width"]),
    "line-offset": new DataDrivenProperty(styleSpec["paint_line"]["line-offset"]),
    "line-blur": new DataDrivenProperty(styleSpec["paint_line"]["line-blur"]),
    "line-dasharray": new DataDrivenProperty(styleSpec["paint_line"]["line-dasharray"]),
    "line-pattern": new DataDrivenProperty(styleSpec["paint_line"]["line-pattern"]),
    "line-gradient": new ColorRampProperty(styleSpec["paint_line"]["line-gradient"]),
    "line-trim-offset": new DataConstantProperty(styleSpec["paint_line"]["line-trim-offset"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
