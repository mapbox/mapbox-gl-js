uniform highp float u_ao_pass;
uniform highp float u_opacity;

uniform highp float u_flood_light_intensity;
uniform highp vec3 u_flood_light_color;

uniform highp float u_attenuation;

#ifdef SDF_SUBPASS
varying highp vec2 v_pos;
varying highp vec4 v_line_segment;
varying highp float v_flood_light_radius_tile;
varying highp vec2 v_ao;

float line_df(highp vec2 a, highp vec2 b, highp vec2 p) {
    highp vec2 ba = b - a;
    highp vec2 pa = p - a;
    highp float r = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - r * ba);
}

#ifdef FOG
varying highp float v_fog;
#endif
#endif

void main() {
#ifdef SDF_SUBPASS
    highp float d = line_df(v_line_segment.xy, v_line_segment.zw, v_pos);
    highp float effect_radius = mix(v_flood_light_radius_tile, v_ao.y, u_ao_pass);
    d /= effect_radius;
    d = min(d, 1.0);
    d = 1.0 - pow(1.0 - d, u_attenuation);
    highp float effect_intensity = mix(u_flood_light_intensity, v_ao.x, u_ao_pass);
    highp float fog = 1.0;
#ifdef FOG
    fog = v_fog;
#endif
    vec4 color = vec4(vec3(0.0), mix(1.0, d, effect_intensity * u_opacity * fog));
    gl_FragColor = color;
#else // SDF_SUBPASS
    gl_FragColor = mix(vec4(u_flood_light_color, 1.0), vec4(vec3(0.0), 1.0), u_ao_pass);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
    HANDLE_WIREFRAME_DEBUG;
#endif // !SDF_SUBPASS
}
