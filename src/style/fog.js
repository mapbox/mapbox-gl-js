// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';

import {vec3} from 'gl-matrix';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style.js';
import type EvaluationParameters from './evaluation_parameters.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import type {TransitionParameters} from './properties.js';
import type {FogSpecification} from '../style-spec/types.js';
import type {UnwrappedTileID} from '../source/tile_id';
import type Transform from '../geo/transform';
import Color from '../style-spec/util/color.js';


type Props = {|
    "range": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>,
    "opacity": DataConstantProperty<number>,
    "sky-blend": DataConstantProperty<number>,
|};

const properties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.fog.range),
    "color": new DataConstantProperty(styleSpec.fog.color),
    "opacity": new DataConstantProperty(styleSpec.fog.opacity),
    "sky-blend": new DataConstantProperty(styleSpec.fog["sky-blend"]),
});

const TRANSITION_SUFFIX = '-transition';

export const FOG_PITCH_START = 55;
export const FOG_PITCH_END = 65;

export const FOG_EXP_FACTOR = 5.5;
export const FOG_POWER_FACTOR = 2;

export class FogSampler {
    range: [number, number];
    opacity: number;

    constructor(range: [number, number], opacity: number) {
        this.range = range;
        this.opacity = opacity;
    }

    getOpacityAtTileCoord(x: number, y: number, z: number, tileId: UnwrappedTileID, transform: Transform): number {
        const mat = transform.calculateCameraMatrix(tileId);
        const pos = [x, y ,z];
        vec3.transformMat4(pos, pos, mat);
        const start = this.range[0];
        const end = this.range[1];
        const maxOpacity = this.opacity * smoothstep(FOG_PITCH_START, FOG_PITCH_END, transform.pitch);

        const depth = vec3.length(pos);
        const falloff = Math.exp(-FOG_EXP_FACTOR * (depth - start) / (end - start));
        const fogOpacity = Math.pow(Math.max((1 - falloff) * maxOpacity, 0 ), FOG_POWER_FACTOR);

        return Math.min(1.0, fogOpacity * 1.02);
    }
}

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;

    constructor(fogOptions?: FogSpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.set(fogOptions);
        this._transitioning = this._transitionable.untransitioned();
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

    getFogPitchFactor(pitch: number): number {
        return smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
    }

    getFogSampler(): FogSampler {
        return new FogSampler(this._transitionable.getValue('range'), this._transitionable.getValue('opacity'));
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
