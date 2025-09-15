import styleSpec from '../style-spec/reference/latest';
import {Evented} from '../util/evented';
import {
    validateStyle,
    validateLight,
    emitValidationErrors
} from './validate_style';
import {
    Properties,
    Transitionable,
    DataConstantProperty,
    PositionProperty
} from './properties';

import type {Validator} from './validate_style';
import type Color from '../style-spec/util/color';
import type EvaluationParameters from './evaluation_parameters';
import type {StyleSetterOptions} from '../style/style';
import type {TransitionParameters,
    Transitioning,
    PossiblyEvaluated} from './properties';
import type {LightSpecification} from '../style-spec/types';
import type {StylePropertySpecification} from '../style-spec/style-spec';

type Props = {
    ["anchor"]: DataConstantProperty<'map' | 'viewport'>;
    ["position"]: PositionProperty;
    ["color"]: DataConstantProperty<Color>;
    ["intensity"]: DataConstantProperty<number>;
};

const lightReference = styleSpec.light as Record<string, StylePropertySpecification>;

let properties: Properties<Props>;
const getProperties = (): Properties<Props> => properties || (properties = new Properties({
    "anchor": new DataConstantProperty(lightReference.anchor),
    "position": new PositionProperty(lightReference.position),
    "color": new DataConstantProperty(lightReference.color),
    "intensity": new DataConstantProperty(lightReference.intensity),
}));

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
        this._transitionable = new Transitionable(getProperties());
        this.setLight(lightOptions, id);
        this._transitioning = this._transitionable.untransitioned();
    }

    getLight(): LightSpecification {
        return this._transitionable.serialize() as LightSpecification;
    }

    setLight(light: LightSpecification | null | undefined, id: string, options: StyleSetterOptions = {}) {
        if (this._validate(validateLight, light, options)) {
            return;
        }
        this._transitionable.setTransitionOrValue(light);
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

    _validate(
        validate: Validator,
        value: unknown,
        options?: {
            validate?: boolean;
        },
    ): boolean {
        if (options && options.validate === false) {
            return false;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return emitValidationErrors(this, validate.call(validateStyle, Object.assign({
            value,
            // Workaround for https://github.com/mapbox/mapbox-gl-js/issues/2407
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }
}

export default Light;
