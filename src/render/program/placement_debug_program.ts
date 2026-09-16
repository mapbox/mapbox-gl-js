import {Uniform1f, Uniform2f, UniformColor} from '../uniform_binding';

import type {UniformValues} from '../uniform_binding';
import type Context from '../../gl/context';
import type {PremultipliedRenderColor} from '../../style-spec/util/color';

export type PlacementDebugUniformsType = {
    ['u_viewport_size']: Uniform2f;
    ['u_color']: UniformColor;
    ['u_outline_width']: Uniform1f;
    ['u_opacity']: Uniform1f;
    ['u_stroke_opacity']: Uniform1f;
};

const placementDebugUniforms = (context: Context): PlacementDebugUniformsType => ({
    'u_viewport_size': new Uniform2f(context),
    'u_color': new UniformColor(context),
    'u_outline_width': new Uniform1f(context),
    'u_opacity': new Uniform1f(context),
    'u_stroke_opacity': new Uniform1f(context)
});

const placementDebugUniformValues = (
    viewportSize: [number, number],
    color: PremultipliedRenderColor,
    outlineWidth: number,
    opacity: number,
    strokeOpacity: number,
): UniformValues<PlacementDebugUniformsType> => ({
    'u_viewport_size': viewportSize,
    'u_color': color,
    'u_outline_width': outlineWidth,
    'u_opacity': opacity,
    'u_stroke_opacity': strokeOpacity
});

export {placementDebugUniforms, placementDebugUniformValues};
