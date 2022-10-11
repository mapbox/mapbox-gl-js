uniform vec3 u_ambient_color;
uniform vec3 u_sun_color;
uniform vec3 u_sun_dir;
uniform vec3 u_cam_fwd;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity
#pragma mapbox: define lowp float emissive_strength
#pragma mapbox: define highp vec4 emissive_color

#pragma mapbox: define highp float metallic
#pragma mapbox: define highp float roughness


varying vec3 v_position;

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity
    #pragma mapbox: initialize lowp float emissive_strength
    #pragma mapbox: initialize highp vec4 emissive_color
    #pragma mapbox: initialize highp float metallic
    #pragma mapbox: initialize highp float roughness

    Material mat = getPBRMaterial(color, metallic, roughness);
    vec4 out_color = vec4(computeLightContribution(mat, v_position, u_sun_dir, u_sun_color, u_ambient_color), mat.baseColor.w);
    
    // Emission
    out_color += emissive_color * emissive_strength;

#ifdef FOG
    out_color = fog_dither(fog_apply_premultiplied(out_color, v_fog_pos));
#endif

    gl_FragColor = out_color * opacity;

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
