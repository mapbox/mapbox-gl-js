uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform highp float u_near;
uniform highp float u_far;
uniform vec3 u_sun_direction;

varying float v_distance;
varying vec3 v_position;

void main() {
    // TODO: Clean this transform
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);
    vec3 sun_direction = vec3(u_sun_direction.x, -u_sun_direction.y, u_sun_direction.z);

    vec3 color = vec3(0.0);
    vec3 camera_ray = normalize(v_position);
    float depth = v_distance / u_far;
    float sun_dot_camera_ray = clamp(dot(camera_ray, half_neg_pi_around_x * sun_direction), 0.0, 1.0);

    // TODO: Expose these params
    const float sun_halo_intensity = .5;
    const float sun_halo_depth_range = 50.0;
    const vec3  sun_halo_color = vec3(0.0, 1.0, 0.0);
    const float fog_depth_range = 50.0;
    const float fog_intensity = 1.0;
    const vec3  fog_color = vec3(0.0, 0.0, 1.0);

    // fog
    const vec3 fog = fog_intensity * fog_color;
    const vec3 halo = sun_halo_intensity * sun_halo_color;
    color = mix(color, mix(fog, halo, sun_dot_camera_ray * sun_dot_camera_ray * sun_halo_intensity), 1.0 - exp(-fog_depth_range * depth * depth));

    // sun scattering
    float sun_halo = pow(sun_dot_camera_ray, 16.0);
    color += halo * sun_halo * (1.0 - exp(-sun_halo_depth_range * depth * depth));

    gl_FragColor = vec4(color, 1.0);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
