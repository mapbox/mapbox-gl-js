import {UniformMatrix4f, Uniform3f} from '../../../src/render/uniform_binding';
import type {UniformValues} from '../../../src/render/uniform_binding';
import type Context from '../../../src/gl/context';

export type GroundShadowUniformsType = {
    ['u_matrix']: UniformMatrix4f;
    ['u_ground_shadow_factor']: Uniform3f;
};

const groundShadowUniforms = (context: Context): GroundShadowUniformsType => ({
    'u_matrix': new UniformMatrix4f(context),
    'u_ground_shadow_factor': new Uniform3f(context)
});

const groundShadowUniformValues = (matrix: Float32Array, shadowFactor: [number, number, number]): UniformValues<GroundShadowUniformsType> => ({
    'u_matrix': matrix,
    'u_ground_shadow_factor': shadowFactor
});

export {
    groundShadowUniforms,
    groundShadowUniformValues
};
