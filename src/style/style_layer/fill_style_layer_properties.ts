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
};

const layout: Properties<LayoutProps> = new Properties({
    "fill-sort-key": new DataDrivenProperty(styleSpec["layout_fill"]["fill-sort-key"]),
    "visibility": new DataConstantProperty(styleSpec["layout_fill"]["visibility"]),
});

export type PaintProps = {
    "fill-antialias": DataConstantProperty<boolean>;
    "fill-opacity": DataDrivenProperty<number>;
    "fill-color": DataDrivenProperty<Color>;
    "fill-outline-color": DataDrivenProperty<Color>;
    "fill-translate": DataConstantProperty<[number, number]>;
    "fill-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "fill-pattern": DataDrivenProperty<ResolvedImage | null | undefined>;
    "fill-emissive-strength": DataConstantProperty<number>;
};

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

export default { paint, layout };
