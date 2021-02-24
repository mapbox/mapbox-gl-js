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

float map(float value, float start, float end, float new_start, float new_end) {
    return ((value - start) * (new_end - new_start)) / (end - start) + new_start;
}

void main() {
    const mat3 half_neg_pi_around_x = mat3(1.0, 0.0,  0.0,
                                        0.0, 0.0, -1.0,
                                        0.0, 1.0,  0.0);

    vec3 camera_ray = half_neg_pi_around_x * normalize(v_position);
      // Add a small offset to prevent black bands around areas where
    // the scattering algorithm does not manage to gather lighting
    const float y_bias = 0.015;
    camera_ray.y += y_bias;

    // Inverse of the operation applied for non-linear UV parameterization
    camera_ray.y = pow(abs(camera_ray.y), 1.0 / 5.0);

    // To make better utilization of the visible range (e.g. over the horizon, UVs
    // from 0.0 to 1.0 on the Y-axis in cubemap space), the UV range is remapped from
    // (0.0,1.0) to (-1.0,1.0) on y. The inverse operation is applied when generating.
    camera_ray.y = map(camera_ray.y, 0.0, 1.0, -1.0, 1.0);

    vec3 color = texture2D(u_image0, v_pos0).rgb;
    float depth = v_distance;

    // Fog
    float fog_falloff = 1.0 - clamp(exp(-(depth - u_fog_start) / (u_fog_end - u_fog_start)), 0.0, 1.0);
    color = mix(color, u_fog_color, fog_falloff * u_fog_intensity);

    gl_FragColor = vec4(camera_ray.x, camera_ray.y, camera_ray.z, 1.0);
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
