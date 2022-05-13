uniform float u_transition;
uniform highp float u_fadeout_range;
uniform highp float u_temporal_offset;
uniform vec3 u_start_color;
uniform vec4 u_color;
uniform vec4 u_space_color;
uniform vec4 u_high_color;
uniform float u_star_intensity;
uniform float u_star_size;
uniform float u_star_density;
uniform float u_horizon_angle;
uniform mat4 u_rotation_matrix;

varying highp vec3 v_ray_dir;
varying highp vec3 v_horizon_dir;

highp float random(highp vec3 p) {
    p = fract(p * vec3(23.2342, 97.1231, 91.2342));
    p += dot(p.zxy, p.yxz + 123.1234);
    return fract(p.x * p.y);
}

float stars(vec3 p, float scale, vec2 offset) {
    vec2 uv_scale = (u_viewport / u_star_size) * scale;
    vec3 position = vec3(p.xy * uv_scale + offset * u_viewport, p.z);

    vec3 q = fract(position) - 0.5;
    vec3 id = floor(position);

    float random_visibility = step(random(id), u_star_density);
    float circle = smoothstep(0.5 + u_star_intensity, 0.5, length(q));

    return circle * random_visibility;
}

void main() {
    highp vec3 dir = normalize(v_ray_dir);

#ifdef PROJECTION_GLOBE_VIEW
    float globe_pos_dot_dir = dot(u_globe_pos, dir);
    highp vec3 closest_point_forward = abs(globe_pos_dot_dir) * dir;
    float norm_dist_from_center = length(closest_point_forward - u_globe_pos) / u_globe_radius;

    // Compare against 0.98 instead of 1.0 to give enough room for the custom
    // antialiasing that might be applied from globe_raster.fragment.glsl
    if (norm_dist_from_center < 0.98) {
        discard;
        return;
    }
#endif

    highp vec3 horizon_dir = normalize(v_horizon_dir);
    float horizon_angle_mercator = dir.y < horizon_dir.y ?
        0.0 : max(acos(dot(dir, horizon_dir)), 0.0);

#ifdef PROJECTION_GLOBE_VIEW
    // Angle between dir and globe center
    highp vec3 closest_point = globe_pos_dot_dir * dir;
    float closest_point_to_center = length(closest_point - u_globe_pos);
    float theta = asin(clamp(closest_point_to_center / length(u_globe_pos), -1.0, 1.0));

    // Backward facing closest point rays should be treated separately
    float horizon_angle = globe_pos_dot_dir < 0.0 ?
        PI - theta - u_horizon_angle : theta - u_horizon_angle;

    // Increase speed of change of the angle interpolation for
    // a smoother visual transition between horizon angle mixing
    float angle_t = pow(u_transition, 10.0);

    horizon_angle = mix(horizon_angle, horizon_angle_mercator, angle_t);
#else
    float horizon_angle = horizon_angle_mercator;
#endif

    // Normalize in [0, 1]
    horizon_angle /= PI;

    // exponential curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    // https://www.desmos.com/calculator/l5v8lw9zby
    float t = exp(-horizon_angle / u_fadeout_range);

    float alpha_0 = u_color.a;
    float alpha_1 = u_high_color.a;
    float alpha_2 = u_space_color.a;

    vec3 color_stop_0 = u_color.rgb;
    vec3 color_stop_1 = u_high_color.rgb;
    vec3 color_stop_2 = u_space_color.rgb;

    vec3 c0 = mix(color_stop_2, color_stop_1, alpha_1);
    vec3 c1 = mix(c0, color_stop_0, alpha_0);
    vec3 c2 = mix(c0, c1, t);
    vec3 c  = mix(color_stop_2, c2, t);

    // Blend alphas
    float a0 = mix(alpha_2, 1.0, alpha_1);
    float a1 = mix(a0, 1.0, alpha_0);
    float a2 = mix(a0, a1, t);
    float a  = mix(alpha_2, a2, t);

    vec2 uv = gl_FragCoord.xy / u_viewport - 0.5;
    float aspect_ratio = u_viewport.x / u_viewport.y;

    vec4 uv_dir = vec4(normalize(vec3(uv.x * aspect_ratio, uv.y, 1.0)), 1.0);

    uv_dir = u_rotation_matrix * uv_dir;

    vec3 n = abs(uv_dir.xyz);
    vec2 uv_remap = (n.x > n.y && n.x > n.z) ? uv_dir.yz / uv_dir.x:
                    (n.y > n.x && n.y > n.z) ? uv_dir.zx / uv_dir.y:
                                               uv_dir.xy / uv_dir.z;

    uv_remap.x /= aspect_ratio;

    vec3 D = vec3(uv_remap, 1.0);

    // Accumulate star field
    highp float star_field = 0.0;

    if (u_star_intensity > 0.0) {
        // Create stars of various scales and offset to improve randomness
        star_field += stars(D, 1.2, vec2(0.0, 0.0));
        star_field += stars(D, 1.0, vec2(1.0, 0.0));
        star_field += stars(D, 0.8, vec2(0.0, 1.0));
        star_field += stars(D, 0.6, vec2(1.0, 1.0));

        // Fade stars as they get closer to horizon to
        // give the feeling of an atmosphere with thickness
        star_field *= (1.0 - pow(t, 0.25 + (1.0 - u_high_color.a) * 0.75));

        // Additive star field
        c += star_field * alpha_2;
    }

    // Dither
    c = dither(c, gl_FragCoord.xy + u_temporal_offset);


    gl_FragColor = vec4(c, a);
}
