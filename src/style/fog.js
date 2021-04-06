// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {endsWith, extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import LngLat from '../geo/lng_lat.js';
import {vec3} from 'gl-matrix';
import {UnwrappedTileID} from '../source/tile_id.js';
import type Transform from '../geo/transform.js';
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
    "haze-color": DataConstantProperty<Color>,
    "haze-energy": DataConstantProperty<number>,
    "strength": DataConstantProperty<number>,
    "sky-blend": DataConstantProperty<number>,
|};

const properties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.fog.range),
    "color": new DataConstantProperty(styleSpec.fog.color),
    "haze-color": new DataConstantProperty(styleSpec.fog["haze-color"]),
    "haze-energy": new DataConstantProperty(styleSpec.fog["strength"]),
    "strength": new DataConstantProperty(styleSpec.fog["haze-energy"]),
    "sky-blend": new DataConstantProperty(styleSpec.fog["sky-blend"]),
});

const TRANSITION_SUFFIX = '-transition';

export const FOG_PITCH_START = 55;
export const FOG_PITCH_END = 65;

export class FogSampler {
    properties: ?PossiblyEvaluated<Props>;

    // As defined in _prelude_fog.fragment.glsl#fog_opacity
    getFogOpacity(depth: number, pitch: number): number {
        if (!this.properties) { return 0.0; }

        const props = this.properties;
        const range = props.get('range');
        const fogOpacity = smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        const fogStrength = props.get('strength');
        const [start, end] = range;

        // The fog is not physically accurate, so we seek an expression which satisfies a
        // couple basic constraints:
        //   - opacity should be 0 at the near limit
        //   - opacity should be 1 at the far limit
        //   - the onset should have smooth derivatives to avoid a sharp band
        // To this end, we use an (1 - e^x)^n, where n is set to 3 to ensure the
        // function is C2 continuous at the onset. The fog is about 99% opaque at
        // the far limit, so we simply scale it and clip to achieve 100% opacity.
        // https://www.desmos.com/calculator/3taufutxid
        // The output of this function should match src/shaders/_prelude_fog.fragment.glsl
        const decay = 6;
        const t = (depth - start) / (end - start);
        let falloff = 1.0 - Math.min(1, Math.exp(-decay * t));

        // Cube without pow()
        falloff *= falloff * falloff;

        // Scale and clip to 1 at the far limit
        falloff = Math.min(1.0, 1.00747 * falloff);

        // From src/render/painter.js via fog uniforms:
        const fogExponent = 12 * Math.pow(1 - fogStrength, 2);

        // Account for fog strength
        falloff *= Math.pow(smoothstep(0, 1, t), fogExponent);

        // We may wish to account for haze's effect on obscuring symbols

        return falloff * fogOpacity;
    }

    getOpacityAtTileCoord(x: number, y: number, z: number, tileId: UnwrappedTileID, transform: Transform): number {
        const mat = transform.calculateCameraMatrix(tileId);
        const pos = [x, y, z];
        vec3.transformMat4(pos, pos, mat);
        const depth = vec3.length(pos);

        return this.getFogOpacity(depth, transform.pitch);
    }

    getFogOpacityAtLatLng(lngLat: LngLat, transform: Transform): number {
        const meters = MercatorCoordinate.fromLngLat(lngLat);
        const elevation = transform.elevation ? transform.elevation.getAtPoint(meters) : 0;
        const pos = [meters.x, meters.y, elevation];
        vec3.transformMat4(pos, pos, transform.mercatorFogMatrix);
        const depth = vec3.length(pos);

        return this.getFogOpacity(depth, transform.pitch);
    }
}

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    sampler: FogSampler;

    constructor(fogOptions?: FogSpecification) {
        super();
        this._transitionable = new Transitionable(properties);
        this.set(fogOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.sampler = new FogSampler();
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

    recalculate(parameters: EvaluationParameters) {
        this.properties = this.sampler.properties = this._transitioning.possiblyEvaluate(parameters);
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
