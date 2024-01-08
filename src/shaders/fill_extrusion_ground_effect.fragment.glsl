uniform highp float u_ao_pass;
uniform highp float u_opacity;

uniform highp float u_flood_light_intensity;
uniform highp vec3 u_flood_light_color;

uniform highp float u_attenuation;

uniform sampler2D u_fb;
uniform float u_fb_size;

#ifdef SDF_SUBPASS
in highp vec2 v_pos;
in highp vec4 v_line_segment;
in highp float v_flood_light_radius_tile;
in highp vec2 v_ao;

float line_df(highp vec2 a, highp vec2 b, highp vec2 p) {
    highp vec2 ba = b - a;
    highp vec2 pa = p - a;
    highp float r = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - r * ba);
}

#ifdef FOG
in highp float v_fog;
#endif // FOG
#endif // SDF_SUBPASS

void main() {
// Note that these are used in only in draped mode. The simple clear to white is needed to ensure that the alpha channel is set to 1. 
// This is necessary because the subsequent steps in both ground flood light and AO
// encode DF values in tandem with gl.MIN blending mode where a value of 0 indicates the effect is fully present.
// Once an effect is rendered, it's necessary to mark the alpha channel correctly taking into account the original values (encoded in the texture) which 
// contain the layer emissive strength values. 
#ifdef CLEAR_SUBPASS
    vec4 color = vec4(1.0);
#ifdef CLEAR_FROM_TEXTURE
    color = texture(u_fb, gl_FragCoord.xy / vec2(u_fb_size));
#endif // CLEAR_FROM_TEXTURE
    glFragColor = color;
#else // CLEAR_SUBPASS
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
#endif // FOG
#ifdef RENDER_CUTOFF
    fog *= v_cutoff_opacity;
#endif // RENDER_CUTOFF
    glFragColor = vec4(vec3(0.0), mix(1.0, d, effect_intensity * u_opacity * fog));
#else // SDF_SUBPASS
vec4 color = mix(vec4(u_flood_light_color, 1.0), vec4(vec3(0.0), 1.0), u_ao_pass);
#ifdef OVERDRAW_INSPECTOR
    color = vec4(1.0);
#endif
    glFragColor = color;
    HANDLE_WIREFRAME_DEBUG;
#endif // !SDF_SUBPASS
#endif // !CLEAR_SUBPASS
}
