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
    "visibility": new DataConstantProperty(styleSpec["layout_hillshade"]["visibility"]),
});

export type PaintProps = {
    "hillshade-illumination-direction": DataConstantProperty<number>;
    "hillshade-illumination-anchor": DataConstantProperty<"map" | "viewport">;
    "hillshade-exaggeration": DataConstantProperty<number>;
    "hillshade-shadow-color": DataConstantProperty<Color>;
    "hillshade-highlight-color": DataConstantProperty<Color>;
    "hillshade-accent-color": DataConstantProperty<Color>;
    "hillshade-emissive-strength": DataConstantProperty<number>;
};

const paint: Properties<PaintProps> = new Properties({
    "hillshade-illumination-direction": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-illumination-direction"]),
    "hillshade-illumination-anchor": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-illumination-anchor"]),
    "hillshade-exaggeration": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-exaggeration"]),
    "hillshade-shadow-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-shadow-color"]),
    "hillshade-highlight-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-highlight-color"]),
    "hillshade-accent-color": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-accent-color"]),
    "hillshade-emissive-strength": new DataConstantProperty(styleSpec["paint_hillshade"]["hillshade-emissive-strength"]),
});

export default { paint, layout };
