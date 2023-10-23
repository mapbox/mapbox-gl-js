#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform vec2 u_texsize;

uniform sampler2D u_image;

#ifdef FAUX_AO
uniform lowp vec2 u_ao;
varying vec3 v_ao;
#endif

#ifdef LIGHTING_3D_MODE
varying vec3 v_normal;
#endif

varying vec2 v_pos;
varying vec4 v_lighting;

uniform lowp float u_opacity;

#pragma mapbox: define highp float base
#pragma mapbox: define highp float height
#pragma mapbox: define mediump vec4 pattern
#pragma mapbox: define highp float pixel_ratio

void main() {
    #pragma mapbox: initialize highp float base
    #pragma mapbox: initialize highp float height
    #pragma mapbox: initialize mediump vec4 pattern
    #pragma mapbox: initialize highp float pixel_ratio

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 imagecoord = mod(v_pos, 1.0);
    vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);
    vec4 out_color = texture2D(u_image, pos);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting(out_color, normalize(v_normal)) * u_opacity;
#else
    out_color = out_color * v_lighting;
#endif

#ifdef FAUX_AO
    float intensity = u_ao[0];
    float h = max(0.0, v_ao.z);
    float h_floors = h / u_ao[1];
    float y_shade = 1.0 - 0.9 * intensity * min(v_ao.y, 1.0);
    float shade = (1.0 - 0.08 * intensity) * (y_shade + (1.0 - y_shade) * (1.0 - pow(1.0 - min(h_floors / 16.0, 1.0), 16.0))) + 0.08 * intensity * min(h_floors / 160.0, 1.0);
    // concave angle
    float concave = v_ao.x * v_ao.x;
    float x_shade = mix(1.0, mix(0.6, 0.75, min(h_floors / 30.0, 1.0)), intensity) + 0.1 * intensity * min(h, 1.0);
    shade *= mix(1.0, x_shade * x_shade * x_shade, concave);
    out_color.rgb = out_color.rgb * shade;
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

#ifdef INDICATOR_CUTOUT
    out_color = applyCutout(out_color);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
