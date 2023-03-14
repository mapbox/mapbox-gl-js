// @flow

import Context from '../../src/gl/context.js';
import type {UniformValues} from '../../src/render/uniform_binding.js';
import {Uniform3f} from '../../src/render/uniform_binding.js';
import {sRGBToLinearAndScale} from '../../src/util/util.js';

import Lights from '../style/lights.js';
import type {LightProps as Ambient} from '../style/ambient_light_properties.js';
import type {LightProps as Directional} from '../style/directional_light_properties.js';

export type LightsUniformsType = {|
    'u_lighting_ambient_color': Uniform3f,
    'u_lighting_directional_dir': Uniform3f,
    'u_lighting_directional_color': Uniform3f
|};

export const lightsUniforms = (context: Context): LightsUniformsType => ({
    'u_lighting_ambient_color': new Uniform3f(context),
    'u_lighting_directional_dir': new Uniform3f(context),
    'u_lighting_directional_color': new Uniform3f(context)
});

export const lightsUniformValues = (
    directional: Lights<Directional>,
    ambient: Lights<Ambient>
): UniformValues<LightsUniformsType> => {
    const direction = directional.properties.get('direction');

    const directionalColor = directional.properties.get('color').toArray01();
    const directionalIntensity = directional.properties.get('intensity');
    const ambientColor = ambient.properties.get('color').toArray01();
    const ambientIntensity = ambient.properties.get('intensity');

    return {
        'u_lighting_ambient_color': sRGBToLinearAndScale(ambientColor, ambientIntensity),
        'u_lighting_directional_dir': [direction.x, direction.y, direction.z],
        'u_lighting_directional_color': sRGBToLinearAndScale(directionalColor, directionalIntensity)
    };
};
