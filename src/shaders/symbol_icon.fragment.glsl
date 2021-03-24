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

    gl_FragColor = out_color * alpha * fog_alpha;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
