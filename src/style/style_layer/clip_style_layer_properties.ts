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
    "clip-layer-types": DataConstantProperty<Array<"model" | "symbol">>;
    "clip-layer-scope": DataConstantProperty<Array<string>>;
};
let layout: Properties<LayoutProps>;
export const getLayoutProperties = (): Properties<LayoutProps> => layout || (layout = new Properties({
    "clip-layer-types": new DataConstantProperty(styleSpec["layout_clip"]["clip-layer-types"]),
    "clip-layer-scope": new DataConstantProperty(styleSpec["layout_clip"]["clip-layer-scope"]),
}));

export type PaintProps = {};

let paint: Properties<PaintProps>;
export const getPaintProperties = (): Properties<PaintProps> => paint || (paint = new Properties({
}));
