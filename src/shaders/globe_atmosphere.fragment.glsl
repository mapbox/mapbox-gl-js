uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec4 u_color;
uniform vec4 u_sky_color;
uniform vec2 u_latlon;
uniform float u_star_intensity;
uniform float u_star_size;
uniform float u_star_density;

#ifndef FOG
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
#endif

varying highp vec3 v_ray_dir;

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
    highp vec3 dir = normalize(v_ray_dir);
    highp vec3 closest_point = abs(dot(u_globe_pos, dir)) * dir;
    float norm_dist_from_center = length(closest_point - u_globe_pos) / u_globe_radius;

    if (norm_dist_from_center < 1.0)
        discard;

    // exponential (sqrt) curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    float t = clamp(1.0 - sqrt(norm_dist_from_center - 1.0) / u_fadeout_range, 0.0, 1.0);

    vec2 uv = (gl_FragCoord.xy / u_viewport) * (2.0 - 1.0);
    vec3 D = vec3(uv + vec2(-u_latlon.y, -u_latlon.x), 1.0);

    vec4 color = mix(vec4(u_sky_color.rgb, u_sky_color.a), u_color, t);

    float star_field = 0.0;

    star_field += stars(D, 1.2, vec2(0.0, 0.0));
    star_field += stars(D, 1.0, vec2(1.0, 0.0));
    star_field += stars(D, 0.8, vec2(0.0, 1.0));
    star_field += stars(D, 0.6, vec2(1.0, 1.0));

    gl_FragColor = vec4(color.rgb * t * u_color.a * color.a + star_field, u_color.a + star_field);
}
