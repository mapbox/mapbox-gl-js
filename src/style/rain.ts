import styleSpec from '../style-spec/reference/latest';
import {degToRad} from '../util/util';
import {Evented} from '../util/evented';
import {validateStyle, validateRain, emitValidationErrors} from './validate_style';
import {Transitionable, PossiblyEvaluated} from './properties';
import Color from '../style-spec/util/color';
import {getProperties, type RainProps as Props} from '../../3d-style/style/rain_properties';

import type {vec2, vec3} from 'gl-matrix';
import type {Validator} from './validate_style';
import type {RainSpecification} from '../style-spec/types';
import type EvaluationParameters from './evaluation_parameters';
import type {TransitionParameters, ConfigOptions, Transitioning} from './properties';
import type Transform from '../geo/transform';
import type {StyleSetterOptions} from '../style/style';
import type {StylePropertySpecification} from '../style-spec/style-spec';

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
    _options!: RainSpecification;
    scope: string;

    constructor(rainOptions: RainSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super();

        const rainProperties = getProperties();

        // Take a defensive snapshot of `configOptions` rather than holding a
        // live reference to it. `updateConfig`/`resetConfig` below are called
        // with a fresh snapshot on every config change
        this._transitionable = new Transitionable(rainProperties, scope, new Map(configOptions));
        this.properties = new PossiblyEvaluated(rainProperties);
        this.scope = scope;
        this.set(rainOptions);
        this.resetConfig(configOptions);
    }

    get state(): RainState {
        const opacity = this.properties.get('opacity');
        const color = this.properties.get('color');
        const directionAngles = this.properties.get('direction');
        const heading = degToRad(directionAngles[0]);
        const pitch = -Math.max(degToRad(directionAngles[1]), 0.01);

        const direction: vec3 = [Math.cos(heading) * Math.cos(pitch), Math.sin(heading) * Math.cos(pitch), Math.sin(pitch)];

        const baseVignetteColor = this.properties.get('vignette-color');
        const vignetteColor = new Color(baseVignetteColor.r, baseVignetteColor.g, baseVignetteColor.b, this.properties.get('vignette'));

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
        return this._transitionable.serialize();
    }

    set(rain?: RainSpecification, configOptions?: ConfigOptions | null, options: StyleSetterOptions = {}) {
        if (this._validate(validateRain, rain, options)) {
            return;
        }

        const properties = {...rain};
        const rainSpec = styleSpec.rain as Record<PropertyKey, StylePropertySpecification>;
        for (const name of Object.keys(rainSpec)) {
            // Fallback to use default style specification when the properties wasn't set
            if (properties[name] === undefined) {
                properties[name] = rainSpec[name].default;
            }
        }

        this._options = properties;
        this._transitionable.setTransitionOrValue(this._options, configOptions ? new Map(configOptions) : undefined);
    }

    updateConfig(configOptions?: ConfigOptions | null) {
        this._transitionable.setTransitionOrValue(this._options, new Map(configOptions));
    }

    // Like `updateConfig`, but also resets `_transitioning` to the freshly-updated value,
    // skipping any transition. Used by the constructor (there is no prior visible state
    // to transition from yet) and at initial style load, where the constructor-time config
    // snapshot may be missing options from sibling imports that hadn't loaded yet.
    resetConfig(configOptions?: ConfigOptions | null) {
        this.updateConfig(configOptions);
        this._transitioning = this._transitionable.untransitioned();
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
        validate: Validator,
        value: unknown,
        options?: {
            validate?: boolean;
        },
    ): boolean {
        if (options && options.validate === false) {
            return false;
        }

        return emitValidationErrors(this, validate.call(validateStyle, {value,
            style: {glyphs: true, sprite: true},
            styleSpec}));
    }
}

export default Rain;
