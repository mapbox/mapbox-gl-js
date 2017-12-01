// @flow

const styleSpec = require('../style-spec/reference/latest');
const util = require('../util/util');
const Evented = require('../util/evented');
const validateStyle = require('./validate_style');
const {sphericalToCartesian} = require('../util/util');
const Color = require('../style-spec/util/color');
const interpolate = require('../style-spec/util/interpolate');

import type {StylePropertySpecification} from '../style-spec/style-spec';
import type EvaluationParameters from './evaluation_parameters';

const {
    Properties,
    Transitionable,
    Transitioning,
    PossiblyEvaluated,
    DataConstantProperty
} = require('./properties');

import type {
    Property,
    PropertyValue,
    TransitionParameters
} from './properties';

type LightPosition = {
    x: number,
    y: number,
    z: number
};

class LightPositionProperty implements Property<[number, number, number], LightPosition> {
    specification: StylePropertySpecification;

    constructor() {
        this.specification = styleSpec.light.position;
    }

    possiblyEvaluate(value: PropertyValue<[number, number, number], LightPosition>, parameters: EvaluationParameters): LightPosition {
        return sphericalToCartesian(value.expression.evaluate(parameters));
    }

    interpolate(a: LightPosition, b: LightPosition, t: number): LightPosition {
        return {
            x: interpolate.number(a.x, b.x, t),
            y: interpolate.number(a.y, b.y, t),
            z: interpolate.number(a.z, b.z, t),
        };
    }
}

type Props = {|
    "anchor": DataConstantProperty<"map" | "viewport">,
    "position": LightPositionProperty,
    "color": DataConstantProperty<Color>,
    "intensity": DataConstantProperty<number>,
|};

const properties: Properties<Props> = new Properties({
    "anchor": new DataConstantProperty(styleSpec.light.anchor),
    "position": new LightPositionProperty(),
    "color": new DataConstantProperty(styleSpec.light.color),
    "intensity": new DataConstantProperty(styleSpec.light.intensity),
});

const TRANSITION_SUFFIX = '-transition';

/*
 * Represents the light used to light extruded features.
 */
class Light extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(lightOptions?: LightSpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.setLight(lightOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    getLight() {
        return this._transitionable.serialize();
    }

    setLight(options?: LightSpecification) {
        if (this._validate(validateStyle.light, options)) {
            return;
        }

        for (const name in options) {
            const value = options[name];
            if (util.endsWith(name, TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            } else {
                this._transitionable.setValue(name, value);
            }
        }
    }

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition() {
        return this._transitioning.hasTransition();
    }

    recalculate(parameters: EvaluationParameters) {
        this.properties = this._transitioning.possiblyEvaluate(parameters);
    }

    _validate(validate, value: mixed) {
        return validateStyle.emitErrors(this, validate.call(validateStyle, util.extend({
            value: value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec: styleSpec
        })));
    }
}

module.exports = Light;
