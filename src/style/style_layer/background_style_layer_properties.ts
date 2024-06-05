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

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_background"]["visibility"]),
});

export type PaintProps = {
    "background-color": DataConstantProperty<Color>;
    "background-pattern": DataConstantProperty<ResolvedImage | null | undefined>;
    "background-opacity": DataConstantProperty<number>;
    "background-emissive-strength": DataConstantProperty<number>;
};

const paint: Properties<PaintProps> = new Properties({
    "background-color": new DataConstantProperty(styleSpec["paint_background"]["background-color"]),
    "background-pattern": new DataConstantProperty(styleSpec["paint_background"]["background-pattern"]),
    "background-opacity": new DataConstantProperty(styleSpec["paint_background"]["background-opacity"]),
    "background-emissive-strength": new DataConstantProperty(styleSpec["paint_background"]["background-emissive-strength"]),
});

export default { paint, layout };
