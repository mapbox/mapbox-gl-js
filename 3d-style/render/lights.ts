import {Uniform3f} from '../../src/render/uniform_binding';
import {sRGBToLinearAndScale, linearVec3TosRGB, clamp} from '../../src/util/util';
import {vec3} from 'gl-matrix';

import type Context from '../../src/gl/context';
import type Style from '../../src/style/style';
import type Lights from '../style/lights';
import type {UniformValues} from '../../src/render/uniform_binding';
import type {LightProps as Ambient} from '../style/ambient_light_properties';
import type {LightProps as Directional} from '../style/directional_light_properties';

export type LightsUniformsType = {
    ['u_lighting_ambient_color']: Uniform3f;
    ['u_lighting_directional_dir']: Uniform3f;
    ['u_lighting_directional_color']: Uniform3f;
    ['u_ground_radiance']: Uniform3f;
};

export const lightsUniforms = (context: Context): LightsUniformsType => ({
    'u_lighting_ambient_color': new Uniform3f(context),
    'u_lighting_directional_dir': new Uniform3f(context),
    'u_lighting_directional_color': new Uniform3f(context),
    'u_ground_radiance': new Uniform3f(context)
});

function calculateAmbientDirectionalFactor(dir: vec3, normal: vec3, dirColor: vec3): number {
    // NdotL Used only for ambient directionality
    const NdotL  = vec3.dot(normal, dir);

    // Emulate sky being brighter close to the main light source

    const factorReductionMax = 0.3;
    const dirLuminance = vec3.dot(dirColor, [0.2126, 0.7152, 0.0722]);
    const directionalFactorMin = 1.0 - factorReductionMax * Math.min(dirLuminance, 1.0);

    const lerp = (a: number, b: number, t: number) => { return (1 - t) * a + t * b; };

    // If dirColor is (1, 1, 1), then the return value range is
    // NdotL=-1: 1.0 - factorReductionMax
    // NdotL>=0: 1.0
    const ambientDirectionalFactor = lerp(directionalFactorMin, 1.0, Math.min((NdotL + 1.0), 1.0));

    // Emulate environmental light being blocked by other objects

    // Value moves from vertical_factor_min at z=-1 to 1.0 at z=1
    const verticalFactorMin = 0.92;
    // clamp(z, -1.0, 1.0) is required because z can be very slightly out of the acceptable input
    // range for asin, even when it has been normalized, due to limited floating point precision.
    const verticalFactor = lerp(verticalFactorMin, 1.0, Math.asin(clamp(normal[2], -1.0, 1.0)) / Math.PI + 0.5);

    return verticalFactor * ambientDirectionalFactor;
}

function calculateGroundRadiance(dir: vec3, dirColor: vec3, ambientColor: vec3): [number, number, number] {
    const groundNormal: vec3 = [0.0, 0.0, 1.0];
    const ambientDirectionalFactor = calculateAmbientDirectionalFactor(dir, groundNormal, dirColor);

    const ambientContrib: vec3 = [0, 0, 0];
    vec3.scale(ambientContrib, ambientColor.slice(0, 3) as vec3, ambientDirectionalFactor);
    const dirConrib: vec3 = [0, 0, 0];
    vec3.scale(dirConrib, dirColor.slice(0, 3) as vec3, dir[2]);

    const radiance: vec3 = [0, 0, 0];
    vec3.add(radiance, ambientContrib, dirConrib);

    return linearVec3TosRGB(radiance);
}

export const lightsUniformValues = (directional: Lights<Directional>, ambient: Lights<Ambient>, style: Style): UniformValues<LightsUniformsType> => {

    const direction = directional.properties.get('direction');

    const dirIgnoreLut = directional.properties.get('color-use-theme') === 'none';
    const directionalColor = directional.properties.get('color').toRenderColor(dirIgnoreLut ? null : style.getLut(directional.scope)).toArray01();
    const directionalIntensity = directional.properties.get('intensity');

    const ambIgnoreLut = ambient.properties.get('color-use-theme') === 'none';
    const ambientColor = ambient.properties.get('color').toRenderColor(ambIgnoreLut ? null : style.getLut(ambient.scope)).toArray01();
    const ambientIntensity = ambient.properties.get('intensity');

    const dirVec: [number, number, number] = [direction.x, direction.y, direction.z];

    const ambientColorLinear = sRGBToLinearAndScale(ambientColor, ambientIntensity);

    const directionalColorLinear = sRGBToLinearAndScale(directionalColor, directionalIntensity);
    const groundRadianceSrgb = calculateGroundRadiance((dirVec as any), (directionalColorLinear as any), (ambientColorLinear as any));
    return {
        'u_lighting_ambient_color': ambientColorLinear,
        'u_lighting_directional_dir': dirVec,
        'u_lighting_directional_color': directionalColorLinear,
        'u_ground_radiance': groundRadianceSrgb
    };
};
