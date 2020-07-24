varying highp vec3 v_uv;

uniform lowp sampler2D u_color_ramp;
uniform lowp vec3 u_center_direction;
uniform lowp float u_radius;
uniform lowp float u_opacity;
uniform highp float u_temporal_offset;

highp vec3 hash(highp vec2 p) {
    highp vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975, 397.2973, 491.1871));
    p3 += dot(p3, p3.yxz + 19.19);
    return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec3 dither(vec3 color, highp vec2 seed) {
    vec3 rnd = hash(seed) + hash(seed + 0.59374) - 0.5;
    color.rgb += rnd / 255.0;
    return color;
}

void main() {
    float progress = acos(dot(normalize(v_uv), u_center_direction)) / u_radius;
    vec4 color = texture2D(u_color_ramp, vec2(progress, 0.5)) * u_opacity;

    // Dither
    color.rgb = dither(color.rgb, gl_FragCoord.xy + u_temporal_offset);

    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
