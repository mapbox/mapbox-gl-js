#include "_prelude_terrain.vertex.glsl"

uniform mat4 u_matrix;
in ivec2 a_pos;

out float v_depth;

void main() {
    float elevation = elevation(vec2(a_pos));
    gl_Position = u_matrix * vec4(a_pos, elevation, 1.0);
    v_depth = gl_Position.z / gl_Position.w;
}
