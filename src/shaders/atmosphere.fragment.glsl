#include "_prelude_fog.fragment.glsl"

uniform float u_transition;
uniform highp float u_fadeout_range;
uniform highp float u_temporal_offset;

uniform vec4 u_color;
uniform vec4 u_high_color;
uniform vec4 u_space_color;

uniform float u_horizon_angle;

in highp vec3 v_ray_dir;
in highp vec3 v_horizon_dir;

void main() {
    highp vec3 dir = normalize(v_ray_dir);

    float globe_pos_dot_dir;
#ifdef PROJECTION_GLOBE_VIEW
    globe_pos_dot_dir = dot(u_globe_pos, dir);
    highp vec3 closest_point_forward = abs(globe_pos_dot_dir) * dir;
    float norm_dist_from_center = length(closest_point_forward - u_globe_pos) / u_globe_radius;

    // Compare against 0.98 instead of 1.0 to give enough room for the custom
    // antialiasing that might be applied from globe_raster.fragment.glsl
    if (norm_dist_from_center < 0.98) {
    #ifdef ALPHA_PASS
            glFragColor = vec4(0, 0, 0, 0);
            return;
    #else
        #ifdef NATIVE
                // Needed for render test parity since white canvas is assumed
                glFragColor = vec4(1, 1, 1, 1);
        #else
                glFragColor = vec4(0, 0, 0, 1);
        #endif
            return;
    #endif
    }
#endif

    highp vec3 horizon_dir = normalize(v_horizon_dir);
    float horizon_angle_mercator = dir.y < horizon_dir.y ?
        0.0 : max(acos(clamp(dot(dir, horizon_dir), -1.0, 1.0)), 0.0);

    float horizon_angle;
#ifdef PROJECTION_GLOBE_VIEW
    // Angle between dir and globe center
    highp vec3 closest_point = globe_pos_dot_dir * dir;
    highp float closest_point_to_center = length(closest_point - u_globe_pos);
    highp float theta = asin(clamp(closest_point_to_center / length(u_globe_pos), -1.0, 1.0));

    // Backward facing closest point rays should be treated separately
    horizon_angle = globe_pos_dot_dir < 0.0 ?
        PI - theta - u_horizon_angle : theta - u_horizon_angle;

    // Increase speed of change of the angle interpolation for
    // a smoother visual transition between horizon angle mixing
    float angle_t = pow(u_transition, 10.0);

    horizon_angle = mix(horizon_angle, horizon_angle_mercator, angle_t);
#else
    horizon_angle = horizon_angle_mercator;
#endif

    // Normalize in [0, 1]
    horizon_angle /= PI;

    // exponential curve
    // horizon_angle angle of [0.0, 1.0] == inside the globe, horizon_angle > 1.0 == outside of the globe
    // https://www.desmos.com/calculator/l5v8lw9zby
    float t = exp(-horizon_angle / u_fadeout_range);

    float alpha_0 = u_color.a;
    float alpha_1 = u_high_color.a;
    float alpha_2 = u_space_color.a;

    vec3 color_stop_0 = u_color.rgb;
    vec3 color_stop_1 = u_high_color.rgb;
    vec3 color_stop_2 = u_space_color.rgb;

#ifdef ALPHA_PASS
    // Blend alphas
    float a0 = mix(alpha_2, 1.0, alpha_1);
    float a1 = mix(a0, 1.0, alpha_0);
    float a2 = mix(a0, a1, t);
    float a  = mix(alpha_2, a2, t);

    glFragColor = vec4(1.0, 1.0, 1.0, a);
#else
    vec3 c0 = mix(color_stop_2, color_stop_1, alpha_1);
    vec3 c1 = mix(c0, color_stop_0, alpha_0);
    vec3 c2 = mix(c0, c1, t);

    vec3 c = c2;

    // Do not apply dithering for mobile
    // Performance impact is quite noticable whereas the visual difference is not that high
#ifndef NATIVE
    // Dither
    c = dither(c, gl_FragCoord.xy + u_temporal_offset);
#endif

    // Blending with background space color
    glFragColor = vec4(c * t, t);
#endif
}
