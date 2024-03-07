#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;
uniform mat4 u_light_matrix_0;
uniform mat4 u_light_matrix_1;

in vec2 a_pos;

out vec4 v_pos_light_view_0;
out vec4 v_pos_light_view_1;

#ifdef FOG
out float v_fog_opacity;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0.0, 1.0);

    v_pos_light_view_0 = u_light_matrix_0 * vec4(a_pos, 0.0, 1.0);
    v_pos_light_view_1 = u_light_matrix_1 * vec4(a_pos, 0.0, 1.0);

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
    v_fog_opacity = fog(v_fog_pos);
#endif
}
