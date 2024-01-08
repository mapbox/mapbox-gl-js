#include "_prelude_terrain.vertex.glsl"

in vec2 a_pos;
#ifdef PROJECTION_GLOBE_VIEW
in vec3 a_pos_3;
#endif
out vec2 v_uv;

uniform mat4 u_matrix;
uniform float u_overlay_scale;

void main() {
    // This vertex shader expects a EXTENT x EXTENT quad,
    // The UV co-ordinates for the overlay texture can be calculated using that knowledge
    float h = elevation(a_pos);
    v_uv = a_pos / 8192.0;
#ifdef PROJECTION_GLOBE_VIEW
    gl_Position = u_matrix * vec4(a_pos_3 + elevationVector(a_pos) * h, 1);
#else
    gl_Position = u_matrix * vec4(a_pos * u_overlay_scale, h, 1);
#endif
}
