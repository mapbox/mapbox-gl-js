uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_fade_opacity;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float fog_fade

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float fog_fade

    lowp float fog_alpha = 1.0;
    #ifdef FOG
    fog_alpha = max(0.0, 1.0 - fog_opacity(v_fog_pos) * fog_fade);
    #endif

    lowp float alpha = opacity * v_fade_opacity * fog_alpha;
    gl_FragColor = texture2D(u_texture, v_tex) * alpha;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
