#include "_prelude_fog.vertex.glsl"
#include "_prelude_lighting.glsl"

in vec2 a_pos;

uniform mat4 u_matrix;

#ifdef LIGHTING_3D_MODE
uniform mediump vec4 u_color;
out vec4 v_color;
uniform float u_emissive_strength;
#endif

void main() {
    gl_Position = u_matrix * vec4(a_pos, 0, 1);

#ifdef LIGHTING_3D_MODE
    v_color = apply_lighting_with_emission_ground(u_color, u_emissive_strength);
#endif
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
