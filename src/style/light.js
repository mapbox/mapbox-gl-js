// @flow

import styleSpec from '../style-spec/reference/latest.js';

import {extend} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {
    validateStyle,
    validateLight,
    emitValidationErrors
} from './validate_style.js';
import Color from '../style-spec/util/color.js';
import {
    Properties,
    Transitionable,
    Transitioning,
    PossiblyEvaluated,
    DataConstantProperty,
    PositionProperty
} from './properties.js';

import type EvaluationParameters from './evaluation_parameters.js';
import type {StyleSetterOptions} from '../style/style.js';
import type {TransitionParameters} from './properties.js';

import type {LightSpecification} from '../style-spec/types.js';

type Props = {|
    "anchor": DataConstantProperty<"map" | "viewport">,
    "position": PositionProperty,
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
|};

const properties: Properties<Props> = new Properties({
    "anchor": new DataConstantProperty(styleSpec.light.anchor),
    "position": new PositionProperty(styleSpec.light.position),
    "color": new DataConstantProperty(styleSpec.light.color),
    "intensity": new DataConstantProperty(styleSpec.light.intensity),
});

/*
 * Represents the light used to light extruded features.
 * Note that these lights are part of the legacy light API.
 */
class Light extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    id: string;

    constructor(lightOptions?: LightSpecification, id: string = "flat") {
        super();
        this._transitionable = new Transitionable(properties);
        this.setLight(lightOptions, id);
        this._transitioning = this._transitionable.untransitioned();
    }

    getLight(): LightSpecification {
        return (this._transitionable.serialize(): any);
    }

    setLight(light?: LightSpecification, id: string, options: StyleSetterOptions = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }
        this._transitionable.setTransitionOrValue<LightSpecification>(light);
        this.id = id;
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition(): boolean {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate: Function, value: mixed, options?: {validate?: boolean}): boolean {
        if (options && options.validate === false) {
            return false;
        }

        return emitValidationErrors(this, validate.call(validateStyle, extend({
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }
}

export default Light;
