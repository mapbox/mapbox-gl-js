uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_fade_opacity;

#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize lowp float opacity

    lowp float alpha = opacity * v_fade_opacity;
    gl_FragColor = texture2D(u_texture, v_tex) * alpha;
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
