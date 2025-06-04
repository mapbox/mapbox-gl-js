#include "_prelude_fog.vertex.glsl"
#include "_prelude_shadow.vertex.glsl"

in vec2 a_pos;
in float a_height;
in vec3 a_pos_normal_3;

uniform mat4 u_matrix;

out vec3 v_normal;
out float v_height;

#ifdef RENDER_SHADOWS
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

out highp vec4 v_pos_light_view_0;
out highp vec4 v_pos_light_view_1;
out float v_depth;
#endif

#pragma mapbox: define highp vec4 structure_color

void main() {
    #pragma mapbox: initialize highp vec4 structure_color

    v_normal = a_pos_normal_3 / 16384.0;
    v_height = a_height;

    vec3 pos = vec3(a_pos, a_height);
    gl_Position = u_matrix * vec4(pos, 1);

#ifdef RENDER_SHADOWS
    vec3 shd_pos0 = pos;
    vec3 shd_pos1 = pos;
#ifdef NORMAL_OFFSET
    vec3 offset = shadow_normal_offset(vec3(-v_normal.xy, v_normal.z));
    shd_pos0 += offset * shadow_normal_offset_multiplier0();
    shd_pos1 += offset * shadow_normal_offset_multiplier1();
#endif
    v_pos_light_view_0 = u_light_matrix_0 * vec4(shd_pos0, 1);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(shd_pos1, 1);
    v_depth = gl_Position.w;
#endif

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
