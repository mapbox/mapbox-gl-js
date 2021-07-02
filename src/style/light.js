// @flow

import styleSpec from '../style-spec/reference/latest.js';

import {endsWith, extend, degToRad} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {
    validateStyle,
    validateLight,
    emitValidationErrors
} from './validate_style.js';
import Color from '../style-spec/util/color.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';

import type {StylePropertySpecification} from '../style-spec/style-spec.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {StyleSetterOptions} from '../style/style.js';
import type {
    Property,
    PropertyValue,
    TransitionParameters
} from './properties.js';

import type {LightSpecification} from '../style-spec/types.js';

export type LightPosition = {
    x: number,
    y: number,
    z: number,
    azimuthal: number,
    polar: number,
};

/**
 * Converts spherical coordinates to cartesian LightPosition coordinates.
 *
 * @private
 * @param spherical Spherical coordinates, in [radial, azimuthal, polar]
 * @return LightPosition cartesian coordinates
 */
export function sphericalToCartesian([r, azimuthal, polar]: [number, number, number]): LightPosition {
    // We abstract "north"/"up" (compass-wise) to be 0° when really this is 90° (π/2):
    // correct for that here
    const a = degToRad(azimuthal + 90), p = degToRad(polar);

    return {
        x: r * Math.cos(a) * Math.sin(p),
        y: r * Math.sin(a) * Math.sin(p),
        z: r * Math.cos(p),
        azimuthal, polar
    };
}

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
            x: interpolate(a.x, b.x, t),
            y: interpolate(a.y, b.y, t),
            z: interpolate(a.z, b.z, t),
            azimuthal: interpolate(a.azimuthal, b.azimuthal, t),
            polar: interpolate(a.polar, b.polar, t),
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

    setLight(light?: LightSpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }

        for (const name in light) {
            const value = light[name];
            if (endsWith(name, TRANSITION_SUFFIX)) {
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

    _validate(validate: Function, value: mixed, options?: {validate?: boolean}) {
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
