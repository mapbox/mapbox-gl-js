uniform vec2 u_texsize;

uniform sampler2D u_image;

varying vec2 v_pos;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp vec4 pattern

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize mediump vec4 pattern

    vec2 pattern_tl = pattern.xy;
    vec2 pattern_br = pattern.zw;

    vec2 imagecoord = mod(v_pos, 1.0);
    vec2 pos = mix(pattern_tl / u_texsize, pattern_br / u_texsize, imagecoord);
    vec4 out_color = texture2D(u_image, pos);

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting(out_color);
#endif
#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
