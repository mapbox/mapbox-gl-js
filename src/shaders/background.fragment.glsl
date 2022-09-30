uniform vec4 u_color;
uniform float u_opacity;

uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;

void main() {
    vec4 out_color = u_color;
    out_color = lighting_model(out_color, u_ambient_color, u_sun_color, u_sun_dir, u_cam_fwd);

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
