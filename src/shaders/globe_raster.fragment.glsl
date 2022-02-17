uniform sampler2D u_image0;
varying vec2 v_pos0;

uniform vec3 u_frustum_tl;
uniform vec3 u_frustum_tr;
uniform vec3 u_frustum_br;
uniform vec3 u_frustum_bl;
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;

uniform vec2 u_viewport;

float glow_opacity(float t) {
    const float decay = 6.0;
    float falloff = 1.0 - min(1.0, exp(-decay * t));
    falloff *= falloff * falloff;
    float glow_alpha = 1.0;
    return glow_alpha * min(1.0, 1.00747 * falloff);
}
float range(float depth, float near, float far) {
    return (depth - near) / (far - near);
}
vec4 apply_glow(vec4 color, float t) {
    float alpha = EPSILON + color.a;
    float opacity = glow_opacity(range(t, 0.9, 1.3));
    vec3 glow_color = vec3(1.0);
    color.rgb = mix(color.rgb / alpha, glow_color, opacity) * alpha;
    return color;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_viewport;

    vec3 ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, uv.x),
        mix(u_frustum_bl, u_frustum_br, uv.x),
        1.0 - uv.y);

    vec3 dir = normalize(ray_dir);

    vec3 closest_point = dot(u_globe_pos, dir) * dir;
    float norm_dist_from_center = length(closest_point - u_globe_pos) / u_globe_radius;

    vec4 raster = texture2D(u_image0, v_pos0);
    raster = apply_glow(raster, norm_dist_from_center);

    gl_FragColor = raster;;
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
