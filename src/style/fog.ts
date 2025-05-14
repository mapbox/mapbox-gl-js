import styleSpec from '../style-spec/reference/latest';
import {extend, smoothstep} from '../util/util';
import {Evented} from '../util/evented';
import {validateStyle, validateFog, emitValidationErrors} from './validate_style';
import {Properties, Transitionable, PossiblyEvaluated, DataConstantProperty} from './properties';
import {FOG_PITCH_START, FOG_PITCH_END, FOG_OPACITY_THRESHOLD, getFogOpacityAtLngLat, getFogOpacityAtMercCoord, getFovAdjustedFogRange, getFogOpacityForBounds} from './fog_helpers';
import {number as interpolate, array as vecInterpolate} from '../style-spec/util/interpolate';
import {globeToMercatorTransition} from '../geo/projection/globe_util';
import EXTENT from '../style-spec/data/extent';

import type {Frustum} from '../util/primitives';
import type {OverscaledTileID} from '../source/tile_id';
import type Color from '../style-spec/util/color';
import type {FogSpecification} from '../style-spec/types';
import type EvaluationParameters from './evaluation_parameters';
import type {TransitionParameters, ConfigOptions, Transitioning} from './properties';
import type LngLat from '../geo/lng_lat';
import type Transform from '../geo/transform';
import type {StyleSetterOptions} from '../style/style';
import type {FogState} from './fog_helpers';
import type {mat4, vec3} from 'gl-matrix';

type Props = {
    ["range"]: DataConstantProperty<[number, number]>;
    ["color"]: DataConstantProperty<Color>;
    ["color-use-theme"]: DataConstantProperty<string>;
    ["high-color"]: DataConstantProperty<Color>;
    ["high-color-use-theme"]: DataConstantProperty<string>;
    ["space-color"]: DataConstantProperty<Color>;
    ["space-color-use-theme"]: DataConstantProperty<string>;
    ["horizon-blend"]: DataConstantProperty<number>;
    ["star-intensity"]: DataConstantProperty<number>;
    ["vertical-range"]: DataConstantProperty<[number, number]>;
};

class Fog extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    _options: FogSpecification;
    scope: string;

    // Alternate projections do not yet support fog.
    // Hold on to transform so that we know whether a projection is set.
    _transform: Transform;

    constructor(fogOptions: FogSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super();

        const fogProperties: Properties<Props> = new Properties({
            "range": new DataConstantProperty(styleSpec.fog.range),
            "color": new DataConstantProperty(styleSpec.fog.color),
            "color-use-theme": new DataConstantProperty({"type": "string", "property-type": "data-constant", "default": "default"}),
            "high-color": new DataConstantProperty(styleSpec.fog["high-color"]),
            "high-color-use-theme": new DataConstantProperty({"type": "string", "property-type": "data-constant", "default": "default"}),
            "space-color": new DataConstantProperty(styleSpec.fog["space-color"]),
            "space-color-use-theme": new DataConstantProperty({"type": "string", "property-type": "data-constant", "default": "default"}),
            "horizon-blend": new DataConstantProperty(styleSpec.fog["horizon-blend"]),
            "star-intensity": new DataConstantProperty(styleSpec.fog["star-intensity"]),
            "vertical-range": new DataConstantProperty(styleSpec.fog["vertical-range"]),
        });

        this._transitionable = new Transitionable(fogProperties, scope, new Map(configOptions));
        this.set(fogOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this._transform = transform;
        this.properties = new PossiblyEvaluated(fogProperties);
        this.scope = scope;
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
        return this._transitionable.serialize() as FogSpecification;
    }

    set(fog?: FogSpecification, configOptions?: ConfigOptions | null, options: StyleSetterOptions = {}) {
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
        // @ts-expect-error - TS2345 - Argument of type 'FogSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(this._options, configOptions);
    }

    getOpacity(pitch: number): number {
        if (!this._transform.projection.supportsFog) return 0;

        const fogColor = (this.properties && this.properties.get('color')) || 1.0;
        const isGlobe = this._transform.projection.name === 'globe';
        const pitchFactor = isGlobe ? 1.0 : smoothstep(FOG_PITCH_START, FOG_PITCH_END, pitch);
        // @ts-expect-error - TS2339 - Property 'a' does not exist on type 'unknown'.
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

    getOpacityForBounds(matrix: mat4, x0: number, y0: number, x1: number, y1: number): [number, number] {
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
            let flatPoint: vec3 | null | undefined;

            if (farPoint[2] >= 0.0) {
                flatPoint = farPoint;
            } else {
                const nearPoint = frustum.points[pointIdx - 4];
                flatPoint = vecInterpolate(nearPoint as number[], farPoint as number[], nearPoint[2] / (nearPoint[2] - farPoint[2])) as vec3;
            }

            if (getFogOpacityAtMercCoord(this.state, flatPoint[0], flatPoint[1], 0, this._transform) >= FOG_OPACITY_THRESHOLD) {
                return true;
            }
        }

        return false;
    }

    updateConfig(configOptions?: ConfigOptions | null) {
        // @ts-expect-error - TS2345 - Argument of type 'FogSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(this._options, new Map(configOptions));
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validate: any,
        value: unknown,
        options?: {
            validate?: boolean;
        },
    ): boolean {
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
