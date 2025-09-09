// This file is generated. Edit build/generate-style-code.ts, then run `npm run codegen`.
/* eslint-disable */

import styleSpec from '../../src/style-spec/reference/latest';

import {
    Properties,
    DataDrivenProperty
} from '../../src/style/properties';
import type ResolvedImage from '../style-spec/expression/types/resolved_image';

export type AppearanceProps = {
    "icon-size": DataDrivenProperty<number>;
    "icon-image": DataDrivenProperty<ResolvedImage>;
    "icon-rotate": DataDrivenProperty<number>;
    "icon-offset": DataDrivenProperty<[number, number]>;
};

let properties: Properties<AppearanceProps>;
export const getAppearanceProperties = (): Properties<AppearanceProps> => properties || (properties = new Properties({
    "icon-size": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-size"]),
    "icon-image": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-image"]),
    "icon-rotate": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-rotate"]),
    "icon-offset": new DataDrivenProperty(styleSpec["layout_symbol"]["icon-offset"]),
}));
