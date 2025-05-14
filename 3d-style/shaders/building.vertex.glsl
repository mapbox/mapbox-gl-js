#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

in vec3 a_pos_3f;
in vec3 a_normal_3f;

out vec4 v_color;
out highp vec3 v_normal;
out highp float v_height;

uniform mat4 u_matrix;
uniform mat4 u_normal_matrix;

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;
out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out float v_depth_shadows;
#endif

vec3 sRGBToLinear(vec3 srgbIn) {
    return pow(srgbIn, vec3(2.2));
}

#pragma mapbox: define-attribute-vertex-shader-only highp vec2 part_color_emissive

void main() {
    #pragma mapbox: initialize-attribute-custom highp vec2 part_color_emissive

    vec4 color_emissive = decode_color(part_color_emissive);
    v_color = vec4(sRGBToLinear(color_emissive.rgb), color_emissive.a);

    v_normal = vec3(u_normal_matrix * vec4(a_normal_3f, 0.0));

    vec3 pos = a_pos_3f;
    v_height = pos.z;
    gl_Position = u_matrix * vec4(pos, 1.0);

#ifdef RENDER_SHADOWS
    vec3 shadow_pos = pos;
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset_model(v_normal);
    shadow_pos += offset * shadow_normal_offset_multiplier0();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shadow_pos, 1.0);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shadow_pos, 1.0);
    v_depth_shadows = gl_Position.w;
#endif

#ifdef FOG
    v_fog_pos = fog_position(pos);
#endif

#ifdef RENDER_CUTOFF
    v_cutoff_opacity = cutoff_opacity(u_cutoff_params, gl_Position.z);
#endif
}
