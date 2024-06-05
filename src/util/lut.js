// @flow

import {
    DataConstantProperty,
    Properties,
    PossiblyEvaluated,
    Transitionable
} from "../style/properties.js";
import {extend} from './util.js';
import type {RGBAImage} from "./image";
import {Texture3D} from '../../src/render/texture.js';
import type {ColorThemeSpecification} from "../style-spec/types";
import styleSpec from '../style-spec/reference/latest.js';
import EvaluationParameters from '../../src/style/evaluation_parameters.js';
import type {ConfigOptions} from '../../src/style/properties.js';

export type LUT = {
    image: RGBAImage;
    texture?: Texture3D;
}

type Props = {|
    "data": DataConstantProperty<string>
|};

const colorizationProperties: Properties<Props> = new Properties({
    "data": new DataConstantProperty(styleSpec.colorTheme.data)
});

export function evaluateColorThemeProperties(scope: string, values?: ColorThemeSpecification, configOptions?: ?ConfigOptions): PossiblyEvaluated<Props>  {
    const properties = extend({}, values);
    for (const name of Object.keys(styleSpec.colorTheme)) {
        // Fallback to use default style specification when the properties wasn't set
        if (properties[name] === undefined) {
            properties[name] = styleSpec.colorTheme[name].default;
        }
    }

    const transitionable = new Transitionable(colorizationProperties, scope, new Map(configOptions));
    transitionable.setTransitionOrValue<ColorThemeSpecification>(properties, configOptions);
    const transitioning = transitionable.untransitioned();
    return transitioning.possiblyEvaluate(new EvaluationParameters(0.0));
}
