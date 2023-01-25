uniform sampler2D u_texture;

varying vec2 v_tex;
varying float v_fade_opacity;

#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength

void main() {
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength

    lowp float alpha = opacity * v_fade_opacity;
    vec4 out_color = texture2D(u_texture, v_tex) * alpha;

#ifdef LIGHTING_3D_MODE
    out_color = apply_lighting_with_emission(out_color, emissive_strength);
#endif

    gl_FragColor = out_color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
