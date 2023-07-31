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
    "visibility": new DataConstantProperty(styleSpec["layout_background"]["visibility"]),
});

export type PaintProps = {|
    "background-color": DataConstantProperty<Color>,
    "background-pattern": DataConstantProperty<?ResolvedImage>,
    "background-opacity": DataConstantProperty<number>,
    "background-emissive-strength": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "background-color": new DataConstantProperty(styleSpec["paint_background"]["background-color"]),
    "background-pattern": new DataConstantProperty(styleSpec["paint_background"]["background-pattern"]),
    "background-opacity": new DataConstantProperty(styleSpec["paint_background"]["background-opacity"]),
    "background-emissive-strength": new DataConstantProperty(styleSpec["paint_background"]["background-emissive-strength"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
