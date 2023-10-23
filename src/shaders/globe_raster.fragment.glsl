#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform sampler2D u_image0;
varying vec2 v_pos0;

#ifndef FOG
uniform highp vec3 u_frustum_tl;
uniform highp vec3 u_frustum_tr;
uniform highp vec3 u_frustum_br;
uniform highp vec3 u_frustum_bl;
uniform highp vec3 u_globe_pos;
uniform highp float u_globe_radius;
uniform vec2 u_viewport;
#endif

void main() {
    vec4 color;
#ifdef CUSTOM_ANTIALIASING
    vec2 uv = gl_FragCoord.xy / u_viewport;

    highp vec3 ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, uv.x),
        mix(u_frustum_bl, u_frustum_br, uv.x),
        1.0 - uv.y);
        
    vec3 dir = normalize(ray_dir);

    vec3 closest_point = dot(u_globe_pos, dir) * dir;
    float norm_dist_from_center = 1.0 - length(closest_point - u_globe_pos) / u_globe_radius;

    const float antialias_pixel = 2.0;
    float antialias_factor = antialias_pixel * fwidth(norm_dist_from_center);
    float antialias = smoothstep(0.0, antialias_factor, norm_dist_from_center);

    vec4 raster = texture2D(u_image0, v_pos0);
#ifdef LIGHTING_3D_MODE
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    raster = apply_lighting_with_emission_ground(raster, raster.a);
    color = vec4(raster.rgb * antialias, antialias);
#else // LIGHTING_3D_ALPHA_EMISSIVENESS
    raster = apply_lighting_ground(raster);
    color = vec4(raster.rgb * antialias, raster.a * antialias);
#endif // !LIGHTING_3D_ALPHA_EMISSIVENESS
#else // LIGHTING_3D_MODE
    color = vec4(raster.rgb * antialias, raster.a * antialias);
#endif // !LIGHTING_3D_MODE
#else // CUSTOM_ANTIALIASING
    color = texture2D(u_image0, v_pos0);
#ifdef LIGHTING_3D_MODE
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    color = apply_lighting_with_emission_ground(color, color.a);
    color.a = 1.0;
#else // LIGHTING_3D_ALPHA_EMISSIVENESS
    color = apply_lighting_ground(color);
#endif // !LIGHTING_3D_ALPHA_EMISSIVENESS
#endif // LIGHTING_3D_MODE
#endif // !CUSTOM_ANTIALIASING
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    gl_FragColor = color;
#ifdef OVERDRAW_INSPECTOR
    gl_FragColor = vec4(1.0);
#endif
    HANDLE_WIREFRAME_DEBUG;
}
