// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import LngLat from '../geo/lng_lat.js';
import {vec3} from 'gl-matrix';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style.js';
import type EvaluationParameters from './evaluation_parameters.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import type {TransitionParameters} from './properties.js';
import type {FogSpecification} from '../style-spec/types.js';
import MercatorCoordinate from '../geo/mercator_coordinate.js';
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

    // As defined in _prelude_fog.fragment.glsl#fog_opacity
    getFogOpacity(depth: number, pitch: number): number {
        const maxOpacity = this.opacity * smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        const start = this.range[0];
        const end = this.range[1];
        const falloff = Math.exp(-FOG_EXP_FACTOR * (depth - start) / (end - start));
        const fogOpacity = Math.pow(Math.max((1 - falloff) * maxOpacity, 0), FOG_POWER_FACTOR);

        return Math.min(1.0, fogOpacity * 1.02);
    }

    getOpacityAtTileCoord(x: number, y: number, z: number, tileId: UnwrappedTileID, transform: Transform): number {
        const mat = transform.calculateCameraMatrix(tileId);
        const pos = [x, y ,z];
        vec3.transformMat4(pos, pos, mat);
        const depth = vec3.length(pos);

        return this.getFogOpacity(depth, transform.pitch);
    }

    getFogOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        const meters = MercatorCoordinate.fromLngLat(lngLat);
        const elevation = transform.elevation ? transform.elevation.getAtPoint(meters) : 0;
        const cameraPos = transform._camera.position;
        const pos = [meters.x - cameraPos[0], meters.y - cameraPos[1], elevation - cameraPos[2]];

        // Transform to pixel coordinate
        pos[0] *= transform.cameraWorldSize;
        pos[1] *= transform.cameraWorldSize;
        pos[2] *= transform.cameraPixelsPerMeter;

        const depth = vec3.length(pos);

        return this.getFogOpacity(depth, transform.pitch);
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

    updateTransitions(parameters: TransitionParameters) {
        this._transitioning = this._transitionable.transitioned(parameters, this._transitioning);
    }

    hasTransition() {
        return this._transitioning.hasTransition();
    }

    getSampler(): FogSampler {
        return new FogSampler(this._transitionable.getValue('range'), this._transitionable.getValue('opacity'));
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
