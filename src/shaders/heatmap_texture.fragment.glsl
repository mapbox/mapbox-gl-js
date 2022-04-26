uniform sampler2D u_image;
uniform sampler2D u_color_ramp;
uniform float u_opacity;
varying vec2 v_pos;

varying highp vec3 v_ray_dir;

void main() {
#ifdef FOG
    highp vec3 dir = normalize(v_ray_dir);
    float globe_pos_dot_dir = dot(u_globe_pos, dir);
    highp vec3 closest_point_forward = abs(globe_pos_dot_dir) * dir;
    float norm_dist_from_center = length(closest_point_forward - u_globe_pos) / u_globe_radius;

    float edge_fade = 1.0 - smoothstep(0.8, 1.0, norm_dist_from_center);
#endif

    float t = texture2D(u_image, v_pos).r;
    vec4 color = texture2D(u_color_ramp, vec2(t, 0.5));

#ifdef FOG
    gl_FragColor = color * u_opacity * edge_fade;
#else
    gl_FragColor = color * u_opacity;
#endif

#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(0.0);
#endif
}
