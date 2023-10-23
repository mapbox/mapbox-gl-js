#include "_prelude_fog.vertex.glsl"

uniform mat4 u_matrix;
uniform mat4 u_normalize_matrix;
uniform mat4 u_globe_matrix;
uniform vec2 u_tl_parent;
uniform float u_scale_parent;
uniform vec2 u_perspective_transform;

#ifdef PROJECTION_GLOBE_VIEW
attribute vec3 a_globe_pos;
attribute vec2 a_uv;
#else
attribute vec2 a_pos;
attribute vec2 a_texture_pos;
#endif

varying vec2 v_pos0;
varying vec2 v_pos1;

void main() {
    vec2 uv;
#ifdef PROJECTION_GLOBE_VIEW
    gl_Position = u_matrix * u_globe_matrix * vec4(a_globe_pos, 1.0);
    uv = a_uv;
#ifdef FOG
    v_fog_pos = fog_position((u_normalize_matrix * vec4(a_globe_pos, 1.0)).xyz);
#endif
#else
    float w = 1.0 + dot(a_texture_pos, u_perspective_transform);
    gl_Position = u_matrix * vec4(a_pos * w, 0, w);
#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
    // We are using Int16 for texture position coordinates to give us enough precision for
    // fractional coordinates. We use 8192 to scale the texture coordinates in the buffer
    // as an arbitrarily high number to preserve adequate precision when rendering.
    // This is also the same value as the EXTENT we are using for our tile buffer pos coordinates,
    // so math for modifying either is consistent.
    uv = a_texture_pos / 8192.0;
#endif

    v_pos0 = uv;
    v_pos1 = (v_pos0 * u_scale_parent) + u_tl_parent;
}
