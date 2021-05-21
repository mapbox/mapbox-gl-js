// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {validateStyle, validateAtmosphere, emitValidationErrors} from './validate_style.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import Color from '../style-spec/util/color.js';
import {FOG_PITCH_START, FOG_PITCH_END, getFogOpacityAtLngLat, getFovAdjustedFogRange} from './atmosphere_helpers.js';
import type {AtmosphereSpecification} from '../style-spec/types.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters} from './properties.js';
import type LngLat from '../geo/lng_lat.js';
import type Transform from '../geo/transform.js';
import type {FogState} from './atmosphere_helpers.js';

type Props = {|
    "fog-range": DataConstantProperty<[number, number]>,
    "fog-color": DataConstantProperty<Color>,
    "fog-horizon-blend": DataConstantProperty<number>,
|};

const atmosphereProperties: Properties<Props> = new Properties({
    "fog-range": new DataConstantProperty(styleSpec.atmosphere["fog-range"]),
    "fog-color": new DataConstantProperty(styleSpec.atmosphere["fog-color"]),
    "fog-horizon-blend": new DataConstantProperty(styleSpec.atmosphere["fog-horizon-blend"]),
});

const TRANSITION_SUFFIX = '-transition';

class Atmosphere extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(fogOptions?: AtmosphereSpecification) {
        super();
        this._transitionable = new Transitionable(atmosphereProperties);
        this.set(fogOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    get state(): FogState {
        return {
            range: this.properties.get('fog-range'),
            horizonBlend: this.properties.get('fog-horizon-blend'),
            alpha: this.properties.get('fog-color').a
        };
    }

    get() {
        return this._transitionable.serialize();
    }

    set(atmosphere?: AtmosphereSpecification) {
        if (this._validate(validateAtmosphere, atmosphere)) {
            return;
        }

        for (const name in atmosphere) {
            const value = atmosphere[name];
            if (endsWith(name, TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            } else {
                this._transitionable.setValue(name, value);
            }
        }
    }

    getFogOpacity(pitch: number): number {
        const fogColor = (this.properties && this.properties.get('fog-color')) || 1.0;
        const pitchFactor = smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        return pitchFactor * fogColor.a;
    }

    getFogOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        return getFogOpacityAtLngLat(this.state, lngLat, transform);
    }

    getFovAdjustedFogRange(fov: number): [number, number] {
        return getFovAdjustedFogRange(this.state, fov);
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
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }
}

export default Atmosphere;
