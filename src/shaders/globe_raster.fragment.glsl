uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifndef FOG
uniform vec3 u_frustum_tl;
uniform vec3 u_frustum_tr;
uniform vec3 u_frustum_br;
uniform vec3 u_frustum_bl;
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
uniform vec2 u_viewport;
#endif

uniform bool u_is_antialias;

void main() {
    float antialias = 1.0;

    if (u_is_antialias) {
        vec2 uv = gl_FragCoord.xy / u_viewport;

        vec3 ray_dir = mix(
            mix(u_frustum_tl, u_frustum_tr, uv.x),
            mix(u_frustum_bl, u_frustum_br, uv.x),
            1.0 - uv.y);
        
        vec3 dir = normalize(ray_dir);

        vec3 closest_point = dot(u_globe_pos, dir) * dir;
        float norm_dist_from_center = 1.0 - length(closest_point - u_globe_pos) / u_globe_radius;

        const float antialias_distance_px = 4.0;
        antialias = smoothstep(0.0, antialias_distance_px / max(u_viewport.x, u_viewport.y), norm_dist_from_center);
    }

    vec4 raster = texture2D(u_image0, v_pos0);

    vec4 color = vec4(raster.rgb * antialias, raster.a * antialias);

#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;
#ifdef TERRAIN_WIREFRAME
    gl_FragColor = vec4(1.0, 0.0, 0.0, 0.8);
#endif
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
}
