varying highp vec3 v_uv;

uniform lowp sampler2D u_color_ramp;
uniform lowp vec3 u_center_direction;
uniform lowp float u_radius;
uniform lowp float u_opacity;
uniform highp float u_temporal_offset;

void main() {
    float progress = acos(dot(normalize(v_uv), u_center_direction)) / u_radius;
    vec4 color = texture2D(u_color_ramp, vec2(progress, 0.5)) * u_opacity;

#ifdef FOG
    // Apply fog contribution if enabled
    color.rgb = fog_apply_sky_gradient(v_uv, color.rgb);
#endif

    // Dither
    color.rgb = dither(color.rgb, gl_FragCoord.xy + u_temporal_offset);

    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
