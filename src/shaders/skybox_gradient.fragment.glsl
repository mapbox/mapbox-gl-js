#include "_prelude_fog.fragment.glsl"

in highp vec3 v_uv;

uniform lowp sampler2D u_color_ramp;
uniform highp vec3 u_center_direction;
uniform lowp float u_radius;
uniform lowp float u_opacity;
uniform highp float u_temporal_offset;

void main() {
    float progress = acos(dot(normalize(v_uv), u_center_direction)) / u_radius;
    vec4 color = texture(u_color_ramp, vec2(progress, 0.5));

#ifdef FOG
    // Apply fog contribution if enabled, make sure to un/post multiply alpha before/after
    // applying sky gradient contribution, as color ramps are premultiplied-alpha colors.
    // Swizzle to put z-up (ignoring x-y mirror since fog does not depend on azimuth)
    color.rgb = fog_apply_sky_gradient(v_uv.xzy, color.rgb / color.a) * color.a;
#endif

    color *= u_opacity;

    glFragColor = color;

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif
}
