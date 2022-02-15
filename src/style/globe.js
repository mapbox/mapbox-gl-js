// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import Color from '../style-spec/util/color.js';
import type {GlobeSpecification} from '../style-spec/types.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters} from './properties.js';
import type LngLat from '../geo/lng_lat.js';
import type Transform from '../geo/transform.js';
import type {StyleSetterOptions} from '../style/style.js';
import type {FogState} from './fog_helpers.js';

type Props = {|
    "gradient-color": DataConstantProperty<Color>,
    "gradient-background-color": DataConstantProperty<Color>,
    "gradient-space-color": DataConstantProperty<Color>,
    "gradient-outer-radius": DataConstantProperty<number>,
    "gradient-inner-radius": DataConstantProperty<number>
|};

const globeProperties: Properties<Props> = new Properties({
    "gradient-color": new DataConstantProperty(styleSpec.globe["gradient-color"]),
    "gradient-background-color": new DataConstantProperty(styleSpec.globe["gradient-background-color"]),
    "gradient-space-color": new DataConstantProperty(styleSpec.globe["gradient-space-color"]),
    "gradient-outer-radius": new DataConstantProperty(styleSpec.globe["gradient-outer-radius"]),
    "gradient-inner-radius": new DataConstantProperty(styleSpec.globe["gradient-inner-radius"])
});

const TRANSITION_SUFFIX = '-transition';

class Globe extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(globeOptions?: GlobeSpecification) {
        super();
        this._transitionable = new Transitionable(globeProperties);
        this.set(globeOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    get() {
        return this._transitionable.serialize();
    }

    set(globe: GlobeSpecification) {
        for (const name in globe) {
            const value = globe[name];
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
}

export default Globe;
