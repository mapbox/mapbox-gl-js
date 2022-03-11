uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec4 u_color;
uniform vec4 u_space_color;
uniform vec4 u_sky_color;
uniform vec2 u_latlon;
uniform float u_star_intensity;
uniform float u_star_size;
uniform float u_star_density;

#ifndef FOG
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
#endif

varying vec3 v_ray_dir;

float random(vec3 p) {
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
    vec3 dir = normalize(v_ray_dir);
    vec3 closestPoint = dot(u_globe_pos, dir) * dir;
    float normDistFromCenter = length(closestPoint - u_globe_pos) / u_globe_radius;

    if (normDistFromCenter < 1.0)
        discard;

    // exponential curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    // https://www.desmos.com/calculator/l5v8lw9zby
    float t = clamp(exp(-(normDistFromCenter - 1.0) * pow(u_fadeout_range, -1.0)), 0.0, 1.0);

    float alpha_0 = u_color.a;
    float alpha_1 = u_sky_color.a;
    float alpha_3 = u_space_color.a;

    vec4 color_stop_0 = vec4(u_color.rgb, 1.0);
    vec4 color_stop_1 = vec4(u_sky_color.rgb, 1.0);
    vec4 color_stop_3 = u_space_color;

    vec4 c0 = mix(color_stop_3, color_stop_1, alpha_1);
    vec4 c1 = mix(c0, color_stop_0, alpha_0);
    vec4 c2 = mix(c0, c1, t);
    vec4 c3 = mix(color_stop_3, c2, t);

    vec4 color = c2 * t + c3 * (1.0 - t);

    vec2 uv = (gl_FragCoord.xy / u_viewport) * (2.0 - 1.0);
    vec3 D = vec3(uv + vec2(-u_latlon.y, -u_latlon.x), 1.0);

    // Accumulate star field
    float star_field = 0.0;

    // Create stars of various scales and offset to improve randomness
    star_field += stars(D, 1.2, vec2(0.0, 0.0));
    star_field += stars(D, 1.0, vec2(1.0, 0.0));
    star_field += stars(D, 0.8, vec2(0.0, 1.0));
    star_field += stars(D, 0.6, vec2(1.0, 1.0));

    // Fade stars as they get closer to horizon to
    // give the feeling of an atmosphere with thickness
    star_field *= (1.0 - pow(t, 0.25 + (1.0 - u_sky_color.a) * 0.75));

    gl_FragColor = vec4(color.rgb * color.a + star_field * alpha_3, color.a);
}
