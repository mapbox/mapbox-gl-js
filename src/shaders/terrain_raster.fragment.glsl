uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform vec3 u_sun_direction;

varying vec3 v_pixel_pos;
uniform vec3 u_camera_pos;

void main() {
    // TODO: Clean this transform
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);
    vec3 sun_direction = vec3(u_sun_direction.x, -u_sun_direction.y, u_sun_direction.z);

    vec3 color = texture2D(u_image0, v_pos0).rgb;
    vec3 camera_ray = normalize(v_pixel_pos - u_camera_pos);
    float depth = length(v_pixel_pos - u_camera_pos);
    float sun_dot_camera_ray = clamp(dot(camera_ray, half_neg_pi_around_x * sun_direction), 0.0, 1.0);

    // TODO: Expose these params
    const float sun_halo_intensity = .2;
    const float sun_halo_depth_range = 2048.0;
    const vec3  sun_halo_color = vec3(1.0, 0.0, 0.0);
    const float fog_depth_start = 8000.0;
    const float fog_depth_end = 8500.0;
    const float fog_intensity = 0.5;
    const vec3  fog_color = vec3(1.0, 1.0, 1.0);

    // fog
    float fogFactor = 1.0 - clamp(exp(-(depth - fog_depth_start)/(fog_depth_end-fog_depth_start)), 0.0, 1.0);
    vec4 fog = vec4(fog_color * fog_intensity, fog_intensity) * fogFactor;
    gl_FragColor = mix(vec4(color, 1.0), fog, fog.a);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
