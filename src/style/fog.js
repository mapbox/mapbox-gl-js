// @flow

import styleSpec from '../style-spec/reference/latest.js';
import {extend, smoothstep} from '../util/util.js';
import {Evented} from '../util/evented.js';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style.js';
import {Properties, Transitionable, Transitioning, PossiblyEvaluated, DataConstantProperty} from './properties.js';
import Color from '../style-spec/util/color.js';
import {FOG_PITCH_START, FOG_PITCH_END, FOG_OPACITY_THRESHOLD, getFogOpacityAtLngLat, getFogOpacityAtMercCoord, getFovAdjustedFogRange, getFogOpacityForBounds} from './fog_helpers.js';
import {number as interpolate, array as vecInterpolate} from '../style-spec/util/interpolate.js';
import {globeToMercatorTransition} from '../geo/projection/globe_util.js';
import {Frustum} from '../util/primitives.js';
import {OverscaledTileID} from '../source/tile_id.js';
import EXTENT from '../style-spec/data/extent.js';

import type {FogSpecification} from '../style-spec/types.js';
import type EvaluationParameters from './evaluation_parameters.js';
import type {TransitionParameters, ConfigOptions} from './properties.js';
import type LngLat from '../geo/lng_lat.js';
import type Transform from '../geo/transform.js';
import type {StyleSetterOptions} from '../style/style.js';
import type {FogState} from './fog_helpers.js';
import type {Mat4, Vec3} from 'gl-matrix';

type Props = {|
    "range": DataConstantProperty<[number, number]>,
    "color": DataConstantProperty<Color>,
    "high-color": DataConstantProperty<Color>,
    "space-color": DataConstantProperty<Color>,
    "horizon-blend": DataConstantProperty<number>,
    "star-intensity": DataConstantProperty<number>,
    "vertical-range": DataConstantProperty<[number, number]>,
|};

const fogProperties: Properties<Props> = new Properties({
    "range": new DataConstantProperty(styleSpec.fog.range),
    "color": new DataConstantProperty(styleSpec.fog.color),
    "high-color": new DataConstantProperty(styleSpec.fog["high-color"]),
    "space-color": new DataConstantProperty(styleSpec.fog["space-color"]),
    "horizon-blend": new DataConstantProperty(styleSpec.fog["horizon-blend"]),
    "star-intensity": new DataConstantProperty(styleSpec.fog["star-intensity"]),
    "vertical-range": new DataConstantProperty(styleSpec.fog["vertical-range"]),
});

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    _options: FogSpecification;

    // Alternate projections do not yet support fog.
    // Hold on to transform so that we know whether a projection is set.
    _transform: Transform;

    constructor(fogOptions?: FogSpecification, transform: Transform, scope: string, configOptions?: ?ConfigOptions) {
        super();
        this._transitionable = new Transitionable(fogProperties, scope, new Map(configOptions));
        this.set(fogOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this._transform = transform;
        this.properties = new PossiblyEvaluated(fogProperties);
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

    set(fog?: FogSpecification, configOptions?: ?ConfigOptions, options: StyleSetterOptions = {}) {
        if (this._validate(validateFog, fog, options)) {
            return;
        }

        const properties = extend({}, fog);
        for (const name of Object.keys(styleSpec.fog)) {
            // Fallback to use default style specification when the properties wasn't set
            if (properties[name] === undefined) {
                properties[name] = styleSpec.fog[name].default;
            }
        }

        this._options = properties;
        this._transitionable.setTransitionOrValue<FogSpecification>(this._options, configOptions);
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

    getOpacityForTile(id: OverscaledTileID): [number, number] {
        if (!this._transform.projection.supportsFog) return [1, 1];

        const fogMatrix = this._transform.calculateFogTileMatrix(id.toUnwrapped());
        return getFogOpacityForBounds(this.state, fogMatrix, 0, 0, EXTENT, EXTENT, this._transform);
    }

    getOpacityForBounds(matrix: Mat4, x0: number, y0: number, x1: number, y1: number): [number, number] {
        if (!this._transform.projection.supportsFog) return [1, 1];

        return getFogOpacityForBounds(this.state, matrix, x0, y0, x1, y1, this._transform);
    }

    getFovAdjustedRange(fov: number): [number, number] {
        // We can return any arbitrary range because we expect opacity=0 to clean it up
        if (!this._transform.projection.supportsFog) return [0, 1];

        return getFovAdjustedFogRange(this.state, fov);
    }

    isVisibleOnFrustum(frustum: Frustum): boolean {
        if (!this._transform.projection.supportsFog) return false;

        // Compute locations where frustum edges intersects with the ground plane
        // and determine if all of these points are closer to the camera than
        // the starting point (near range) of the fog.
        const farPoints = [4, 5, 6, 7];

        for (const pointIdx of farPoints) {
            const farPoint = frustum.points[pointIdx];
            let flatPoint: ?Vec3;

            if (farPoint[2] >= 0.0) {
                flatPoint = farPoint;
            } else {
                const nearPoint = frustum.points[pointIdx - 4];
                flatPoint = vecInterpolate((nearPoint: any), (farPoint: any), nearPoint[2] / (nearPoint[2] - farPoint[2]));
            }

            if (getFogOpacityAtMercCoord(this.state, flatPoint[0], flatPoint[1], 0, this._transform) >= FOG_OPACITY_THRESHOLD) {
                return true;
            }
        }

        return false;
    }

    updateConfig(configOptions?: ?ConfigOptions) {
        this._transitionable.setTransitionOrValue<FogSpecification>(this._options, new Map(configOptions));
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
