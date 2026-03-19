#include "_prelude_terrain.vertex.glsl"

in ivec2 a_pos;
#ifdef PROJECTION_GLOBE_VIEW
in ivec3 a_pos_3;
#endif
out vec2 v_uv;

uniform mat4 u_matrix;
uniform float u_overlay_scale;

void main() {
    // This vertex shader expects a EXTENT x EXTENT quad,
    // The UV co-ordinates for the overlay texture can be calculated using that knowledge
    vec2 pos = vec2(a_pos);
    float h = elevation(pos);
    v_uv = pos / 8192.0;
#ifdef PROJECTION_GLOBE_VIEW
    gl_Position = u_matrix * vec4(vec3(a_pos_3) + elevationVector(pos) * h, 1);
#else
    gl_Position = u_matrix * vec4(pos * u_overlay_scale, h, 1);
#endif
}
