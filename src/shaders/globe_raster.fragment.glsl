#include "_prelude_fog.fragment.glsl"
#include "_prelude_lighting.glsl"

uniform sampler2D u_image0;
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
uniform sampler2D u_image1;
uniform float u_emissive_texture_available;
#endif
uniform float u_far_z_cutoff;

in vec2 v_pos0;

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
    highp vec2 uv = gl_FragCoord.xy / u_viewport;
    #ifdef FLIP_Y
        uv.y = 1.0 - uv.y;
    #endif
    highp vec3 ray_dir = mix(
        mix(u_frustum_tl, u_frustum_tr, uv.x),
        mix(u_frustum_bl, u_frustum_br, uv.x),
        1.0 - uv.y);

    highp vec3 dir = normalize(ray_dir);

    highp vec3 closest_point = dot(u_globe_pos, dir) * dir;
    highp float norm_dist_from_center = 1.0 - length(closest_point - u_globe_pos) / u_globe_radius;

    const float antialias_pixel = 2.0;
    highp float antialias_factor = antialias_pixel * fwidth(norm_dist_from_center);
    highp float antialias = smoothstep(0.0, antialias_factor, norm_dist_from_center);

    vec4 raster = texture(u_image0, v_pos0);
#ifdef LIGHTING_3D_MODE
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    float emissive_strength = u_emissive_texture_available > 0.5 ? texture(u_image1, v_pos0).r : raster.a;
    raster = apply_lighting_with_emission_ground(raster, emissive_strength);
    color = vec4(clamp(raster.rgb, vec3(0), vec3(1)) * antialias, antialias);
#else // LIGHTING_3D_ALPHA_EMISSIVENESS
    raster = apply_lighting_ground(raster);
    color = vec4(raster.rgb * antialias, raster.a * antialias);
#endif // !LIGHTING_3D_ALPHA_EMISSIVENESS
#else // LIGHTING_3D_MODE
    color = vec4(raster.rgb * antialias, raster.a * antialias);
#endif // !LIGHTING_3D_MODE
#else // CUSTOM_ANTIALIASING
    color = texture(u_image0, v_pos0);
#ifdef LIGHTING_3D_MODE
#ifdef LIGHTING_3D_ALPHA_EMISSIVENESS
    float emissive_strength = u_emissive_texture_available > 0.5 ? texture(u_image1, v_pos0).r : color.a;
    color = apply_lighting_with_emission_ground(color, emissive_strength);
    color.a = 1.0;
#else // LIGHTING_3D_ALPHA_EMISSIVENESS
    color = apply_lighting_ground(color);
#endif // !LIGHTING_3D_ALPHA_EMISSIVENESS
#endif // LIGHTING_3D_MODE
#endif // !CUSTOM_ANTIALIASING
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos));
#endif
    color *= 1.0 - step(u_far_z_cutoff, 1.0 / gl_FragCoord.w);
    glFragColor = color;
#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif
    HANDLE_WIREFRAME_DEBUG;
}
