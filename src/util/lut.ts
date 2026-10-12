import {DataConstantProperty, PropertyValue} from '../style/properties';
import styleSpec from '../style-spec/reference/latest';
import EvaluationParameters from '../../src/style/evaluation_parameters';

import type {ConfigOptions} from '../style/properties';
import type {RGBAImage} from "./image";
import type {Texture3D} from '../../src/render/texture';
import type {ColorThemeSpecification} from "../style-spec/types";
import type {StylePropertySpecification} from '../style-spec/style-spec';

export type LUT = {
    image: RGBAImage;
    data?: string;
    texture?: Texture3D;
};

const colorThemeDataProperty = new DataConstantProperty<string>((styleSpec.colorTheme as Record<string, StylePropertySpecification>).data);

export function evaluateColorThemeData(scope: string, data: ColorThemeSpecification['data'], configOptions?: ConfigOptions | null): string {
    return new PropertyValue(colorThemeDataProperty, data, scope, configOptions).possiblyEvaluate(new EvaluationParameters(0));
}
