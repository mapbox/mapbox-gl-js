import styleSpec from '../style-spec/reference/latest';
import {extend, degToRad} from '../util/util';
import {Evented} from '../util/evented';
import {validateStyle, validateRain, emitValidationErrors} from './validate_style';
import {Transitionable, PossiblyEvaluated} from './properties';
import Color from '../style-spec/util/color';
import {getProperties, type RainProps as Props} from '../../3d-style/style/rain_properties';

import type {RainSpecification} from '../style-spec/types';
import type EvaluationParameters from './evaluation_parameters';
import type {TransitionParameters, ConfigOptions, Transitioning} from './properties';
import type Transform from '../geo/transform';
import type {StyleSetterOptions} from '../style/style';
import type {vec2, vec3} from 'gl-matrix';

interface RainState {
    density: number;
    intensity: number;
    color: Color;
    direction: vec3;
    centerThinning: number;
    dropletSize: vec2;
    distortionStrength: number;
    vignetteColor: Color;
}

class Rain extends Evented {
    _transitionable: Transitionable<Props>;
    _transitioning: Transitioning<Props>;
    properties: PossiblyEvaluated<Props>;
    _options: RainSpecification;
    scope: string;

    constructor(rainOptions: RainSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super();

        const rainProperties = getProperties();

        this._transitionable = new Transitionable(rainProperties, scope, new Map(configOptions));
        this.set(rainOptions, configOptions);
        this._transitioning = this._transitionable.untransitioned();
        this.properties = new PossiblyEvaluated(rainProperties);
        this.scope = scope;
    }

    get state(): RainState {
        const opacity = this.properties.get('opacity');
        const color = this.properties.get('color');
        const directionAngles = this.properties.get('direction');
        const heading = degToRad(directionAngles[0]);
        const pitch = -Math.max(degToRad(directionAngles[1]), 0.01);

        const direction: vec3 = [Math.cos(heading) * Math.cos(pitch), Math.sin(heading) * Math.cos(pitch), Math.sin(pitch)];

        const vignetteColor = this.properties.get('vignette-color');
        vignetteColor.a = this.properties.get('vignette');

        return {
            density: this.properties.get('density'),
            intensity: this.properties.get('intensity'),
            color: new Color(color.r, color.g, color.b, color.a * opacity),
            direction,
            centerThinning: this.properties.get('center-thinning'),
            dropletSize: this.properties.get('droplet-size'),
            distortionStrength: this.properties.get('distortion-strength'),
            vignetteColor
        };
    }

    get(): RainSpecification {
        return this._transitionable.serialize() as RainSpecification;
    }

    set(rain?: RainSpecification, configOptions?: ConfigOptions | null, options: StyleSetterOptions = {}) {
        if (this._validate(validateRain, rain, options)) {
            return;
        }

        const properties = extend({}, rain);
        for (const name of Object.keys(styleSpec.rain)) {
            // Fallback to use default style specification when the properties wasn't set
            if (properties[name] === undefined) {
                properties[name] = styleSpec.rain[name].default;
            }
        }

        this._options = properties;
        // @ts-expect-error - TS2345 - Argument of type 'RainSpecification' is not assignable to parameter of type 'PropertyValueSpecifications<Props>'.
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

export default Rain;
