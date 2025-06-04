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
    "fill-extrusion-edge-radius": DataConstantProperty<number>;
};
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_fill-extrusion"]["visibility"]),
    "fill-extrusion-edge-radius": new DataConstantProperty(styleSpec["layout_fill-extrusion"]["fill-extrusion-edge-radius"]),
}));

export type PaintProps = {
    "fill-extrusion-opacity": DataConstantProperty<number>;
    "fill-extrusion-color": DataDrivenProperty<Color>;
    "fill-extrusion-translate": DataConstantProperty<[number, number]>;
    "fill-extrusion-translate-anchor": DataConstantProperty<"map" | "viewport">;
    "fill-extrusion-pattern": DataDrivenProperty<ResolvedImage | null | undefined>;
    "fill-extrusion-pattern-cross-fade": DataConstantProperty<number>;
    "fill-extrusion-height": DataDrivenProperty<number>;
    "fill-extrusion-base": DataDrivenProperty<number>;
    "fill-extrusion-height-alignment": DataConstantProperty<"terrain" | "flat">;
    "fill-extrusion-base-alignment": DataConstantProperty<"terrain" | "flat">;
    "fill-extrusion-vertical-gradient": DataConstantProperty<boolean>;
    "fill-extrusion-ambient-occlusion-intensity": DataConstantProperty<number>;
    "fill-extrusion-ambient-occlusion-radius": DataConstantProperty<number>;
    "fill-extrusion-ambient-occlusion-wall-radius": DataConstantProperty<number>;
    "fill-extrusion-ambient-occlusion-ground-radius": DataConstantProperty<number>;
    "fill-extrusion-ambient-occlusion-ground-attenuation": DataConstantProperty<number>;
    "fill-extrusion-flood-light-color": DataConstantProperty<Color>;
    "fill-extrusion-flood-light-intensity": DataConstantProperty<number>;
    "fill-extrusion-flood-light-wall-radius": DataDrivenProperty<number>;
    "fill-extrusion-flood-light-ground-radius": DataDrivenProperty<number>;
    "fill-extrusion-flood-light-ground-attenuation": DataConstantProperty<number>;
    "fill-extrusion-vertical-scale": DataConstantProperty<number>;
    "fill-extrusion-rounded-roof": DataConstantProperty<boolean>;
    "fill-extrusion-cutoff-fade-range": DataConstantProperty<number>;
    "fill-extrusion-emissive-strength": DataDrivenProperty<number>;
    "fill-extrusion-line-width": DataDrivenProperty<number>;
    "fill-extrusion-cast-shadows": DataConstantProperty<boolean>;
    "fill-extrusion-color-use-theme": DataDrivenProperty<string>;
    "fill-extrusion-flood-light-color-use-theme": DataDrivenProperty<string>;
};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
    "fill-extrusion-opacity": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-opacity"]),
    "fill-extrusion-color": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-color"]),
    "fill-extrusion-translate": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate"]),
    "fill-extrusion-translate-anchor": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate-anchor"]),
    "fill-extrusion-pattern": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-pattern"]),
    "fill-extrusion-pattern-cross-fade": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-pattern-cross-fade"]),
    "fill-extrusion-height": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-height"]),
    "fill-extrusion-base": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-base"]),
    "fill-extrusion-height-alignment": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-height-alignment"]),
    "fill-extrusion-base-alignment": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-base-alignment"]),
    "fill-extrusion-vertical-gradient": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-vertical-gradient"]),
    "fill-extrusion-ambient-occlusion-intensity": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-ambient-occlusion-intensity"]),
    "fill-extrusion-ambient-occlusion-radius": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-ambient-occlusion-radius"]),
    "fill-extrusion-ambient-occlusion-wall-radius": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-ambient-occlusion-wall-radius"]),
    "fill-extrusion-ambient-occlusion-ground-radius": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-ambient-occlusion-ground-radius"]),
    "fill-extrusion-ambient-occlusion-ground-attenuation": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-ambient-occlusion-ground-attenuation"]),
    "fill-extrusion-flood-light-color": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-flood-light-color"]),
    "fill-extrusion-flood-light-intensity": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-flood-light-intensity"]),
    "fill-extrusion-flood-light-wall-radius": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-flood-light-wall-radius"]),
    "fill-extrusion-flood-light-ground-radius": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-flood-light-ground-radius"]),
    "fill-extrusion-flood-light-ground-attenuation": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-flood-light-ground-attenuation"]),
    "fill-extrusion-vertical-scale": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-vertical-scale"]),
    "fill-extrusion-rounded-roof": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-rounded-roof"]),
    "fill-extrusion-cutoff-fade-range": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-cutoff-fade-range"]),
    "fill-extrusion-emissive-strength": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-emissive-strength"]),
    "fill-extrusion-line-width": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-line-width"]),
    "fill-extrusion-cast-shadows": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-cast-shadows"]),
    "fill-extrusion-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
    "fill-extrusion-flood-light-color-use-theme": new DataDrivenProperty({"type":"string","default":"default","property-type":"data-driven"}),
}));
