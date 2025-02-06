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
    "visibility": new DataConstantProperty(styleSpec["layout_raster-particle"]["visibility"]),
}));

export type PaintProps = {
    "raster-particle-array-band": DataConstantProperty<string>;
    "raster-particle-count": DataConstantProperty<number>;
    "raster-particle-color": ColorRampProperty;
    "raster-particle-max-speed": DataConstantProperty<number>;
    "raster-particle-speed-factor": DataConstantProperty<number>;
    "raster-particle-fade-opacity-factor": DataConstantProperty<number>;
    "raster-particle-reset-rate-factor": DataConstantProperty<number>;
    "raster-particle-elevation": DataConstantProperty<number>;
    "raster-particle-color-use-theme": DataDrivenProperty<string>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "raster-particle-array-band": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-array-band"]),
    "raster-particle-count": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-count"]),
    "raster-particle-color": new ColorRampProperty(styleSpec["paint_raster-particle"]["raster-particle-color"]),
    "raster-particle-max-speed": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-max-speed"]),
    "raster-particle-speed-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-speed-factor"]),
    "raster-particle-fade-opacity-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-fade-opacity-factor"]),
    "raster-particle-reset-rate-factor": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-reset-rate-factor"]),
    "raster-particle-elevation": new DataConstantProperty(styleSpec["paint_raster-particle"]["raster-particle-elevation"]),
    "raster-particle-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));
