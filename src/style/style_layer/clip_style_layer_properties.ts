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
};

const layout: Properties<LayoutProps> = new Properties({
    "clip-layer-types": new DataConstantProperty(styleSpec["layout_clip"]["clip-layer-types"]),
});

export type PaintProps = {};

const paint: Properties<PaintProps> = new Properties({
});

export default { paint, layout };
