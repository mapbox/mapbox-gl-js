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
import type {StyleSetterOptions} from '../style/style.js';
import type {FogState} from './fog_helpers.js';
import {number as interpolate} from '../style-spec/util/interpolate.js';
import {globeToMercatorTransition} from '../geo/projection/globe_util.js';

type Props = {|
    "range": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>,
    "high-color": DataConstantProperty<Color>,
    "space-color": DataConstantProperty<Color>,
    "horizon-blend": DataConstantProperty<number>,
    "star-intensity": DataConstantProperty<number>,
|};

const fogProperties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.fog.range),
    "color": new DataConstantProperty(styleSpec.fog.color),
    "high-color": new DataConstantProperty(styleSpec.fog["high-color"]),
    "space-color": new DataConstantProperty(styleSpec.fog["space-color"]),
    "horizon-blend": new DataConstantProperty(styleSpec.fog["horizon-blend"]),
    "star-intensity": new DataConstantProperty(styleSpec.fog["star-intensity"]),
});

const TRANSITION_SUFFIX = '-transition';

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    // Alternate projections do not yet support fog.
    // Hold on to transform so that we know whether a projection is set.
    _transform: Transform;

    constructor(fogOptions?: FogSpecification, transform: Transform) {
        super();
        this._transitionable = new Transitionable(fogProperties);
        this.set(fogOptions);
        this._transitioning = this._transitionable.untransitioned();
        this._transform = transform;
    }

    get state(): FogState {
        const tr = this._transform;
        const isGlobe = tr.projection.name === 'globe';
        const transitionT = globeToMercatorTransition(tr.zoom);
        const range = this.properties.get('range');
        const globeFixedFogRange = [0.5, 3];
        return {
            range: isGlobe ? [
                interpolate(globeFixedFogRange[0], range[0], transitionT),
                interpolate(globeFixedFogRange[1], range[1], transitionT)
            ] : range,
            horizonBlend: this.properties.get('horizon-blend'),
            alpha: this.properties.get('color').a
        };
    }

    get(): FogSpecification {
        return (this._transitionable.serialize(): any);
    }

    set(fog?: FogSpecification, options: StyleSetterOptions = {}) {
        if (this._validate(validateFog, fog, options)) {
            return;
        }

        for (const name of Object.keys(styleSpec.fog)) {
            // Fallback to use default style specification when the properties wasn't set
            if (fog && fog[name] === undefined) {
                fog[name] = styleSpec.fog[name].default;
            }
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
        if (!this._transform.projection.supportsFog) return 0;

        const fogColor = (this.properties && this.properties.get('color')) || 1.0;
        const isGlobe = this._transform.projection.name === 'globe';
        const pitchFactor = isGlobe ? 1.0 : smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        return pitchFactor * fogColor.a;
    }

    getOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        if (!this._transform.projection.supportsFog) return 0;

        return getFogOpacityAtLngLat(this.state, lngLat, transform);
    }

    getFovAdjustedRange(fov: number): [number, number] {
        // We can return any arbitrary range because we expect opacity=0 to clean it up
        if (!this._transform.projection.supportsFog) return [0, 1];

        return getFovAdjustedFogRange(this.state, fov);
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
            style: {glyphs: true, sprite: true},
            styleSpec
        })));
    }
}

export default Fog;
