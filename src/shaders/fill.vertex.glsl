#include "_prelude_fog.vertex.glsl"

in vec2 a_pos;
#ifdef ELEVATED_ROADS
in float a_z_offset;
#endif

uniform mat4 u_matrix;

#pragma mapbox: define highp vec4 color
#pragma mapbox: define lowp float opacity

void main() {
    #pragma mapbox: initialize highp vec4 color
    #pragma mapbox: initialize lowp float opacity

#ifdef ELEVATED_ROADS
    gl_Position = u_matrix * vec4(a_pos, a_z_offset, 1);
#else
    gl_Position = u_matrix * vec4(a_pos, 0, 1);
#endif

#ifdef FOG
    v_fog_pos = fog_position(a_pos);
#endif
}
