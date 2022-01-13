// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedDataDrivenProperty,
    CrossFadedProperty,
    ColorRampProperty
} from '../properties.js';

import type Color from '../../style-spec/util/color.js';

import type Formatted from '../../style-spec/expression/types/formatted.js';

import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

export type LayoutProps = {|
    "particle-sort-key": DataDrivenProperty<number>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "particle-sort-key": new DataDrivenProperty(styleSpec["layout_particle"]["particle-sort-key"]),
});

export type PaintProps = {|
    "particle-radius": DataDrivenProperty<number>,
    "particle-color": DataDrivenProperty<Color>,
    "particle-blur": DataDrivenProperty<number>,
    "particle-opacity": DataDrivenProperty<number>,
    "particle-translate": DataConstantProperty<[number, number]>,
    "particle-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "particle-pitch-scale": DataConstantProperty<"map" | "viewport">,
    "particle-pitch-alignment": DataConstantProperty<"map" | "viewport">,
    "particle-stroke-width": DataDrivenProperty<number>,
    "particle-stroke-color": DataDrivenProperty<Color>,
    "particle-stroke-opacity": DataDrivenProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "particle-radius": new DataDrivenProperty(styleSpec["paint_particle"]["particle-radius"]),
    "particle-color": new DataDrivenProperty(styleSpec["paint_particle"]["particle-color"]),
    "particle-blur": new DataDrivenProperty(styleSpec["paint_particle"]["particle-blur"]),
    "particle-opacity": new DataDrivenProperty(styleSpec["paint_particle"]["particle-opacity"]),
    "particle-translate": new DataConstantProperty(styleSpec["paint_particle"]["particle-translate"]),
    "particle-translate-anchor": new DataConstantProperty(styleSpec["paint_particle"]["particle-translate-anchor"]),
    "particle-pitch-scale": new DataConstantProperty(styleSpec["paint_particle"]["particle-pitch-scale"]),
    "particle-pitch-alignment": new DataConstantProperty(styleSpec["paint_particle"]["particle-pitch-alignment"]),
    "particle-stroke-width": new DataDrivenProperty(styleSpec["paint_particle"]["particle-stroke-width"]),
    "particle-stroke-color": new DataDrivenProperty(styleSpec["paint_particle"]["particle-stroke-color"]),
    "particle-stroke-opacity": new DataDrivenProperty(styleSpec["paint_particle"]["particle-stroke-opacity"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
