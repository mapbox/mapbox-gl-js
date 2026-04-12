#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;

in ivec2 a_pos;
in uvec2 a_texture_pos;

out vec2 v_pos;

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
    v_pos = vec2(a_texture_pos) / 8192.0;

#ifdef FOG
    v_fog_pos = fog_position(vec2(a_pos));
#endif
}
