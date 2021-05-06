// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import Color from '../style-spec/util/color.js';
import {FOG_PITCH_START, FOG_PITCH_END, getFogOpacityAtLngLat, getFovAdjustedFogRange} from './fog_helpers.js';
import type {FogSpecification} from '../style-spec/types.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters} from './properties.js';
import type LngLat from '../geo/lng_lat.js';
import type Transform from '../geo/transform.js';
import type {FogState} from './fog_helpers.js';

type Props = {|
    "range": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>,
    "horizon-blend": DataConstantProperty<number>,
|};

const fogProperties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.fog.range),
    "color": new DataConstantProperty(styleSpec.fog.color),
    "horizon-blend": new DataConstantProperty(styleSpec.fog["horizon-blend"]),
});

const TRANSITION_SUFFIX = '-transition';

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(fogOptions?: FogSpecification) {
        super();
        this._transitionable = new Transitionable(fogProperties);
        this.set(fogOptions);
        this._transitioning = this._transitionable.untransitioned();
    }

    get state(): FogState {
        return {
            range: this.properties.get('range'),
            horizonBlend: this.properties.get('horizon-blend'),
            alpha: this.properties.get('color').a
        };
    }

    get() {
        return this._transitionable.serialize();
    }

    set(fog?: FogSpecification) {
        if (this._validate(validateFog, fog)) {
            return;
        }

        for (const name in fog) {
            const value = fog[name];
            if (endsWith(name, TRANSITION_SUFFIX)) {
                this._transitionable.setTransition(name.slice(0, -TRANSITION_SUFFIX.length), value);
            } else {
                this._transitionable.setValue(name, value);
            }
        }
    }

    getOpacity(pitch: number): number {
        const fogColor = (this.properties && this.properties.get('color')) || 1.0;
        const pitchFactor = smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        return pitchFactor * fogColor.a;
    }

    getOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        return getFogOpacityAtLngLat(this.state, lngLat, transform);
    }

    getFovAdjustedRange(fov: number): [number, number] {
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

export default Fog;
