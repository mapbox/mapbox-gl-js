// This file is generated. Edit build/generate-style-code.js, then run `yarn run codegen`.
// @flow
/* eslint-disable */

import styleSpec from '../../style-spec/reference/latest.js';

import {
    Properties,
    DataConstantProperty,
    DataDrivenProperty,
    CrossFadedDataDrivenProperty,
    CrossFadedProperty,
    ColorRampProperty
} from '../properties.js';

import type Color from '../../style-spec/util/color.js';

import type Formatted from '../../style-spec/expression/types/formatted.js';

import type ResolvedImage from '../../style-spec/expression/types/resolved_image.js';

export type LayoutProps = {|
    "particle-sort-key": DataDrivenProperty<number>,
|};

const layout: Properties<LayoutProps> = new Properties({
    "particle-sort-key": new DataDrivenProperty(styleSpec["layout_particle"]["particle-sort-key"]),
});

export type PaintProps = {|
    "particle-radius": DataDrivenProperty<number>,
    "particle-color-start": DataDrivenProperty<Color>,
    "particle-color-end": DataDrivenProperty<Color>,
    "particle-emitter-elevation-min": DataDrivenProperty<number>,
    "particle-emitter-elevation-max": DataDrivenProperty<number>,
    "particle-emitter-offset-min": DataDrivenProperty<number>,
    "particle-emitter-offset-max": DataDrivenProperty<number>,
    "particle-blur": DataDrivenProperty<number>,
    "particle-opacity": DataDrivenProperty<number>,
    "particle-emitter-velocity-min": DataDrivenProperty<number>,
    "particle-emitter-velocity-max": DataDrivenProperty<number>,
    "particle-emitter-ttl-min": DataDrivenProperty<number>,
    "particle-emitter-ttl-max": DataDrivenProperty<number>,
    "particle-translate": DataConstantProperty<[number, number]>,
    "particle-emitter-direction": DataConstantProperty<[number, number, number]>,
    "particle-translate-anchor": DataConstantProperty<"map" | "viewport">,
    "particle-emitter-type": DataConstantProperty<"cloud" | "gradient">,
|};

const paint: Properties<PaintProps> = new Properties({
    "particle-radius": new DataDrivenProperty(styleSpec["paint_particle"]["particle-radius"]),
    "particle-color-start": new DataDrivenProperty(styleSpec["paint_particle"]["particle-color-start"]),
    "particle-color-end": new DataDrivenProperty(styleSpec["paint_particle"]["particle-color-end"]),
    "particle-emitter-elevation-min": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-elevation-min"]),
    "particle-emitter-elevation-max": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-elevation-max"]),
    "particle-emitter-offset-min": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-offset-min"]),
    "particle-emitter-offset-max": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-offset-max"]),
    "particle-blur": new DataDrivenProperty(styleSpec["paint_particle"]["particle-blur"]),
    "particle-opacity": new DataDrivenProperty(styleSpec["paint_particle"]["particle-opacity"]),
    "particle-emitter-velocity-min": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-velocity-min"]),
    "particle-emitter-velocity-max": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-velocity-max"]),
    "particle-emitter-ttl-min": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-ttl-min"]),
    "particle-emitter-ttl-max": new DataDrivenProperty(styleSpec["paint_particle"]["particle-emitter-ttl-max"]),
    "particle-translate": new DataConstantProperty(styleSpec["paint_particle"]["particle-translate"]),
    "particle-emitter-direction": new DataConstantProperty(styleSpec["paint_particle"]["particle-emitter-direction"]),
    "particle-translate-anchor": new DataConstantProperty(styleSpec["paint_particle"]["particle-translate-anchor"]),
    "particle-emitter-type": new DataConstantProperty(styleSpec["paint_particle"]["particle-emitter-type"]),
});

// Note: without adding the explicit type annotation, Flow infers weaker types
// for these objects from their use in the constructor to StyleLayer, as
// {layout?: Properties<...>, paint: Properties<...>}
export default ({ paint, layout }: $Exact<{
  paint: Properties<PaintProps>, layout: Properties<LayoutProps>
}>);
