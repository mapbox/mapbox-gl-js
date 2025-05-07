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
    "fill-sort-key": DataDrivenProperty<number>;
    "visibility": DataConstantProperty<"visible" | "none">;
    "fill-elevation-reference": DataConstantProperty<"none" | "hd-road-base" | "hd-road-markup">;
    "fill-construct-bridge-guard-rail": DataDrivenProperty<boolean>;
};
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "fill-sort-key": new DataDrivenProperty(styleSpec["layout_fill"]["fill-sort-key"]),
    "visibility": new DataConstantProperty(styleSpec["layout_fill"]["visibility"]),
    "fill-elevation-reference": new DataConstantProperty(styleSpec["layout_fill"]["fill-elevation-reference"]),
    "fill-construct-bridge-guard-rail": new DataDrivenProperty(styleSpec["layout_fill"]["fill-construct-bridge-guard-rail"]),
}));

export type PaintProps = {
    "fill-antialias": DataConstantProperty<boolean>;
    "fill-opacity": DataDrivenProperty<number>;
    "fill-color": DataDrivenProperty<Color>;
    "fill-outline-color": DataDrivenProperty<Color>;
    "fill-translate": DataConstantProperty<[number, number]>;
    "fill-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "fill-pattern": DataDrivenProperty<ResolvedImage | null | undefined>;
    "fill-pattern-cross-fade": DataConstantProperty<number>;
    "fill-emissive-strength": DataConstantProperty<number>;
    "fill-z-offset": DataDrivenProperty<number>;
    "fill-bridge-guard-rail-color": DataDrivenProperty<Color>;
    "fill-tunnel-structure-color": DataDrivenProperty<Color>;
    "fill-color-use-theme": DataDrivenProperty<string>;
    "fill-outline-color-use-theme": DataDrivenProperty<string>;
    "fill-bridge-guard-rail-color-use-theme": DataDrivenProperty<string>;
    "fill-tunnel-structure-color-use-theme": DataDrivenProperty<string>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "fill-antialias": new DataConstantProperty(styleSpec["paint_fill"]["fill-antialias"]),
    "fill-opacity": new DataDrivenProperty(styleSpec["paint_fill"]["fill-opacity"]),
    "fill-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-color"]),
    "fill-outline-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-outline-color"]),
    "fill-translate": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate"]),
    "fill-translate-anchor": new DataConstantProperty(styleSpec["paint_fill"]["fill-translate-anchor"]),
    "fill-pattern": new DataDrivenProperty(styleSpec["paint_fill"]["fill-pattern"]),
    "fill-pattern-cross-fade": new DataConstantProperty(styleSpec["paint_fill"]["fill-pattern-cross-fade"]),
    "fill-emissive-strength": new DataConstantProperty(styleSpec["paint_fill"]["fill-emissive-strength"]),
    "fill-z-offset": new DataDrivenProperty(styleSpec["paint_fill"]["fill-z-offset"]),
    "fill-bridge-guard-rail-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-bridge-guard-rail-color"]),
    "fill-tunnel-structure-color": new DataDrivenProperty(styleSpec["paint_fill"]["fill-tunnel-structure-color"]),
    "fill-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "fill-outline-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "fill-bridge-guard-rail-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "fill-tunnel-structure-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));
