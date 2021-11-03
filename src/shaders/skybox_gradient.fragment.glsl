varying highp vec3 v_uv;

uniform lowp sampler2D u_color_ramp;
uniform highp vec3 u_center_direction;
uniform lowp float u_radius;
uniform lowp float u_opacity;
uniform highp float u_temporal_offset;

void main() {
    float progress = acos(dot(normalize(v_uv), u_center_direction)) / u_radius;
    // cutoff the skybox below the horizon
    const float y_bias = 0.015;
    const float y_cutoff = 0.3;
    const float y_cutoff_range = 0.1;
    float biased_cutoff = y_bias + y_cutoff;
    vec3 normalized_uv = normalize(v_uv);
    float horizon_cutoff_alpha = 1.0 - smoothstep(biased_cutoff - y_cutoff_range, biased_cutoff + y_cutoff_range, -normalized_uv.y);

    vec4 color = texture2D(u_color_ramp, vec2(progress, 0.5));

#ifdef FOG
    // Apply fog contribution if enabled, make sure to un/post multiply alpha before/after
    // applying sky gradient contribution, as color ramps are premultiplied-alpha colors.
    // Swizzle to put z-up (ignoring x-y mirror since fog does not depend on azimuth)
    color.rgb = fog_apply_sky_gradient(v_uv.xzy, color.rgb / color.a) * color.a;
#endif

    color *= u_opacity * horizon_cutoff_alpha;

    // Dither
    color.rgb = dither(color.rgb, gl_FragCoord.xy + u_temporal_offset);

    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
