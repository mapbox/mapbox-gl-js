uniform vec4 u_color;
uniform float u_opacity;

uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;
uniform float u_metallic;
uniform float u_roughness;

varying vec3 v_position;

void main() {

    Material mat = getPBRMaterial(u_color, u_metallic, u_roughness);
    vec4 out_color = vec4(computeLightContribution(mat, v_position, u_sun_dir, u_sun_color, u_ambient_color), mat.baseColor.w);

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * u_opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
