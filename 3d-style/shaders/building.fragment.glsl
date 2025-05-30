#include "_prelude_fog.fragment.glsl"
#include "_prelude_shadow.fragment.glsl"
#include "_prelude_lighting.glsl"

in vec4 v_color;
in highp vec3 v_normal;
in highp float v_height;

#ifdef RENDER_SHADOWS
in highp vec4 v_pos_light_view_0;
in highp vec4 v_pos_light_view_1;
in float v_depth_shadows;
#endif

uniform lowp float u_opacity;

vec3 linearTosRGB(vec3 color) {
    return pow(color, vec3(1./2.2));
}

vec3 apply_lighting_linear(vec3 color, vec3 normal, float dir_factor) {
    float ambient_directional_factor = calculate_ambient_directional_factor(normal);
    vec3 ambient_contrib = ambient_directional_factor * u_lighting_ambient_color;
    vec3 directional_contrib = u_lighting_directional_color * dir_factor;
    return color * (ambient_contrib + directional_contrib);
}

void main() {
    vec4 color = vec4(v_color.rgb, 1.0);
    vec3 normal = normalize(v_normal);
    vec3 xy_flipped_normal = vec3(-normal.xy, normal.z);

    float shadowed_lighting_factor = 0.0;
#ifdef RENDER_SHADOWS
    shadowed_lighting_factor = shadowed_light_factor_normal(xy_flipped_normal, v_pos_light_view_0, v_pos_light_view_1, v_depth_shadows);
#else
    shadowed_lighting_factor = dot(normal, u_lighting_directional_dir);

#endif

    color.rgb = apply_lighting_linear(color.rgb, xy_flipped_normal, shadowed_lighting_factor);
    color.rgb = mix(color.rgb, v_color.rgb, v_color.a);
    
#ifdef FOG
    color = fog_dither(fog_apply_premultiplied(color, v_fog_pos, v_height));
#endif

    color.rgb = linearTosRGB(color.rgb);
    color *= u_opacity;

#ifdef RENDER_CUTOFF
    color *= v_cutoff_opacity;
#endif

#ifdef INDICATOR_CUTOUT
    color = applyCutout(color, v_height);
#endif

    glFragColor = color; 

#ifdef DEBUG_SHOW_NORMALS
    color.rgb = xy_flipped_normal * 0.5 + vec3(0.5, 0.5, 0.5);
    color.a = 1.0;
    glFragColor = color;
#endif

#ifdef OVERDRAW_INSPECTOR
    glFragColor = vec4(1.0);
#endif

    HANDLE_WIREFRAME_DEBUG;
}
