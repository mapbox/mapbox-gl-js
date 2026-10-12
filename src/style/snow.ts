import styleSpec from '../style-spec/reference/latest';
import {degToRad} from '../util/util';
import {validateSnow} from './validate_style';
import {StyleProperties} from './style_properties';
import Color from '../style-spec/util/color';
import {getProperties, type SnowProps as Props} from '../../3d-style/style/snow_properties';

import type {vec3} from 'gl-matrix';
import type {SnowSpecification} from '../style-spec/types';
import type {ConfigOptions} from './properties';
import type Transform from '../geo/transform';
import type {StyleSetterOptions} from '../style/style';
import type {StylePropertySpecification} from '../style-spec/style-spec';

interface SnowState {
    density: number;
    intensity: number;
    color: Color;
    direction: vec3;
    centerThinning: number;
    flakeSize: number;
    vignetteColor: Color;
}

class Snow extends StyleProperties<Props> {
    constructor(snowOptions: SnowSpecification | null | undefined, transform: Transform, scope: string, configOptions?: ConfigOptions | null) {
        super(getProperties(), scope, new Map(configOptions));
        this.set(snowOptions);
        this._transitionable.snap();
    }

    get state(): SnowState {
        const opacity = this.properties.get('opacity');
        const color = this.properties.get('color');
        const directionAngles = this.properties.get('direction');
        const heading = degToRad(directionAngles[0]);
        const pitch = -Math.max(degToRad(directionAngles[1]), 0.01);

        const direction: vec3 = [Math.cos(heading) * Math.cos(pitch), Math.sin(heading) * Math.cos(pitch), Math.sin(pitch)];

        const vignetteIntensity = this.properties.get('vignette');
        const baseVignetteColor = this.properties.get('vignette-color');
        const vignetteColor = new Color(baseVignetteColor.r, baseVignetteColor.g, baseVignetteColor.b, vignetteIntensity);

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
        return this._transitionable.serialize();
    }

    set(snow?: SnowSpecification, configOptions?: ConfigOptions | null, options: StyleSetterOptions = {}) {
        if (this._validate(validateSnow, snow, options)) {
            return;
        }

        const properties = {...snow};
        const snowSpec = styleSpec.snow as Record<PropertyKey, StylePropertySpecification>;
        for (const name of Object.keys(snowSpec)) {
            // Fallback to use default style specification when the properties wasn't set
            if (properties[name] === undefined) {
                properties[name] = snowSpec[name].default;
            }
        }

        this._setValues(properties, configOptions);
    }
}

export default Snow;
