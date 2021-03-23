varying vec4 v_color;

#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
varying vec3 v_fog_pos;
#endif

void main() {
    vec4 color = v_color;
#if defined( FOG ) && !defined( RENDER_TO_TEXTURE )
    color.rgb = fog_apply(color.rgb, v_fog_pos);
#endif
    gl_FragColor = color;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
