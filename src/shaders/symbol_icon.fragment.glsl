uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_fade_opacity;

#ifdef FOG
varying vec3 v_fog_pos;
#endif


#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float opacity

    lowp float alpha = opacity * v_fade_opacity;

    vec4 out_color = texture2D(u_texture, v_tex);
    float fog_alpha = 1.0;
    #ifdef FOG
        fog_alpha = 1.0 - fog_opacity(v_fog_pos);
    #endif

    vec4 fog_color = vec4(1.0 - fog_alpha);
    vec4 out_color_2 = (fog_color * out_color.a + out_color * (1.0 - fog_color.a));
    gl_FragColor = out_color_2 * alpha;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
