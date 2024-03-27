// This file is generated. Edit build/generate-style-code.js, then run `npm run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    ColorRampProperty
} from '../properties.js';

import type Color from '../../style-spec/util/color.js';

import type Formatted from '../../style-spec/expression/types/formatted.js';

import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

export type LayoutProps = {|
    "visibility": DataConstantProperty<"visible" | "none">,
    "fill-extrusion-edge-radius": DataConstantProperty<number>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "visibility": new DataConstantProperty(styleSpec["layout_fill-extrusion"]["visibility"]),
    "fill-extrusion-edge-radius": new DataConstantProperty(styleSpec["layout_fill-extrusion"]["fill-extrusion-edge-radius"]),
});

export type PaintProps = {|
    "fill-extrusion-opacity": DataConstantProperty<number>,
    "fill-extrusion-color": DataDrivenProperty<Color>,
    "fill-extrusion-translate": DataConstantProperty<[number, number]>,
    "fill-extrusion-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "fill-extrusion-pattern": DataDrivenProperty<?ResolvedImage>,
    "fill-extrusion-height": DataDrivenProperty<number>,
    "fill-extrusion-base": DataDrivenProperty<number>,
    "fill-extrusion-vertical-gradient": DataConstantProperty<boolean>,
    "fill-extrusion-ambient-occlusion-intensity": DataConstantProperty<number>,
    "fill-extrusion-ambient-occlusion-radius": DataConstantProperty<number>,
    "fill-extrusion-ambient-occlusion-wall-radius": DataConstantProperty<number>,
    "fill-extrusion-ambient-occlusion-ground-radius": DataConstantProperty<number>,
    "fill-extrusion-ambient-occlusion-ground-attenuation": DataConstantProperty<number>,
    "fill-extrusion-flood-light-color": DataConstantProperty<Color>,
    "fill-extrusion-flood-light-intensity": DataConstantProperty<number>,
    "fill-extrusion-flood-light-wall-radius": DataDrivenProperty<number>,
    "fill-extrusion-flood-light-ground-radius": DataDrivenProperty<number>,
    "fill-extrusion-flood-light-ground-attenuation": DataConstantProperty<number>,
    "fill-extrusion-vertical-scale": DataConstantProperty<number>,
    "fill-extrusion-rounded-roof": DataConstantProperty<boolean>,
    "fill-extrusion-cutoff-fade-range": DataConstantProperty<number>,
    "fill-extrusion-emissive-strength": DataConstantProperty<number>,
|};

const paint: Properties<PaintProps> = new Properties({
    "fill-extrusion-opacity": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-opacity"]),
    "fill-extrusion-color": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-color"]),
    "fill-extrusion-translate": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate"]),
    "fill-extrusion-translate-anchor": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-translate-anchor"]),
    "fill-extrusion-pattern": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-pattern"]),
    "fill-extrusion-height": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-height"]),
    "fill-extrusion-base": new DataDrivenProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-base"]),
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
    "fill-extrusion-emissive-strength": new DataConstantProperty(styleSpec["paint_fill-extrusion"]["fill-extrusion-emissive-strength"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
