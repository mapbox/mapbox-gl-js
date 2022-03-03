uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec4 u_color;
uniform vec4 u_sky_color;
uniform vec2 u_latlon;

#ifndef FOG
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
#endif

varying vec3 v_ray_dir;

vec2 random(vec3 p) {
    p = fract(p * vec3(443.8975, 397.2973, 491.1871));
    p += dot(p.zxy, p.yxz + 5.27);
    return fract(vec2(p.x * p.y, p.z * p.x));
}

float stars(vec3 p) {
    float star = 0.0;
    float resolution = 0.15 * u_viewport.x;

    for (float i = 0.0; i < 5.0; i++) {
        vec3 q = fract(p * resolution) - 0.5;
        vec3 id = floor(p * resolution);
        vec2 rn = random(id);
        float visibility = step(rn.x, 0.005 + i * i * 0.001);
        float circle = (1.0 - smoothstep(0.0, 0.5, length(q)));
        star += circle * visibility;
        p *= 1.1;
    }

    return pow(star, 2.0);
}

void main() {
    vec3 dir = normalize(v_ray_dir);
    vec3 closestPoint = dot(u_globe_pos, dir) * dir;
    float normDistFromCenter = length(closestPoint - u_globe_pos) / u_globe_radius;

    if (normDistFromCenter < 1.0)
        discard;

    // exponential (sqrt) curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    float t = clamp(1.0 - sqrt(normDistFromCenter - 1.0) / u_fadeout_range, 0.0, 1.0);

    vec2 uv = (gl_FragCoord.xy / u_viewport) * (2.0 - 1.0);
    vec3 D = vec3(uv + vec2(-u_latlon.y, -u_latlon.x), 1.0);

    vec4 color = mix(vec4(u_sky_color.rgb, u_sky_color.a), u_color, t);
    float s = stars(D) * (1.0 - t);

    gl_FragColor = vec4(color.rgb * t * u_color.a * color.a + s, u_color.a + s);
}
