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
    "line-cap": DataDrivenProperty<"butt" | "round" | "square">;
    "line-join": DataDrivenProperty<"bevel" | "round" | "miter" | "none">;
    "line-miter-limit": DataConstantProperty<number>;
    "line-round-limit": DataConstantProperty<number>;
    "line-sort-key": DataDrivenProperty<number>;
    "line-z-offset": DataDrivenProperty<number>;
    "visibility": DataConstantProperty<"visible" | "none">;
};

const layout: Properties<LayoutProps> = new Properties({
    "line-cap": new DataDrivenProperty(styleSpec["layout_line"]["line-cap"]),
    "line-join": new DataDrivenProperty(styleSpec["layout_line"]["line-join"]),
    "line-miter-limit": new DataConstantProperty(styleSpec["layout_line"]["line-miter-limit"]),
    "line-round-limit": new DataConstantProperty(styleSpec["layout_line"]["line-round-limit"]),
    "line-sort-key": new DataDrivenProperty(styleSpec["layout_line"]["line-sort-key"]),
    "line-z-offset": new DataDrivenProperty(styleSpec["layout_line"]["line-z-offset"]),
    "visibility": new DataConstantProperty(styleSpec["layout_line"]["visibility"]),
});

export type PaintProps = {
    "line-opacity": DataDrivenProperty<number>;
    "line-color": DataDrivenProperty<Color>;
    "line-translate": DataConstantProperty<[number, number]>;
    "line-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "line-width": DataDrivenProperty<number>;
    "line-gap-width": DataDrivenProperty<number>;
    "line-offset": DataDrivenProperty<number>;
    "line-blur": DataDrivenProperty<number>;
    "line-dasharray": DataDrivenProperty<Array<number | null | undefined>>;
    "line-pattern": DataDrivenProperty<ResolvedImage | null | undefined>;
    "line-gradient": ColorRampProperty;
    "line-trim-offset": DataConstantProperty<[number, number]>;
    "line-trim-fade-range": DataConstantProperty<[number, number]>;
    "line-trim-color": DataConstantProperty<Color>;
    "line-emissive-strength": DataConstantProperty<number>;
    "line-border-width": DataDrivenProperty<number>;
    "line-border-color": DataDrivenProperty<Color>;
    "line-occlusion-opacity": DataConstantProperty<number>;
};

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
    "line-trim-fade-range": new DataConstantProperty(styleSpec["paint_line"]["line-trim-fade-range"]),
    "line-trim-color": new DataConstantProperty(styleSpec["paint_line"]["line-trim-color"]),
    "line-emissive-strength": new DataConstantProperty(styleSpec["paint_line"]["line-emissive-strength"]),
    "line-border-width": new DataDrivenProperty(styleSpec["paint_line"]["line-border-width"]),
    "line-border-color": new DataDrivenProperty(styleSpec["paint_line"]["line-border-color"]),
    "line-occlusion-opacity": new DataConstantProperty(styleSpec["paint_line"]["line-occlusion-opacity"]),
});

export default { paint, layout };
