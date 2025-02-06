// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest';

import {
    Properties,
    ColorRampProperty,
    DataDrivenProperty,
    DataConstantProperty
} from '../properties';


import {
    ColorType} from '../../style-spec/expression/types';

import type Color from '../../style-spec/util/color';
import type Formatted from '../../style-spec/expression/types/formatted';
import type ResolvedImage from '../../style-spec/expression/types/resolved_image';
import type {StylePropertySpecification} from '../../style-spec/style-spec';

export type LayoutProps = {
    "symbol-placement": DataConstantProperty<"point" | "line" | "line-center">;
    "symbol-spacing": DataConstantProperty<number>;
    "symbol-avoid-edges": DataConstantProperty<boolean>;
    "symbol-sort-key": DataDrivenProperty<number>;
    "symbol-z-order": DataConstantProperty<"auto" | "viewport-y" | "source">;
    "symbol-z-elevate": DataConstantProperty<boolean>;
    "symbol-elevation-reference": DataConstantProperty<"sea" | "ground" | "hd-road-markup">;
    "icon-allow-overlap": DataConstantProperty<boolean>;
    "icon-ignore-placement": DataConstantProperty<boolean>;
    "icon-optional": DataConstantProperty<boolean>;
    "icon-rotation-alignment": DataConstantProperty<"map" | "viewport" | "auto">;
    "icon-size": DataDrivenProperty<number>;
    "icon-size-scale-range": DataConstantProperty<[number, number]>;
    "icon-text-fit": DataDrivenProperty<"none" | "width" | "height" | "both">;
    "icon-text-fit-padding": DataDrivenProperty<[number, number, number, number]>;
    "icon-image": DataDrivenProperty<ResolvedImage>;
    "icon-rotate": DataDrivenProperty<number>;
    "icon-padding": DataConstantProperty<number>;
    "icon-keep-upright": DataConstantProperty<boolean>;
    "icon-offset": DataDrivenProperty<[number, number]>;
    "icon-anchor": DataDrivenProperty<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">;
    "icon-pitch-alignment": DataConstantProperty<"map" | "viewport" | "auto">;
    "text-pitch-alignment": DataConstantProperty<"map" | "viewport" | "auto">;
    "text-rotation-alignment": DataConstantProperty<"map" | "viewport" | "auto">;
    "text-field": DataDrivenProperty<Formatted>;
    "text-font": DataDrivenProperty<Array<string>>;
    "text-size": DataDrivenProperty<number>;
    "text-size-scale-range": DataConstantProperty<[number, number]>;
    "text-max-width": DataDrivenProperty<number>;
    "text-line-height": DataDrivenProperty<number>;
    "text-letter-spacing": DataDrivenProperty<number>;
    "text-justify": DataDrivenProperty<"auto" | "left" | "center" | "right">;
    "text-radial-offset": DataDrivenProperty<number>;
    "text-variable-anchor": DataConstantProperty<Array<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">>;
    "text-anchor": DataDrivenProperty<"center" | "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right">;
    "text-max-angle": DataConstantProperty<number>;
    "text-writing-mode": DataConstantProperty<Array<"horizontal" | "vertical">>;
    "text-rotate": DataDrivenProperty<number>;
    "text-padding": DataConstantProperty<number>;
    "text-keep-upright": DataConstantProperty<boolean>;
    "text-transform": DataDrivenProperty<"none" | "uppercase" | "lowercase">;
    "text-offset": DataDrivenProperty<[number, number]>;
    "text-allow-overlap": DataConstantProperty<boolean>;
    "text-ignore-placement": DataConstantProperty<boolean>;
    "text-optional": DataConstantProperty<boolean>;
    "visibility": DataConstantProperty<"visible" | "none">;
};
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "symbol-placement": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-placement"]),
    "symbol-spacing": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-spacing"]),
    "symbol-avoid-edges": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-avoid-edges"]),
    "symbol-sort-key": new DataDrivenProperty(styleSpec["layout_symbol"]["symbol-sort-key"]),
    "symbol-z-order": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-z-order"]),
    "symbol-z-elevate": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-z-elevate"]),
    "symbol-elevation-reference": new DataConstantProperty(styleSpec["layout_symbol"]["symbol-elevation-reference"]),
    "icon-allow-overlap": new DataConstantProperty(styleSpec["layout_symbol"]["icon-allow-overlap"]),
    "icon-ignore-placement": new DataConstantProperty(styleSpec["layout_symbol"]["icon-ignore-placement"]),
    "icon-optional": new DataConstantProperty(styleSpec["layout_symbol"]["icon-optional"]),
    "icon-rotation-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["icon-rotation-alignment"]),
    "icon-size": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-size"]),
    "icon-size-scale-range": new DataConstantProperty(styleSpec["layout_symbol"]["icon-size-scale-range"]),
    "icon-text-fit": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-text-fit"]),
    "icon-text-fit-padding": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-text-fit-padding"]),
    "icon-image": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-image"]),
    "icon-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-rotate"]),
    "icon-padding": new DataConstantProperty(styleSpec["layout_symbol"]["icon-padding"]),
    "icon-keep-upright": new DataConstantProperty(styleSpec["layout_symbol"]["icon-keep-upright"]),
    "icon-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-offset"]),
    "icon-anchor": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-anchor"]),
    "icon-pitch-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["icon-pitch-alignment"]),
    "text-pitch-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["text-pitch-alignment"]),
    "text-rotation-alignment": new DataConstantProperty(styleSpec["layout_symbol"]["text-rotation-alignment"]),
    "text-field": new DataDrivenProperty(styleSpec["layout_symbol"]["text-field"]),
    "text-font": new DataDrivenProperty(styleSpec["layout_symbol"]["text-font"]),
    "text-size": new DataDrivenProperty(styleSpec["layout_symbol"]["text-size"]),
    "text-size-scale-range": new DataConstantProperty(styleSpec["layout_symbol"]["text-size-scale-range"]),
    "text-max-width": new DataDrivenProperty(styleSpec["layout_symbol"]["text-max-width"]),
    "text-line-height": new DataDrivenProperty(styleSpec["layout_symbol"]["text-line-height"]),
    "text-letter-spacing": new DataDrivenProperty(styleSpec["layout_symbol"]["text-letter-spacing"]),
    "text-justify": new DataDrivenProperty(styleSpec["layout_symbol"]["text-justify"]),
    "text-radial-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["text-radial-offset"]),
    "text-variable-anchor": new DataConstantProperty(styleSpec["layout_symbol"]["text-variable-anchor"]),
    "text-anchor": new DataDrivenProperty(styleSpec["layout_symbol"]["text-anchor"]),
    "text-max-angle": new DataConstantProperty(styleSpec["layout_symbol"]["text-max-angle"]),
    "text-writing-mode": new DataConstantProperty(styleSpec["layout_symbol"]["text-writing-mode"]),
    "text-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["text-rotate"]),
    "text-padding": new DataConstantProperty(styleSpec["layout_symbol"]["text-padding"]),
    "text-keep-upright": new DataConstantProperty(styleSpec["layout_symbol"]["text-keep-upright"]),
    "text-transform": new DataDrivenProperty(styleSpec["layout_symbol"]["text-transform"]),
    "text-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["text-offset"]),
    "text-allow-overlap": new DataConstantProperty(styleSpec["layout_symbol"]["text-allow-overlap"]),
    "text-ignore-placement": new DataConstantProperty(styleSpec["layout_symbol"]["text-ignore-placement"]),
    "text-optional": new DataConstantProperty(styleSpec["layout_symbol"]["text-optional"]),
    "visibility": new DataConstantProperty(styleSpec["layout_symbol"]["visibility"]),
}));

