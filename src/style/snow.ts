import styleSpec from '../style-spec/reference/latest';
import {extend, degToRad} from '../util/util';
import {Evented} from '../util/evented';
import {validateStyle, validateSnow, emitValidationErrors} from './validate_style';
import {Transitionable, PossiblyEvaluated} from './properties';
import Color from '../style-spec/util/color';
import {getProperties, type SnowProps as Props} from '../../3d-style/style/snow_properties';

import type {SnowSpecification} from '../style-spec/types';
import type EvaluationParameters from './evaluation_parameters';
import type {TransitionParameters, ConfigOptions, Transitioning} from './properties';
import type Transform from '../geo/transform';
import type {StyleSetterOptions} from '../style/style';
import type {vec3} from 'gl-matrix';

interface SnowState {
    density: number;
    intensity: number;
    color: Color;
    direction: vec3;
    centerThinning: number;
    flakeSize: number;
    vignetteColor: Color;
}

class Snow extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    _options: SnowSpecification;
    scope: string;

    constructor(snowOptions: SnowSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super();

        const snowProperties = getProperties();
        this._transitionable = new Transitionable(snowProperties, scope, new Map(configOptions));
        this.set(snowOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.properties = new PossiblyEvaluated(snowProperties);
        this.scope = scope;
    }

    get state(): SnowState {
        const opacity = this.properties.get('opacity');
        const color = this.properties.get('color');
        const directionAngles = this.properties.get('direction');
        const heading = degToRad(directionAngles[0]);
        const pitch = -Math.max(degToRad(directionAngles[1]), 0.01);

        const direction: vec3 = [Math.cos(heading) * Math.cos(pitch), Math.sin(heading) * Math.cos(pitch), Math.sin(pitch)];

        const vignetteIntensity = this.properties.get('vignette');
        const vignetteColor = this.properties.get('vignette-color');
        vignetteColor.a = vignetteIntensity;

        return {
            density: this.properties.get('density'),
            intensity: this.properties.get('intensity'),
            color: new Color(color.r, color.g, color.b, color.a * opacity),
            direction,
            centerThinning: this.properties.get('center-thinning'),
            flakeSize: this.properties.get('flake-size'),
            vignetteColor
        };
    }

    get(): SnowSpecification {
        return this._transitionable.serialize() as SnowSpecification;
    }

    set(snow?: SnowSpecification, configOptions?: ConfigOptions | null, options: StyleSetterOptions = {}) {
        if (this._validate(validateSnow, snow, options)) {
            return;
        }

        const properties = extend({}, snow);
        for (const name of Object.keys(styleSpec.snow)) {
            // Fallback to use default style specification when the properties wasn't set
            if (properties[name] === undefined) {
                properties[name] = styleSpec.snow[name].default;
            }
        }

        this._options = properties;
        // @ts-expect-error - TS2345 - Argument of type 'SnowSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
        this._transitionable.setTransitionOrValue(this._options, configOptions);
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

export default Snow;
