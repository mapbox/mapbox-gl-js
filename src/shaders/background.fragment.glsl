uniform vec4 u_color;
uniform float u_opacity;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
varying vec3 v_fog_pos;
#endif

void main() {
    vec4 out_color = u_color;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
    out_color.rgb = fog_apply(out_color.rgb, v_fog_pos);
#endif

    gl_FragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
