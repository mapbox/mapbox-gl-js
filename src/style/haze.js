// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {validateStyle, validateHaze, emitValidationErrors} from './validate_style.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import Color from '../style-spec/util/color.js';
//import {FOG_PITCH_START, FOG_PITCH_END} from './haze_helpers.js';
import type {HazeSpecification} from '../style-spec/types.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters} from './properties.js';
import type LngLat from '../geo/lng_lat.js';
import type Transform from '../geo/transform.js';
import type {HazeState} from './haze_helpers.js';

type Props = {|
    "range": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>
|};

const hazeProperties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.haze.range),
    "color": new DataConstantProperty(styleSpec.haze.color),
});

const TRANSITION_SUFFIX = '-transition';

class Haze extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(hazeOptions?: HazeSpecification) {
        super();
        this._transitionable = new Transitionable(hazeProperties);
        this.set(hazeOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    get state(): HazeState {
        return {
            range: this.properties.get('range'),
            horizonBlend: this.properties.get('horizon-blend')
        };
    }

    get() {
        return this._transitionable.serialize();
    }

    set(haze?: HazeSpecification) {
        if (this._validate(validateHaze, haze)) {
            return;
        }

        for (const name in haze) {
            const value = haze[name];
            if (endsWith(name, TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            } else {
                this._transitionable.setValue(name, value);
            }
        }
    }

    /*
    getFogPitchFactor(pitch: number): number {
        return smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
    }

    getOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        return getFogOpacityAtLatLng(this.state, lngLat, transform);
    }
    */

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
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }
}

export default Haze;
