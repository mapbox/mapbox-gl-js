uniform float u_opacity;
uniform highp float u_fadeout_range;
uniform vec3 u_start_color;
uniform vec4 u_color;

#ifndef FOG
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
#endif

varying vec3 v_ray_dir;

void main() {
    vec3 dir = normalize(v_ray_dir);
    vec3 closestPoint = dot(u_globe_pos, dir) * dir;
    float normDistFromCenter = length(closestPoint - u_globe_pos) / u_globe_radius;

    if (normDistFromCenter < 1.0)
        discard;

    // exponential (sqrt) curve
    // [0.0, 1.0] == inside the globe, > 1.0 == outside of the globe
    float t = clamp(1.0 - sqrt(normDistFromCenter - 1.0) / u_fadeout_range, 0.0, 1.0);

    vec3 color = mix(vec3(0.0), u_color.rgb, t);

    gl_FragColor = vec4(color * t * u_opacity, u_opacity);
}
