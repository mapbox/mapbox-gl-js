import styleSpec from '../style-spec/reference/latest';
import {degToRad} from '../util/util';
import {validateRain} from './validate_style';
import {StyleProperties} from './style_properties';
import Color from '../style-spec/util/color';
import {getProperties, type RainProps as Props} from '../../3d-style/style/rain_properties';

import type {vec2, vec3} from 'gl-matrix';
import type {RainSpecification} from '../style-spec/types';
import type {ConfigOptions} from './properties';
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

class Rain extends StyleProperties<Props> {
    constructor(rainOptions: RainSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super(getProperties(), scope, new Map(configOptions));
        this.set(rainOptions);
        this._transitionable.snap();
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

        this._setValues(properties, configOptions);
    }
}

export default Rain;
