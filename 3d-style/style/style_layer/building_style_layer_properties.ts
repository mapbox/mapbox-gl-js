// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../../src/style-spec/reference/latest';

import {
    Properties,
    ColorRampProperty,
    DataDrivenProperty,
    DataConstantProperty
} from '../../../src/style/properties';


import type Color from '../../../src/style-spec/util/color';
import type Formatted from '../../../src/style-spec/expression/types/formatted';
import type ResolvedImage from '../../../src/style-spec/expression/types/resolved_image';
import type {StylePropertySpecification} from '../../../src/style-spec/style-spec';

export type LayoutProps = {
    "visibility": DataConstantProperty<"visible" | "none">;
    "building-facade": DataDrivenProperty<boolean>;
    "building-facade-floors": DataDrivenProperty<number>;
    "building-facade-window": DataDrivenProperty<[number, number]>;
    "building-roof-shape": DataDrivenProperty<"flat" | "hipped" | "gabled" | "parapet" | "mansard" | "skillion" | "pyramidal">;
    "building-height": DataDrivenProperty<number>;
    "building-base": DataDrivenProperty<number>;
};
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_building"]["visibility"]),
    "building-facade": new DataDrivenProperty(styleSpec["layout_building"]["building-facade"]),
    "building-facade-floors": new DataDrivenProperty(styleSpec["layout_building"]["building-facade-floors"]),
    "building-facade-window": new DataDrivenProperty(styleSpec["layout_building"]["building-facade-window"]),
    "building-roof-shape": new DataDrivenProperty(styleSpec["layout_building"]["building-roof-shape"]),
    "building-height": new DataDrivenProperty(styleSpec["layout_building"]["building-height"]),
    "building-base": new DataDrivenProperty(styleSpec["layout_building"]["building-base"]),
}));

export type PaintProps = {
    "building-opacity": DataConstantProperty<number>;
    "building-ambient-occlusion-intensity": DataConstantProperty<number>;
    "building-ambient-occlusion-ground-intensity": DataConstantProperty<number>;
    "building-ambient-occlusion-ground-radius": DataConstantProperty<number>;
    "building-ambient-occlusion-ground-attenuation": DataConstantProperty<number>;
    "building-vertical-scale": DataConstantProperty<number>;
    "building-cast-shadows": DataConstantProperty<boolean>;
    "building-color": DataDrivenProperty<Color>;
    "building-emissive-strength": DataDrivenProperty<number>;
    "building-facade-emissive-chance": DataConstantProperty<number>;
    "building-cutoff-fade-range": DataConstantProperty<number>;
    "building-color-use-theme": DataDrivenProperty<string>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "building-opacity": new DataConstantProperty(styleSpec["paint_building"]["building-opacity"]),
    "building-ambient-occlusion-intensity": new DataConstantProperty(styleSpec["paint_building"]["building-ambient-occlusion-intensity"]),
    "building-ambient-occlusion-ground-intensity": new DataConstantProperty(styleSpec["paint_building"]["building-ambient-occlusion-ground-intensity"]),
    "building-ambient-occlusion-ground-radius": new DataConstantProperty(styleSpec["paint_building"]["building-ambient-occlusion-ground-radius"]),
    "building-ambient-occlusion-ground-attenuation": new DataConstantProperty(styleSpec["paint_building"]["building-ambient-occlusion-ground-attenuation"]),
    "building-vertical-scale": new DataConstantProperty(styleSpec["paint_building"]["building-vertical-scale"]),
    "building-cast-shadows": new DataConstantProperty(styleSpec["paint_building"]["building-cast-shadows"]),
    "building-color": new DataDrivenProperty(styleSpec["paint_building"]["building-color"]),
    "building-emissive-strength": new DataDrivenProperty(styleSpec["paint_building"]["building-emissive-strength"]),
    "building-facade-emissive-chance": new DataConstantProperty(styleSpec["paint_building"]["building-facade-emissive-chance"]),
    "building-cutoff-fade-range": new DataConstantProperty(styleSpec["paint_building"]["building-cutoff-fade-range"]),
    "building-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));
