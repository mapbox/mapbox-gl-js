uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform highp float u_near;
uniform highp float u_far;
uniform vec3 u_sun_direction;
uniform float u_fog_start;
uniform float u_fog_end;
uniform float u_fog_intensity;
uniform vec3 u_fog_color;

varying float v_distance;
varying vec3 v_position;

void main() {
    // TODO: Clean this transform
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                           0.0, 0.0, -1.0,
                                           0.0, 1.0,  0.0);
    vec3 sun_direction = vec3(u_sun_direction.x, -u_sun_direction.y, u_sun_direction.z);

    vec3 color = texture2D(u_image0, v_pos0).rgb;
    vec3 camera_ray = normalize(v_position);
    float depth = v_distance;
    float sun_dot_camera_ray = clamp(dot(camera_ray, half_neg_pi_around_x * sun_direction), 0.0, 1.0);

    // TODO: Expose these params
    float sun_halo_intensity = .2;
    float sun_halo_depth_range = 50.0;
    vec3 sun_halo_color = vec3(1.0, 0.0, 0.0);

    // fog
    vec3 fog = u_fog_color;
    vec3 halo = sun_halo_intensity * sun_halo_color;
    float fog_falloff = 1.0 - clamp(exp(-(depth - u_fog_start) / (u_fog_end - u_fog_start)), 0.0, 1.0);
    color = mix(color, mix(fog, halo, sun_dot_camera_ray * sun_dot_camera_ray * sun_halo_intensity), fog_falloff * u_fog_intensity);

    // sun scattering
    float sun_halo = pow(sun_dot_camera_ray, 16.0);
    color += halo * sun_halo * (1.0 - exp(-sun_halo_depth_range * depth * depth));

    gl_FragColor = vec4(color, 1.0);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