export type PaintProps = {
    "icon-opacity": DataDrivenProperty<number>;
    "icon-occlusion-opacity": DataDrivenProperty<number>;
    "icon-emissive-strength": DataDrivenProperty<number>;
    "text-emissive-strength": DataDrivenProperty<number>;
    "icon-color": DataDrivenProperty<Color>;
    "icon-halo-color": DataDrivenProperty<Color>;
    "icon-halo-width": DataDrivenProperty<number>;
    "icon-halo-blur": DataDrivenProperty<number>;
    "icon-translate": DataConstantProperty<[number, number]>;
    "icon-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "icon-image-cross-fade": DataDrivenProperty<number>;
    "text-opacity": DataDrivenProperty<number>;
    "text-occlusion-opacity": DataDrivenProperty<number>;
    "text-color": DataDrivenProperty<Color>;
    "text-halo-color": DataDrivenProperty<Color>;
    "text-halo-width": DataDrivenProperty<number>;
    "text-halo-blur": DataDrivenProperty<number>;
    "text-translate": DataConstantProperty<[number, number]>;
    "text-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "icon-color-saturation": DataConstantProperty<number>;
    "icon-color-contrast": DataConstantProperty<number>;
    "icon-color-brightness-min": DataConstantProperty<number>;
    "icon-color-brightness-max": DataConstantProperty<number>;
    "symbol-z-offset": DataDrivenProperty<number>;
    "icon-color-use-theme": DataDrivenProperty<string>;
    "icon-halo-color-use-theme": DataDrivenProperty<string>;
    "text-color-use-theme": DataDrivenProperty<string>;
    "text-halo-color-use-theme": DataDrivenProperty<string>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "icon-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-opacity"]),
    "icon-occlusion-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-occlusion-opacity"]),
    "icon-emissive-strength": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-emissive-strength"]),
    "text-emissive-strength": new DataDrivenProperty(styleSpec["paint_symbol"]["text-emissive-strength"]),
    "icon-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-color"]),
    "icon-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-color"]),
    "icon-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-width"]),
    "icon-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-blur"]),
    "icon-translate": new DataConstantProperty(styleSpec["paint_symbol"]["icon-translate"]),
    "icon-translate-anchor": new DataConstantProperty(styleSpec["paint_symbol"]["icon-translate-anchor"]),
    "icon-image-cross-fade": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-image-cross-fade"]),
    "text-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["text-opacity"]),
    "text-occlusion-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["text-occlusion-opacity"]),
    "text-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-color"], { runtimeType: ColorType, getOverride: (o) => o.textColor, hasOverride: (o) => !!o.textColor }),
    "text-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-color"]),
    "text-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-width"]),
    "text-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-blur"]),
    "text-translate": new DataConstantProperty(styleSpec["paint_symbol"]["text-translate"]),
    "text-translate-anchor": new DataConstantProperty(styleSpec["paint_symbol"]["text-translate-anchor"]),
    "icon-color-saturation": new DataConstantProperty(styleSpec["paint_symbol"]["icon-color-saturation"]),
    "icon-color-contrast": new DataConstantProperty(styleSpec["paint_symbol"]["icon-color-contrast"]),
    "icon-color-brightness-min": new DataConstantProperty(styleSpec["paint_symbol"]["icon-color-brightness-min"]),
    "icon-color-brightness-max": new DataConstantProperty(styleSpec["paint_symbol"]["icon-color-brightness-max"]),
    "symbol-z-offset": new DataDrivenProperty(styleSpec["paint_symbol"]["symbol-z-offset"]),
    "icon-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "icon-halo-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "text-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "text-halo-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));
