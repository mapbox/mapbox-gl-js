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
    "visibility": DataConstantProperty<"visible" | "none">,
|};

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_raster-particle"]["visibility"]),
});

export type PaintProps = {|
    "raster-particle-array-band": DataConstantProperty<string>,
    "raster-particle-count": DataConstantProperty<number>,
    "raster-particle-color": ColorRampProperty,
    "raster-particle-max-speed": DataConstantProperty<number>,
    "raster-particle-speed-factor": DataConstantProperty<number>,
    "raster-particle-fade-opacity-factor": DataConstantProperty<number>,
    "raster-particle-reset-rate-factor": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "raster-particle-array-band": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-array-band"]),
    "raster-particle-count": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-count"]),
    "raster-particle-color": new ColorRampProperty(styleSpec["paint_raster-particle"]["raster-particle-color"]),
    "raster-particle-max-speed": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-max-speed"]),
    "raster-particle-speed-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-speed-factor"]),
    "raster-particle-fade-opacity-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-fade-opacity-factor"]),
    "raster-particle-reset-rate-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-reset-rate-factor"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
