// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest';

import {
    Properties,
    DataDrivenProperty
} from '../../src/style/properties';

import {
    ColorType} from '../style-spec/expression/types';

import type Color from '../style-spec/util/color';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';

export type AppearanceLayoutProps = {
    "icon-size": DataDrivenProperty<number>;
    "icon-image": DataDrivenProperty<ResolvedImage>;
    "icon-rotate": DataDrivenProperty<number>;
    "icon-offset": DataDrivenProperty<[number, number]>;
    "text-size": DataDrivenProperty<number>;
    "text-rotate": DataDrivenProperty<number>;
    "text-offset": DataDrivenProperty<[number, number]>;
};

let layoutPropertiesInstance: Properties<AppearanceLayoutProps>;
export const getAppearanceLayoutProperties = (): Properties<AppearanceLayoutProps> => layoutPropertiesInstance || (layoutPropertiesInstance = new Properties({
    "icon-size": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-size"]),
    "icon-image": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-image"]),
    "icon-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-rotate"]),
    "icon-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-offset"]),
    "text-size": new DataDrivenProperty(styleSpec["layout_symbol"]["text-size"]),
    "text-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["text-rotate"]),
    "text-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["text-offset"]),
}));

export type AppearancePaintProps = {
    "icon-opacity": DataDrivenProperty<number>;
    "icon-occlusion-opacity": DataDrivenProperty<number>;
    "icon-emissive-strength": DataDrivenProperty<number>;
    "text-emissive-strength": DataDrivenProperty<number>;
    "icon-color": DataDrivenProperty<Color>;
    "icon-halo-color": DataDrivenProperty<Color>;
    "icon-halo-width": DataDrivenProperty<number>;
    "icon-halo-blur": DataDrivenProperty<number>;
    "icon-translate": DataDrivenProperty<[number, number]>;
    "text-opacity": DataDrivenProperty<number>;
    "text-occlusion-opacity": DataDrivenProperty<number>;
    "text-color": DataDrivenProperty<Color>;
    "text-halo-color": DataDrivenProperty<Color>;
    "text-halo-width": DataDrivenProperty<number>;
    "text-halo-blur": DataDrivenProperty<number>;
    "text-translate": DataDrivenProperty<[number, number]>;
    "symbol-z-offset": DataDrivenProperty<number>;
    "icon-color-use-theme": DataDrivenProperty<string>;
    "icon-halo-color-use-theme": DataDrivenProperty<string>;
    "text-color-use-theme": DataDrivenProperty<string>;
    "text-halo-color-use-theme": DataDrivenProperty<string>;
};

let paintPropertiesInstance: Properties<AppearancePaintProps>;
export const getAppearancePaintProperties = (): Properties<AppearancePaintProps> => paintPropertiesInstance || (paintPropertiesInstance = new Properties({
    "icon-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-opacity"]),
    "icon-occlusion-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-occlusion-opacity"]),
    "icon-emissive-strength": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-emissive-strength"]),
    "text-emissive-strength": new DataDrivenProperty(styleSpec["paint_symbol"]["text-emissive-strength"]),
    "icon-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-color"]),
    "icon-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-color"]),
    "icon-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-width"]),
    "icon-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-halo-blur"]),
    "icon-translate": new DataDrivenProperty(styleSpec["paint_symbol"]["icon-translate"]),
    "text-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["text-opacity"]),
    "text-occlusion-opacity": new DataDrivenProperty(styleSpec["paint_symbol"]["text-occlusion-opacity"]),
    "text-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-color"], { runtimeType: ColorType, getOverride: (o: Record<string, unknown>) => o.textColor, hasOverride: (o: Record<string, unknown>) => !!o.textColor }),
    "text-halo-color": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-color"]),
    "text-halo-width": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-width"]),
    "text-halo-blur": new DataDrivenProperty(styleSpec["paint_symbol"]["text-halo-blur"]),
    "text-translate": new DataDrivenProperty(styleSpec["paint_symbol"]["text-translate"]),
    "symbol-z-offset": new DataDrivenProperty(styleSpec["paint_symbol"]["symbol-z-offset"]),
    "icon-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "icon-halo-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "text-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "text-halo-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));

// Backwards-compatible aliases (layout-only, as before)
export type AppearanceProps = AppearanceLayoutProps;
export const getAppearanceProperties = getAppearanceLayoutProperties;
